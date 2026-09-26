import { useCallback, useMemo } from "react";
import type { SelectControl } from "gloomberb/components";
import type { DialogApi, PromptContext } from "gloomberb/dialog";
import type { AppConfig, BrokerInstanceConfig } from "gloomberb/types/config";
import type { TickerFinancials } from "gloomberb/types/financials";
import type { TickerRecord } from "gloomberb/types/ticker";
import type {
  BrokerAccount,
  BrokerOrderType,
} from "gloomberb/types/trading";
import { getBrokerInstance } from "gloomberb/utils";
import { ibkrBroker } from "gloom-ibkr/broker-adapter";
import { isGatewayConfigured, type IbkrConfig } from "gloom-ibkr/config";
import { ChoiceDialog, InputDialog } from "gloom-ibkr/dialogs";
import type { ibkrGatewayManager } from "../../gateway/service";
import { refreshGatewayData } from "../../gateway/helpers";
import {
  getTradeTicketState,
  setTradeTicketBusy,
  setTradeTicketDraft,
  setTradeTicketInstrument,
  setTradeTicketMessage,
  setTradeTicketPreview,
  updateTradeTicketState,
  updateTradingPaneState,
  type TradeTicketState,
  type TradingPaneState,
} from "../../trading/state";
import {
  getKnownIbkrAccounts,
  inferDraftAccountId,
  isLimitOrder,
  isStopOrder,
} from "../utils";
import { useTradeFieldEditors } from "./field-editors";
import { buildTradeOrderRequest } from "./order-request";

type IbkrGatewayService = ReturnType<typeof ibkrGatewayManager.getService>;

export interface TradeTabActions {
  refresh: () => Promise<void>;
  chooseBrokerInstance: () => Promise<void>;
  selectBrokerInstance: (instanceId: string) => void;
  chooseInstrument: () => Promise<void>;
  chooseAccount: () => Promise<void>;
  selectAccount: (accountId: string) => void;
  editOrderType: () => Promise<void>;
  editQuantity: () => Promise<void>;
  editLimitPrice: () => Promise<void>;
  editStopPrice: () => Promise<void>;
  previewOrder: () => Promise<void>;
  submitOrder: () => Promise<void>;
  buyOrder: () => void;
  sellOrder: () => void;
  toggleSide: () => void;
}

