import { Box, ScrollBox, useUiCapabilities } from "gloomberb/ui";
import { useDialog } from "gloomberb/dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  useAppSelector,
  usePaneCollection,
  usePaneInstanceId,
  usePaneTicker,
} from "gloomberb/react";
import { PaneStatusBody, type QueryBarSelectFilter, type SelectControl } from "gloomberb/components";
import { displayWidth } from "gloomberb/utils";
import type { TickerResearchTabProps } from "gloomberb/types/plugin";
import { isGatewayConfigured } from "gloom-ibkr/config";
import { useIbkrGatewaySelection } from "../../gateway/selection";
import { TradePreviewPanel } from "../preview-panel";
import { TradeTabHeader } from "./header";
import { TradeTicketPanel } from "../ticket-panel";
import {
  getTradeTicketState,
  useTradingPaneState,
} from "../../trading/state";
import { buildAccountFilter, buildProfileFilter } from "../filters";
import { inferDraftAccountId, isLimitOrder, isStopOrder } from "../utils";
import {
  buildTradeFooterInfo,
  buildTradeQuoteItems,
  resolveTradeContractDisplay,
} from "./model";
import { useTradeTabFooter } from "./footer";
import { useTradeTabActions } from "./actions";
import { useTradeTabShortcuts } from "./shortcuts";
import { useTradeTicketSync } from "./state-sync";

