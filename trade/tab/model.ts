import type { PaneFooterSegment, StatItem } from "gloomberb/components";
import { priceColor } from "gloomberb/theme";
import type { Quote } from "gloomberb/types/financials";
import type { BrokerContractRef } from "gloomberb/types/instrument";
import type { TickerRecord } from "gloomberb/types/ticker";
import type { BrokerAccount, BrokerOrderPreview } from "gloomberb/types/trading";
import { formatCurrency } from "gloomberb/utils";
import {
  formatMarketPrice,
  formatMarketPriceWithCurrency,
  formatSignedMarketPrice,
  type AssetDisplayContext,
} from "gloomberb/market-data";
import type { IbkrSnapshot } from "gloom-ibkr/gateway-types";
import { normalizeContract, type TradeTicketState } from "../../trading/state";
import { formatContractLabel, formatPreviewMetric } from "../utils";

export interface TradeContractDisplay {
  activeContract: BrokerContractRef;
  contractValue: string;
  /** The contract's long name, e.g. the company or the future's description. */
  contractName?: string;
}

export function resolveTradeContractDisplay({
  ticketState,
  ticker,
}: {
  ticketState: TradeTicketState;
  ticker: TickerRecord | null;
}): TradeContractDisplay {
  const activeContract = ticketState.draft.contract.symbol
    ? ticketState.draft.contract
    : ticker ? normalizeContract(ticker) : ticketState.draft.contract;
  return {
    activeContract,
    contractValue: formatContractLabel(activeContract),
    contractName: ticketState.contractName || ticker?.metadata.name || undefined,
  };
}

/** The quote the ticket prices against and the account's net liquidation, as the ticket's summary band. */
export function buildTradeQuoteItems(
  quote: Quote | undefined,
  formatContext: AssetDisplayContext,
  account: BrokerAccount | undefined,
): StatItem[] {
  const items: StatItem[] = quote
    ? [
      {
        id: "last",
        label: "Last",
        value: formatMarketPriceWithCurrency(quote.price, quote.currency, formatContext),
        detail: formatSignedMarketPrice(quote.change, formatContext),
        color: priceColor(quote.change ?? 0),
      },
      ...(quote.bid != null ? [{ id: "bid", label: "Bid", value: formatMarketPrice(quote.bid, formatContext) }] : []),
      ...(quote.ask != null
        ? [{
          id: "ask",
          label: "Ask",
          value: formatMarketPrice(quote.ask, formatContext),
          detail: quote.bid != null ? `spread ${formatMarketPrice(quote.ask - quote.bid, formatContext)}` : undefined,
        }]
        : []),
    ]
    : [{ id: "last", label: "Last", value: "—", tone: "muted" }];
  if (account) {
    items.push({
      id: "net-liq",
      label: "Net Liq",
      value: formatCurrency(account.netLiquidation || 0, account.currency || "USD"),
    });
  }
  return items;
}

/** What IBKR's what-if check says the order would cost; dashes until a preview has run. */
export function buildTradePreviewItems(preview: BrokerOrderPreview | null): StatItem[] {
  const items: StatItem[] = [
    {
      id: "fee",
      label: "Fee",
      value: preview?.commission != null
        ? formatCurrency(preview.commission, preview.commissionCurrency || "USD")
        : "—",
    },
    { id: "init", label: "Init", value: formatPreviewMetric(preview?.initMarginBefore, preview?.initMarginAfter) },
    { id: "maint", label: "Maint", value: formatPreviewMetric(preview?.maintMarginBefore, preview?.maintMarginAfter) },
    { id: "equity", label: "Equity", value: formatPreviewMetric(preview?.equityWithLoanBefore, preview?.equityWithLoanAfter) },
  ];
  if (preview?.warningText) {
    items.push({ id: "warning", label: "Warning", value: preview.warningText, tone: "negative", wide: true });
  }
  return items;
}

/** The ticket's changing status for the footer: work in flight, the last result, the order being modified. */
export function buildTradeFooterInfo({
  ticketState,
  gatewaySnapshot,
}: {
  ticketState: TradeTicketState;
  gatewaySnapshot: IbkrSnapshot;
}): PaneFooterSegment[] {
  const info: PaneFooterSegment[] = [];
  if (ticketState.busy) {
    info.push({ id: "busy", parts: [{ text: "working...", tone: "muted" }] });
  }
  const message = ticketState.lastError
    || ticketState.lastInfo
    || gatewaySnapshot.status.message
    || gatewaySnapshot.lastError;
  if (!ticketState.busy && message) {
    info.push({
      id: "message",
      parts: [{
        text: message,
        tone: ticketState.lastError ? "negative" : ticketState.isSuccess ? "positive" : "muted",
      }],
    });
  }
  if (ticketState.editingOrderId) {
    info.push({ id: "editing", parts: [{ text: `modifying order ${ticketState.editingOrderId}`, tone: "warning" }] });
  }
  return info;
}