export function useTradeTabActions({
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
  isCloudMode = false,
  lockedBrokerInstanceId,
  normalizedConfig,
  profileControl,
  selectedInstance,
  symbol,
  ticketState,
  ticker,
  tradeState,
}: {
  /** The query bar's account menu, opened by `a`. */
  accountControl: { current: SelectControl | null };
  availableAccounts: BrokerAccount[];
  brokerAccounts: Record<string, BrokerAccount[]>;
  collectionId: string | null | undefined;
  config: AppConfig;
  currentAccountId?: string;
  dialog: DialogApi;
  financials: TickerFinancials | null;
  gatewayInstances: BrokerInstanceConfig[];
  gatewayRequiredMessage: string;
  gatewayService: IbkrGatewayService | null;
  isGatewayMode: boolean;
  /** A sign-in profile: orders become IBKR instructions the user submits in IBKR. */
  isCloudMode?: boolean;
  lockedBrokerInstanceId?: string;
  normalizedConfig: IbkrConfig | null;
  /** The query bar's profile menu, opened by `i`. */
  profileControl: { current: SelectControl | null };
  selectedInstance?: BrokerInstanceConfig;
  symbol: string | null;
  ticketState: TradeTicketState;
  ticker: TickerRecord | null;
  tradeState: TradingPaneState;
}): TradeTabActions {
  const refresh = useCallback(async () => {
    if (!symbol || !ticker) return;
    const ready = isCloudMode || (isGatewayMode && !!selectedInstance && isGatewayConfigured(selectedInstance.config));
    if (!selectedInstance || !normalizedConfig || !ready) {
      setTradeTicketMessage(symbol, undefined, gatewayRequiredMessage, ticker);
      return;
    }

    try {
      setTradeTicketBusy(symbol, true, ticker);
      // Sign-in accounts arrive with the profile's own sync; only a Gateway session is refreshed here.
      if (!isCloudMode) await refreshGatewayData(selectedInstance);
      const inferred = inferDraftAccountId(
        config,
        collectionId ?? null,
        availableAccounts,
        selectedInstance.id,
        tradeState.accountId,
      );
      if (inferred && !getTradeTicketState(symbol, ticker).draft.accountId) {
        setTradeTicketDraft(symbol, { brokerInstanceId: selectedInstance.id, accountId: inferred }, ticker);
      }
      setTradeTicketMessage(symbol, `Refreshed ${selectedInstance.label}.`, undefined, ticker);
    } catch (error: any) {
      setTradeTicketMessage(symbol, undefined, error?.message || `Failed to refresh ${selectedInstance.label}.`, ticker);
    } finally {
      setTradeTicketBusy(symbol, false, ticker);
    }
  }, [
    availableAccounts,
    collectionId,
    config,
    gatewayRequiredMessage,
    isCloudMode,
    isGatewayMode,
    normalizedConfig,
    selectedInstance,
    symbol,
    ticker,
    tradeState.accountId,
  ]);

  const chooseBrokerInstance = useCallback(async () => {
    if (!symbol || !ticker) return;
    if (lockedBrokerInstanceId) {
      setTradeTicketMessage(symbol, undefined, "This ticket is locked to the active broker-managed portfolio.", ticker);
      return;
    }
    if (gatewayInstances.length === 0) {
      setTradeTicketMessage(symbol, undefined, "Connect a Gateway / TWS IBKR profile first.", ticker);
      return;
    }
    profileControl.current?.open();
  }, [gatewayInstances.length, lockedBrokerInstanceId, profileControl, symbol, ticker]);

  const selectBrokerInstance = useCallback((instanceId: string) => {
    if (!symbol || !ticker) return;
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
    updateTradeTicketState(symbol, ticker, (current) => ({
      ...current,
      brokerInstanceId: instance.id,
      brokerLabel: instance.label,
      draft: {
        ...current.draft,
        brokerInstanceId: instance.id,
        accountId: undefined,
      },
      preview: null,
      editingOrderId: undefined,
      lastError: undefined,
      lastInfo: undefined,
    }));
  }, [config.brokerInstances, symbol, ticker]);

  const chooseInstrument = useCallback(async () => {
    if (!symbol || !ticker) return;
    if (isCloudMode) {
      setTradeTicketMessage(symbol, undefined, "Contract search needs a Gateway / TWS profile. This ticket uses the ticker's listing.", ticker);
      return;
    }
    if (!selectedInstance || !normalizedConfig || !gatewayService || !isGatewayMode || !isGatewayConfigured(selectedInstance.config)) {
      setTradeTicketMessage(symbol, undefined, gatewayRequiredMessage, ticker);
      return;
    }

    const search = await dialog.prompt<string>({
      content: (ctx: PromptContext<string>) => (
        <InputDialog
          {...ctx}
          step={{
            key: "query",
            type: "text",
            label: "Override Ticker Contract",
            placeholder: "AAPL, ES, SPY 260619C00500000",
            body: ["The current ticker is preloaded. Search only if you need a different listing, future, or options contract."],
          }}
        />
      ),
    });
    if (!search) return;

    try {
      setTradeTicketBusy(symbol, true, ticker);
      await gatewayService.connect(normalizedConfig.gateway);
      const results = (await gatewayService.searchInstruments(search, normalizedConfig.gateway)).map((result) => ({
        ...result,
        brokerInstanceId: result.brokerInstanceId ?? selectedInstance.id,
        brokerLabel: result.brokerLabel ?? selectedInstance.label,
        brokerContract: result.brokerContract
          ? { ...result.brokerContract, brokerInstanceId: result.brokerContract.brokerInstanceId ?? selectedInstance.id }
          : undefined,
      }));
      const choices = results.slice(0, 12).map((result, index) => ({
        id: String(index),
        label: `${result.symbol} ${result.type}`.trim(),
        description: `${selectedInstance.label} · ${result.name} · ${result.exchange || "SMART"}`,
      }));
      if (choices.length === 0) {
        setTradeTicketMessage(symbol, undefined, `No IBKR contracts matched "${search}".`, ticker);
        return;
      }

      const selected = await dialog.prompt<string>({
        content: (ctx: PromptContext<string>) => <ChoiceDialog {...ctx} title="Choose Contract" choices={choices} />,
      });
      if (!selected) return;

      const result = results[Number(selected)];
      if (!result) return;
      setTradeTicketInstrument(symbol, result, ticker);
      setTradeTicketMessage(symbol, `Loaded ${result.symbol} into the ticket.`, undefined, ticker);
    } catch (error: any) {
      setTradeTicketMessage(symbol, undefined, error?.message || "Failed to search IBKR contracts.", ticker);
    } finally {
      setTradeTicketBusy(symbol, false, ticker);
    }
  }, [dialog, gatewayRequiredMessage, gatewayService, isCloudMode, isGatewayMode, normalizedConfig, selectedInstance, symbol, ticker]);

  const chooseAccount = useCallback(async () => {
    if (!symbol || !ticker || !selectedInstance || !normalizedConfig) return;
    if (!isCloudMode && (!gatewayService || !isGatewayMode)) return;
    if (availableAccounts.length === 0) {
      await refresh();
    }

    const nextAccounts = getKnownIbkrAccounts(
      brokerAccounts,
      selectedInstance.id,
      isCloudMode ? [] : gatewayService!.getSnapshot().accounts,
    );
    if (nextAccounts.length === 0) {
      setTradeTicketMessage(symbol, undefined, "No IBKR accounts available.", ticker);
      return;
    }

    accountControl.current?.open();
  }, [
    accountControl,
    availableAccounts,
    brokerAccounts,
    gatewayService,
    isCloudMode,
    isGatewayMode,
    normalizedConfig,
    refresh,
    selectedInstance,
    symbol,
    ticker,
  ]);

  const selectAccount = useCallback((accountId: string) => {
    if (!symbol || !ticker || !selectedInstance) return;
    updateTradingPaneState({ accountId });
    setTradeTicketDraft(symbol, { brokerInstanceId: selectedInstance.id, accountId }, ticker);
  }, [selectedInstance, symbol, ticker]);

  const { editNumericField, editPriceField } = useTradeFieldEditors({
    dialog,
    financials,
    symbol,
    ticker,
  });

  const editOrderType = useCallback(async () => {
    if (!symbol || !ticker) return;
    const choice = await dialog.prompt<string>({
      content: (ctx: PromptContext<string>) => (
        <ChoiceDialog
          {...ctx}
          title="Order Type"
          choices={[
            { id: "MKT", label: "Market", description: "Execute at market price" },
            { id: "LMT", label: "Limit", description: "Set a limit price" },
            { id: "STP", label: "Stop", description: "Trigger at a stop price" },
            { id: "STP LMT", label: "Stop Limit", description: "Trigger a limit order at a stop price" },
          ]}
        />
      ),
    });
    if (!choice) return;
    const orderType = choice as BrokerOrderType;
    setTradeTicketDraft(symbol, {
      orderType,
      limitPrice: isLimitOrder(orderType) ? ticketState.draft.limitPrice : undefined,
      stopPrice: isStopOrder(orderType) ? ticketState.draft.stopPrice : undefined,
    }, ticker);
  }, [dialog, symbol, ticketState.draft.limitPrice, ticketState.draft.stopPrice, ticker]);

  const draftRequest = useCallback(() => buildTradeOrderRequest({
    currentAccountId,
    gatewayRequiredMessage,
    isGatewayMode,
    isCloudMode,
    normalizedConfig,
    selectedInstance,
    symbol,
    ticketState,
    ticker,
  }), [
    currentAccountId,
    gatewayRequiredMessage,
    isCloudMode,
    isGatewayMode,
    normalizedConfig,
    selectedInstance,
    symbol,
    ticketState,
    ticker,
  ]);

  const previewOrder = useCallback(async () => {
    const request = draftRequest();
    if (!request || !symbol || !ticker || !selectedInstance || !normalizedConfig) return;
    if (!isCloudMode && !gatewayService) return;

    try {
      setTradeTicketBusy(symbol, true, ticker);
      let preview;
      if (isCloudMode) {
        preview = await ibkrBroker.previewOrder!(selectedInstance, request);
      } else {
        await gatewayService!.connect(normalizedConfig.gateway);
        preview = await gatewayService!.previewOrder(normalizedConfig.gateway, request);
      }
      updateTradingPaneState({ accountId: request.accountId });
      setTradeTicketDraft(symbol, { brokerInstanceId: selectedInstance.id, accountId: request.accountId }, ticker);
      setTradeTicketPreview(symbol, preview, ticker);
      setTradeTicketMessage(
        symbol,
        isCloudMode ? "Send it to IBKR, then review and submit it there." : "Review the what-if preview, then submit when ready.",
        undefined,
        ticker,
      );
    } catch (error: any) {
      const message = error?.message || "Failed to preview order.";
      setTradeTicketMessage(symbol, undefined, message.replace("Timeout has occurred", "Preview timed out — try again."), ticker);
    } finally {
      setTradeTicketBusy(symbol, false, ticker);
    }
  }, [draftRequest, gatewayService, isCloudMode, normalizedConfig, selectedInstance, symbol, ticker]);

  const submitOrder = useCallback(async () => {
    const request = draftRequest();
    if (!request || !symbol || !ticker || !selectedInstance || !normalizedConfig) return;
    if (!isCloudMode && !gatewayService) return;
    if (!ticketState.preview) {
      await previewOrder();
      return;
    }

    try {
      setTradeTicketBusy(symbol, true, ticker);
      let successMessage: string;
      if (isCloudMode) {
        // IBKR opens the instruction in the browser; nothing is live until the user submits it there.
        await ibkrBroker.placeOrder!(selectedInstance, request);
        setTradeTicketPreview(symbol, null, ticker);
        setTradeTicketMessage(symbol, "Sent to IBKR. Review and submit it there.", undefined, ticker, true);
        return;
      }
      await gatewayService!.connect(normalizedConfig.gateway);
      if (ticketState.editingOrderId) {
        await gatewayService!.modifyOrder(normalizedConfig.gateway, ticketState.editingOrderId, request);
        successMessage = `Modified order ${ticketState.editingOrderId}.`;
      } else {
        const order = await gatewayService!.placeOrder(normalizedConfig.gateway, request);
        successMessage = `Submitted order ${order.orderId}.`;
      }
      setTradeTicketPreview(symbol, null, ticker);
      await refresh();
      setTradeTicketMessage(symbol, successMessage, undefined, ticker, true);
    } catch (error: any) {
      const message = error?.message || "Failed to submit order.";
      setTradeTicketMessage(symbol, undefined, message.replace("Timeout has occurred", "Order timed out — check open orders to verify status."), ticker);
    } finally {
      setTradeTicketBusy(symbol, false, ticker);
    }
  }, [
    draftRequest,
    gatewayService,
    isCloudMode,
    normalizedConfig,
    previewOrder,
    refresh,
    selectedInstance,
    symbol,
    ticketState.editingOrderId,
    ticketState.preview,
    ticker,
  ]);

  const buyOrder = useCallback(() => {
    if (symbol && ticker) setTradeTicketDraft(symbol, { action: "BUY" }, ticker);
  }, [symbol, ticker]);

  const sellOrder = useCallback(() => {
    if (symbol && ticker) setTradeTicketDraft(symbol, { action: "SELL" }, ticker);
  }, [symbol, ticker]);

  const toggleSide = useCallback(() => {
    if (symbol && ticker) {
      setTradeTicketDraft(symbol, { action: ticketState.draft.action === "BUY" ? "SELL" : "BUY" }, ticker);
    }
  }, [symbol, ticketState.draft.action, ticker]);

  const editQuantity = useCallback(async () => {
    if (!symbol || !ticker) return;
    await editNumericField("Quantity", ticketState.draft.quantity, (value) => {
      if (value != null) setTradeTicketDraft(symbol, { quantity: value }, ticker);
    });
  }, [editNumericField, symbol, ticketState.draft.quantity, ticker]);

  const editLimitPrice = useCallback(async () => {
    if (!symbol || !ticker) return;
    await editPriceField("Limit Price", ticketState.draft.limitPrice, (value) => {
      setTradeTicketDraft(symbol, { limitPrice: value }, ticker);
    });
  }, [editPriceField, symbol, ticketState.draft.limitPrice, ticker]);

  const editStopPrice = useCallback(async () => {
    if (!symbol || !ticker) return;
    await editPriceField("Stop Price", ticketState.draft.stopPrice, (value) => {
      setTradeTicketDraft(symbol, { stopPrice: value }, ticker);
    });
  }, [editPriceField, symbol, ticketState.draft.stopPrice, ticker]);

  return useMemo(() => ({
    refresh,
    chooseBrokerInstance,
    selectBrokerInstance,
    chooseInstrument,
    chooseAccount,
    selectAccount,
    editOrderType,
    editQuantity,
    editLimitPrice,
    editStopPrice,
    previewOrder,
    submitOrder,
    buyOrder,
    sellOrder,
    toggleSide,
  }), [
    buyOrder,
    chooseAccount,
    chooseBrokerInstance,
    chooseInstrument,
    editLimitPrice,
    editOrderType,
    editQuantity,
    editStopPrice,
    previewOrder,
    refresh,
    selectAccount,
    selectBrokerInstance,
    sellOrder,
    submitOrder,
    toggleSide,
  ]);
}
