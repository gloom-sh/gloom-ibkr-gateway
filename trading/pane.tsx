import {
  ConfirmDialog,
  usePaneFooter,
  usePaneHeaderTabs,
  useRowNotes,
  type PaneFooterSegment,
  type SelectControl,
} from "gloomberb/components";
import { useShortcut } from "gloomberb/react";
import { useDialog, type PromptContext } from "gloomberb/dialog";
import { useCallback, useEffect, useRef } from "react";
import { resolveTickerFinancialsForInstrument } from "gloomberb/broker";
import { instrumentFromTicker } from "gloomberb/market-data";
import {
  useAppDispatch,
  useAppSelector,
  usePaneCollection,
  usePaneInstanceId,
} from "gloomberb/react";
import type { PaneProps } from "gloomberb/types/plugin";
import { isPlainKey } from "gloomberb/utils";
import { getBrokerInstance } from "gloomberb/utils";
import { usePluginAppActions, usePluginPaneActions, usePluginPaneState } from "gloomberb/react";
import { isGatewayConfigured } from "gloom-ibkr/config";
import { useIbkrGatewaySelection } from "../gateway/selection";
import { refreshGatewayData } from "../gateway/helpers";
import { buildAccountFilter, buildProfileFilter } from "../trade/filters";
import {
  getTradingPaneState,
  loadOrderIntoDraft,
  setTradingBusy,
  setTradingMessage,
  updateTradingPaneState,
  useTradingPaneState,
} from "./state";
import {
  findTickerForOrder,
  getKnownIbkrAccounts,
  inferDraftAccountId,
  isMarketDataWarning,
} from "../trade/utils";
import {
  buildAccountStatItems,
  TRADING_CONSOLE_TABS,
  TradingPaneView,
  type OpenOrder,
  type OrderNote,
  type TradingConsoleTab,
} from "./pane-view";

const orderKey = (order: OpenOrder) => String(order.orderId);
/** The order's state as IBKR reports it: a later one is newer news than a note about a cancel or a modify. */
const orderSignature = (order: OpenOrder) => order.status;