export function TradeTab({ focused, width, onCapture }: TickerResearchTabProps) {
  const config = useAppSelector((state) => state.config);
  const brokerAccounts = useAppSelector((state) => state.brokerAccounts);
  const paneId = usePaneInstanceId();
  const { collectionId } = usePaneCollection(paneId);
  const { ticker, financials } = usePaneTicker(paneId);
  const dialog = useDialog();
  const tradeState = useTradingPaneState();
  const { nativePaneChrome } = useUiCapabilities();
  const [interactive, setInteractive] = useState(false);
  const profileControl = useRef<SelectControl | null>(null);
  const accountControl = useRef<SelectControl | null>(null);

  const symbol = ticker?.metadata.ticker ?? null;
  const ticketState = getTradeTicketState(symbol, ticker);
  const preferredInstanceId = ticketState.brokerInstanceId ?? tradeState.brokerInstanceId;
  const {
    activePortfolio,
    gatewayInstances,
    lockedBrokerInstanceId,
    selectedInstance,
    gatewaySnapshot,
    gatewayService,
    normalizedConfig,
    isGatewayMode,
    availableAccounts,
    gatewayRequiredMessage,
  } = useIbkrGatewaySelection(
    config,
    brokerAccounts,
    collectionId,
    preferredInstanceId,
  );
  const inferredAccountId = selectedInstance
    ? inferDraftAccountId(
      config,
      collectionId,
      availableAccounts,
      selectedInstance.id,
      tradeState.accountId,
    )
    : undefined;
  const currentAccountId = ticketState.draft.accountId || inferredAccountId;
  const activeAccount = availableAccounts.find((account) => account.accountId === currentAccountId);
  const lockedAccountId = selectedInstance && lockedBrokerInstanceId === selectedInstance.id
    ? activePortfolio?.brokerAccountId
    : undefined;

  const enterInteractive = useCallback(() => {
    setInteractive(true);
    onCapture(true);
  }, [onCapture]);

  const exitInteractive = useCallback(() => {
    setInteractive(false);
    onCapture(false);
  }, [onCapture]);

  useEffect(() => {
    if (!focused) {
      exitInteractive();
    }
  }, [focused, exitInteractive]);

  useEffect(() => {
    exitInteractive();
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  useTradeTicketSync({
    availableAccounts,
    collectionId,
    config,
    isGatewayMode,
    lockedAccountId,
    selectedInstance,
    symbol,
    ticker,
    ticketState,
    tradeStateAccountId: tradeState.accountId,
  });

  const actions = useTradeTabActions({
    accountControl,
    availableAccounts,
    brokerAccounts,
    collectionId,
    config,
    currentAccountId,
    dialog,
    financials,
    gatewayInstances,
    gatewayRequiredMessage,
    gatewayService,
    isGatewayMode,
    lockedBrokerInstanceId,
    normalizedConfig,
    profileControl,
    selectedInstance,
    symbol,
    ticketState,
    ticker,
    tradeState,
  });

  useEffect(() => {
    if (!selectedInstance || !normalizedConfig || !isGatewayMode || !isGatewayConfigured(selectedInstance.config) || !symbol) return;
    actions.refresh().catch(() => {});
  }, [symbol, selectedInstance?.id, isGatewayMode, normalizedConfig ? JSON.stringify(normalizedConfig.gateway) : ""]); // eslint-disable-line react-hooks/exhaustive-deps

  const showLimit = isLimitOrder(ticketState.draft.orderType);
  const showStop = isStopOrder(ticketState.draft.orderType);
  useTradeTabShortcuts({
    actions,
    enterInteractive,
    exitInteractive,
    focused,
    interactive,
    showLimit,
    showStop,
    symbol,
    ticketState,
    ticker,
  });

  const hasProfile = Boolean(selectedInstance);
  const {
    activeContract,
    contractValue,
    contractName,
  } = resolveTradeContractDisplay({ ticketState, ticker });
  const hasAccount = Boolean(currentAccountId);
  const footerInfo = useMemo(
    () => buildTradeFooterInfo({ ticketState, gatewaySnapshot }),
    [gatewaySnapshot, ticketState],
  );

  useTradeTabFooter({
    actions,
    canEnterOrder: hasProfile && hasAccount,
    enterInteractive,
    info: footerInfo,
    interactive,
    showLimit,
    showStop,
    symbol,
    ticketState,
    ticker,
  });

  if (!ticker || !symbol) {
    return <PaneStatusBody empty emptyTitle="Select a ticker to draft an IBKR trade." />;
  }

  const filters: QueryBarSelectFilter[] = [
    buildProfileFilter({
      gatewayInstances,
      selectedInstance,
      lockedBrokerInstanceId,
      onChange: (instanceId) => {
        enterInteractive();
        actions.selectBrokerInstance(instanceId);
      },
      controlRef: profileControl,
    }),
    buildAccountFilter({
      accounts: availableAccounts,
      accountId: currentAccountId,
      lockedAccountId,
      onChange: (accountId) => {
        enterInteractive();
        actions.selectAccount(accountId);
      },
      controlRef: accountControl,
    }),
    {
      id: "side",
      label: "Side",
      inline: true,
      value: ticketState.draft.action,
      options: [{ value: "BUY", label: "BUY" }, { value: "SELL", label: "SELL" }],
      onChange: (action: string) => {
        enterInteractive();
        if (action === "SELL") actions.sellOrder();
        else actions.buyOrder();
      },
    },
  ];
  const fullMeta = [`TIF ${ticketState.draft.tif || "DAY"}`, contractName].filter(Boolean).join(" · ");
  // The terminal bar is one clipped row; context that would be cut mid-word is left out.
  // Its cells: a padding cell each side, each filter and the gap after it, and the gap before the context.
  const terminalBarWidth = 4 + filters.reduce((sum, filter) => {
    const choices = filter.inline
      ? filter.options.reduce((total, option) => total + displayWidth(option.label) + 2, 0)
      : displayWidth(filter.options.find((option) => option.value === filter.value)?.label ?? "");
    return sum + displayWidth(filter.label) + 1 + choices + 2;
  }, 0);
  const meta = nativePaneChrome || terminalBarWidth + displayWidth(fullMeta) <= width ? fullMeta : undefined;

  return (
    <Box flexDirection="column" flexGrow={1} width={width}>
      <TradeTabHeader
        width={width}
        filters={filters}
        meta={meta}
        quoteItems={buildTradeQuoteItems(
          financials?.quote,
          { assetCategory: ticker.metadata.assetCategory },
          activeAccount,
        )}
      />
      <ScrollBox flexGrow={1} flexBasis={0} minHeight={0} scrollY focusable={false}>
        <Box
          flexDirection="column"
          paddingBottom={1}
          onMouseDown={!interactive ? enterInteractive : undefined}
        >
          <TradeTicketPanel
            width={width}
            focused={focused}
            contractValue={contractValue}
            ticketState={ticketState}
            ticker={ticker}
            activeContract={activeContract}
            showLimit={showLimit}
            showStop={showStop}
            onEnterInteractive={enterInteractive}
            onChooseInstrument={() => actions.chooseInstrument().catch(() => {})}
            onEditOrderType={() => actions.editOrderType().catch(() => {})}
            onEditQuantity={() => actions.editQuantity().catch(() => {})}
            onEditLimitPrice={() => actions.editLimitPrice().catch(() => {})}
            onEditStopPrice={() => actions.editStopPrice().catch(() => {})}
          />
          <TradePreviewPanel
            width={width}
            interactive={interactive}
            ticketState={ticketState}
            onPreviewOrder={() => actions.previewOrder().catch(() => {})}
            onSubmitOrder={() => actions.submitOrder().catch(() => {})}
          />
        </Box>
      </ScrollBox>
    </Box>
  );
}