export function TradingPane({ focused, width, height }: PaneProps) {
  const dispatch = useAppDispatch();
  const config = useAppSelector((state) => state.config);
  const brokerAccounts = useAppSelector((state) => state.brokerAccounts);
  const tickers = useAppSelector((state) => state.tickers);
  const paneId = usePaneInstanceId();
  const { collectionId } = usePaneCollection(paneId);
  const { selectTicker, switchTab, switchPanel } = usePluginPaneActions();
  const { notify } = usePluginAppActions();
  const dialog = useDialog();
  const tradeState = useTradingPaneState();
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
    tradeState.brokerInstanceId,
  );
  const statusMessage = gatewaySnapshot.status.message || gatewaySnapshot.lastError;
  const displayStatusState = gatewaySnapshot.status.state === "error" && isMarketDataWarning(statusMessage)
    ? "connected"
    : gatewaySnapshot.status.state;
  const selectedOrder = gatewaySnapshot.openOrders[tradeState.selectedOpenOrderIndex] ?? null;
  // What a cancel or a modify came to is said on the order's row while it is listed, and a toast once it has left.
  const { noteFor, setNote, clearNotes } = useRowNotes<OpenOrder, OrderNote>(gatewaySnapshot.openOrders, {
    key: orderKey,
    signature: orderSignature,
  });
  const listed = useCallback((orderId: number) => (
    gatewayService?.getSnapshot().openOrders.some((order) => order.orderId === orderId) ?? false
  ), [gatewayService]);
  // Another profile lists other orders.
  useEffect(() => { clearNotes(); }, [clearNotes, selectedInstance?.id]);

  useEffect(() => {
    if (!focused) return;
    dispatch({ type: "SET_INPUT_CAPTURED", captured: true });
    return () => {
      dispatch({ type: "SET_INPUT_CAPTURED", captured: false });
    };
  }, [focused, dispatch]);

  useEffect(() => {
    if (!selectedInstance) return;
    const lockedAccountId = lockedBrokerInstanceId === selectedInstance.id ? activePortfolio?.brokerAccountId : undefined;
    if (
      tradeState.brokerInstanceId !== selectedInstance.id
      || tradeState.brokerLabel !== selectedInstance.label
      || (lockedAccountId && tradeState.accountId !== lockedAccountId)
    ) {
      updateTradingPaneState((current) => ({
        ...current,
        brokerInstanceId: selectedInstance.id,
        brokerLabel: selectedInstance.label,
        accountId: lockedAccountId ?? current.accountId,
        selectedOpenOrderIndex: 0,
      }));
    }
  }, [
    selectedInstance,
    tradeState.brokerInstanceId,
    tradeState.brokerLabel,
    tradeState.accountId,
    lockedBrokerInstanceId,
    activePortfolio?.brokerAccountId,
  ]);

  useEffect(() => {
    if (!isGatewayMode || availableAccounts.length === 0 || tradeState.accountId || !selectedInstance) return;
    const inferred = inferDraftAccountId(
      config,
      collectionId,
      availableAccounts,
      selectedInstance.id,
      tradeState.accountId,
    );
    if (inferred) {
      updateTradingPaneState({ accountId: inferred });
    }
  }, [isGatewayMode, availableAccounts, tradeState.accountId, config, collectionId, selectedInstance]);

  /** Reads the profile again; `quiet` after an order action, whose result its row says. */
  const refresh = useCallback(async (quiet = false) => {
    if (!selectedInstance || !normalizedConfig || !isGatewayMode || !isGatewayConfigured(selectedInstance.config)) {
      setTradingMessage(undefined, gatewayRequiredMessage);
      return;
    }

    try {
      setTradingBusy(true);
      await refreshGatewayData(selectedInstance);
      const inferred = inferDraftAccountId(
        config,
        collectionId,
        availableAccounts,
        selectedInstance.id,
        tradeState.accountId,
      );
      if (inferred && !getTradingPaneState().accountId) {
        updateTradingPaneState({ accountId: inferred });
      }
      if (!quiet) setTradingMessage(`Refreshed ${selectedInstance.label}.`, undefined);
    } catch (error: any) {
      setTradingMessage(undefined, error?.message || `Failed to refresh ${selectedInstance.label}.`);
    } finally {
      setTradingBusy(false);
    }
  }, [
    selectedInstance,
    normalizedConfig,
    isGatewayMode,
    config,
    collectionId,
    availableAccounts,
    tradeState.accountId,
    gatewayRequiredMessage,
  ]);

  useEffect(() => {
    if (!selectedInstance || !normalizedConfig || !isGatewayMode || !isGatewayConfigured(selectedInstance.config)) return;
    refresh().catch(() => {});
  }, [selectedInstance?.id, isGatewayMode, normalizedConfig ? JSON.stringify(normalizedConfig.gateway) : ""]);

  const profileControl = useRef<SelectControl | null>(null);
  const accountControl = useRef<SelectControl | null>(null);

  const selectBrokerInstance = useCallback((instanceId: string) => {
    const instance = getBrokerInstance(config.brokerInstances, instanceId);
    if (!instance) return;
    updateTradingPaneState({
      brokerInstanceId: instance.id,
      brokerLabel: instance.label,
      accountId: undefined,
      selectedOpenOrderIndex: 0,
      lastError: undefined,
      lastInfo: undefined,
    });
  }, [config.brokerInstances]);

  const chooseBrokerInstance = useCallback(async () => {
    if (lockedBrokerInstanceId) {
      setTradingMessage(undefined, "This console is locked to the active broker-managed portfolio.");
      return;
    }
    if (gatewayInstances.length === 0) {
      setTradingMessage(undefined, "Connect a Gateway / TWS IBKR profile first.");
      return;
    }
    profileControl.current?.open();
  }, [gatewayInstances.length, lockedBrokerInstanceId]);

  const chooseAccount = useCallback(async () => {
    if (!selectedInstance || !normalizedConfig || !gatewayService || !isGatewayMode) return;
    if (availableAccounts.length === 0) {
      await refresh();
    }

    const nextAccounts = getKnownIbkrAccounts(
      brokerAccounts,
      selectedInstance.id,
      gatewayService.getSnapshot().accounts,
    );
    if (nextAccounts.length === 0) {
      setTradingMessage(undefined, "No IBKR accounts available.");
      return;
    }
    accountControl.current?.open();
  }, [availableAccounts, brokerAccounts, gatewayService, isGatewayMode, normalizedConfig, refresh, selectedInstance]);

  const cancelSelectedOrder = useCallback(async () => {
    if (!selectedOrder || !selectedInstance || !normalizedConfig || !gatewayService || !isGatewayMode) return;
    const symbol = selectedOrder.contract.localSymbol || selectedOrder.contract.symbol;
    const confirmed = await dialog.prompt<boolean>({
      closeOnClickOutside: true,
      content: (ctx: PromptContext<boolean>) => (
        <ConfirmDialog
          {...ctx}
          title={`Cancel order ${selectedOrder.orderId}?`}
          body={[`${selectedOrder.action} ${selectedOrder.remaining} ${symbol}, ${selectedOrder.status}`]}
          confirmLabel="Cancel order"
          cancelLabel="Keep"
          footer="Enter cancel order · Esc keep"
        />
      ),
    }).catch(() => false);
    if (confirmed !== true) return;
    const order = selectedOrder;
    const key = orderKey(order);
    setNote(key, { status: "Cancelling…", tone: "warning" });
    try {
      await gatewayService.cancelOrder(normalizedConfig.gateway, order.orderId);
    } catch (error: any) {
      const reason = error?.message || `Failed to cancel order ${order.orderId}.`;
      if (listed(order.orderId)) {
        setNote(key, { status: "Cancel failed", text: reason, tone: "negative" });
      } else {
        setNote(key, null);
        notify({ body: reason, type: "error" });
      }
      return;
    }
    // From here IBKR's own status (PendingCancel, Cancelled) says it; an order that has left the list needs a toast.
    setNote(key, null);
    await refresh(true);
    if (!listed(order.orderId)) notify({ body: `Cancelled order ${order.orderId}.`, type: "success" });
  }, [dialog, selectedOrder, selectedInstance, normalizedConfig, gatewayService, isGatewayMode, refresh, setNote, listed, notify]);

  const openSelectedOrder = useCallback(() => {
    if (!selectedOrder) return;
    const key = orderKey(selectedOrder);
    const ticker = findTickerForOrder(selectedOrder, tickers);
    if (!ticker) {
      const symbol = selectedOrder.contract.localSymbol || selectedOrder.contract.symbol;
      setNote(key, {
        status: "Modify failed",
        text: `No local ticker exists for ${symbol}. Add ${symbol} to a portfolio or watchlist to modify this order here.`,
        tone: "negative",
      });
      return;
    }
    setNote(key, null);
    // The ticket it opens in says the order was loaded.
    loadOrderIntoDraft(ticker.metadata.ticker, selectedOrder, ticker);
    updateTradingPaneState({
      brokerInstanceId: selectedOrder.brokerInstanceId ?? selectedOrder.contract.brokerInstanceId,
      accountId: selectedOrder.accountId,
    });
    selectTicker(ticker.metadata.ticker, paneId);
    switchTab("ibkr-trade", paneId);
    switchPanel("right");
  }, [selectedOrder, tickers, paneId, selectTicker, switchTab, switchPanel, setNote]);

  const hasProfile = Boolean(selectedInstance && isGatewayMode);
  const [storedTab, setTab] = usePluginPaneState<TradingConsoleTab>("tab", "orders");
  const tab: TradingConsoleTab = storedTab === "executions" ? "executions" : "orders";
  // Without a profile every tab would show the same empty state.
  const tabsInHeader = usePaneHeaderTabs(hasProfile ? {
    tabs: TRADING_CONSOLE_TABS,
    activeValue: tab,
    onSelect: (value) => setTab(value as TradingConsoleTab),
    focused,
    keyboardNavigation: false,
  } : null);
  const ordersTab = hasProfile && tab === "orders";

  const footerActionsRef = useRef<{
    chooseBrokerInstance: () => Promise<void>;
    chooseAccount: () => Promise<void>;
    openSelectedOrder: () => void;
    cancelSelectedOrder: () => Promise<void>;
  }>({
    chooseBrokerInstance: async () => {},
    chooseAccount: async () => {},
    openSelectedOrder: () => {},
    cancelSelectedOrder: async () => {},
  });
  footerActionsRef.current = {
    chooseBrokerInstance,
    chooseAccount,
    openSelectedOrder,
    cancelSelectedOrder,
  };

  const message = tradeState.lastError
    || gatewaySnapshot.status.message
    || gatewaySnapshot.lastError
    || tradeState.lastInfo;
  const messageTone = tradeState.lastError
    ? "negative" as const
    : isMarketDataWarning(message)
      ? "warning" as const
      : "muted" as const;

  usePaneFooter("ibkr-trading-pane", () => {
    // Without a profile the body already says what is missing.
    if (!hasProfile) return { info: [], hints: [] };
    // One segment, so a long Gateway message is cut at its end instead of squeezing the state.
    const parts: PaneFooterSegment["parts"] = [{
      text: displayStatusState,
      tone: displayStatusState === "connected" ? "positive" : displayStatusState === "error" ? "negative" : "muted",
    }];
    if (tradeState.busy) parts.push({ text: "working...", tone: "muted" });
    if (message) parts.push({ text: message, tone: messageTone });
    return {
      info: [{ id: "status", parts }],
      hints: [
        {
          id: "profile",
          key: "i",
          label: "profile",
          disabled: Boolean(lockedBrokerInstanceId),
          onPress: () => footerActionsRef.current.chooseBrokerInstance().catch(() => {}),
        },
        { id: "account", key: "a", label: "ccount", onPress: () => footerActionsRef.current.chooseAccount().catch(() => {}) },
        ...(ordersTab && selectedOrder ? [
          { id: "modify", key: "m", label: "odify", onPress: () => footerActionsRef.current.openSelectedOrder() },
          { id: "cancel", key: "c", label: "ancel", onPress: () => footerActionsRef.current.cancelSelectedOrder().catch(() => {}) },
        ] : []),
      ],
    };
  }, [displayStatusState, hasProfile, lockedBrokerInstanceId, message, messageTone, ordersTab, selectedOrder, tradeState.busy]);

  useShortcut((event) => {
    if (!focused) return;
    event.stopPropagation?.();

    if (hasProfile && (isPlainKey(event, "h", "left") || isPlainKey(event, "l", "right"))) {
      const index = TRADING_CONSOLE_TABS.findIndex((entry) => entry.value === tab);
      const step = isPlainKey(event, "h", "left") ? -1 : 1;
      const next = TRADING_CONSOLE_TABS[(index + step + TRADING_CONSOLE_TABS.length) % TRADING_CONSOLE_TABS.length];
      if (next) setTab(next.value);
      return;
    }

    if (ordersTab && isPlainKey(event, "j", "down")) {
      const nextIndex = Math.min(tradeState.selectedOpenOrderIndex + 1, Math.max(0, gatewaySnapshot.openOrders.length - 1));
      updateTradingPaneState({ selectedOpenOrderIndex: nextIndex });
      return;
    }

    if (ordersTab && isPlainKey(event, "k", "up")) {
      const nextIndex = Math.max(0, tradeState.selectedOpenOrderIndex - 1);
      updateTradingPaneState({ selectedOpenOrderIndex: nextIndex });
      return;
    }

    switch (event.name) {
      case "r":
        refresh().catch(() => {});
        break;
      case "i":
        chooseBrokerInstance().catch(() => {});
        break;
      case "a":
        chooseAccount().catch(() => {});
        break;
      case "m":
      case "return":
      case "enter":
        if (ordersTab) openSelectedOrder();
        break;
      case "c":
        if (ordersTab) cancelSelectedOrder().catch(() => {});
        break;
    }
  });

  const activeAccount = availableAccounts.find((account) => account.accountId === (tradeState.accountId || ""));
  const lockedAccountId = selectedInstance && lockedBrokerInstanceId === selectedInstance.id
    ? activePortfolio?.brokerAccountId
    : undefined;
  const getOrderQuote = useCallback((symbol: string) => {
    const ticker = tickers.get(symbol) ?? null;
    const instrument = instrumentFromTicker(ticker, symbol);
    return instrument ? resolveTickerFinancialsForInstrument(instrument)?.quote ?? null : null;
  }, [tickers]);

  return (
    <TradingPaneView
      emptyTitle={hasProfile ? undefined : gatewayRequiredMessage}
      filters={[
        buildProfileFilter({
          gatewayInstances,
          selectedInstance,
          lockedBrokerInstanceId,
          onChange: selectBrokerInstance,
          controlRef: profileControl,
        }),
        buildAccountFilter({
          accounts: availableAccounts,
          accountId: tradeState.accountId,
          lockedAccountId,
          onChange: (accountId) => updateTradingPaneState({ accountId }),
          controlRef: accountControl,
        }),
      ]}
      gatewaySnapshot={gatewaySnapshot}
      getOrderQuote={getOrderQuote}
      height={height}
      onOpenSelectedOrder={openSelectedOrder}
      onSelectExecutionSymbol={(symbol) => {
        if (tickers.has(symbol)) {
          selectTicker(symbol, paneId);
        }
      }}
      onSelectOpenOrderIndex={(index) => updateTradingPaneState({ selectedOpenOrderIndex: index })}
      noteFor={noteFor}
      onSelectTab={setTab}
      selectedOpenOrderIndex={tradeState.selectedOpenOrderIndex}
      statItems={buildAccountStatItems(activeAccount)}
      tab={tab}
      tabsInHeader={tabsInHeader}
      width={width}
      focused={focused}
    />
  );
}
