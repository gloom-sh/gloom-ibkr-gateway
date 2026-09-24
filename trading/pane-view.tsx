import { useMemo } from "react";
import { Box, TextAttributes } from "gloomberb/ui";
import {
  DataTableView,
  PaneStatusBody,
  QueryBar,
  StatGrid,
  Tabs,
  type DataTableCell,
  type DataTableColumn,
  type QueryBarFilter,
  type StatItem,
} from "gloomberb/components";
import { colors, priceColor } from "gloomberb/theme";
import type { Quote } from "gloomberb/types/financials";
import type { BrokerAccount } from "gloomberb/types/trading";
import { formatCurrency } from "gloomberb/utils";
import { formatMarketPrice, formatMarketQuantity } from "gloomberb/market-data";
import type { IbkrSnapshot } from "gloom-ibkr/gateway-types";

type OpenOrder = IbkrSnapshot["openOrders"][number];
type Execution = IbkrSnapshot["executions"][number];

export type TradingConsoleTab = "orders" | "executions";

export const TRADING_CONSOLE_TABS: { label: string; value: TradingConsoleTab }[] = [
  { label: "Open Orders", value: "orders" },
  { label: "Executions", value: "executions" },
];

const OPEN_ORDER_COLUMNS: DataTableColumn[] = [
  { id: "orderId", label: "ID", width: 7, align: "left" },
  { id: "action", label: "SIDE", width: 5, align: "left" },
  { id: "symbol", label: "SYMBOL", width: 14, align: "left", flexGrow: 1 },
  { id: "status", label: "STATUS", width: 10, align: "left" },
  { id: "remaining", label: "QTY", width: 6, align: "right" },
  { id: "price", label: "PRICE", width: 9, align: "right" },
  { id: "bid", label: "BID", width: 8, align: "right" },
  { id: "ask", label: "ASK", width: 8, align: "right" },
];

/** Narrower than this the quote columns go first, so the order itself never scrolls sideways. */
const QUOTE_COLUMNS_MIN_WIDTH = 78;
const OPEN_ORDER_COLUMNS_NARROW = OPEN_ORDER_COLUMNS.filter((column) => column.id !== "bid" && column.id !== "ask");

const EXECUTION_COLUMNS: DataTableColumn[] = [
  { id: "side", label: "SIDE", width: 5, align: "left" },
  { id: "symbol", label: "SYMBOL", width: 16, align: "left", flexGrow: 1 },
  { id: "shares", label: "QTY", width: 7, align: "right" },
  { id: "price", label: "PRICE", width: 10, align: "right" },
];

function signedCurrency(value: number, currency: string): string {
  return `${value > 0 ? "+" : ""}${formatCurrency(value, currency)}`;
}

/** The selected account's figures, the summary band of the console. */
export function buildAccountStatItems(account: BrokerAccount | undefined): StatItem[] {
  if (!account) return [];
  const currency = account.currency || "USD";
  return [
    { id: "net-liq", label: "Net Liq", value: formatCurrency(account.netLiquidation || 0, currency) },
    ...(account.buyingPower != null
      ? [{ id: "buying-power", label: "Buying Power", value: formatCurrency(account.buyingPower, currency) }]
      : []),
    ...(account.availableFunds != null
      ? [{ id: "available", label: "Available", value: formatCurrency(account.availableFunds, currency) }]
      : []),
    ...(account.dailyPnl != null
      ? [{ id: "day-pnl", label: "Day P&L", value: signedCurrency(account.dailyPnl, currency), color: priceColor(account.dailyPnl) }]
      : []),
  ];
}

function renderOpenOrderCell(
  order: OpenOrder,
  column: DataTableColumn,
  getOrderQuote: (symbol: string) => Quote | null,
): DataTableCell {
  const secType = order.contract.secType;
  switch (column.id) {
    case "orderId":
      return { text: String(order.orderId), color: colors.text };
    case "action":
      return { text: order.action, color: priceColor(order.action.toUpperCase() === "BUY" ? 1 : -1) };
    case "symbol":
      return { text: order.contract.localSymbol || order.contract.symbol, color: colors.text, attributes: TextAttributes.BOLD };
    case "status":
      return { text: order.status, color: colors.textDim };
    case "remaining":
      return { text: formatMarketQuantity(order.remaining, { contractSecType: secType, maxWidth: 6 }), color: colors.text };
    case "price":
      return {
        text: order.limitPrice != null
          ? formatMarketPrice(order.limitPrice, { contractSecType: secType, maxWidth: 9 })
          : order.stopPrice != null
            ? formatMarketPrice(order.stopPrice, { contractSecType: secType, maxWidth: 9 })
            : "MKT",
        color: colors.text,
      };
    case "bid": {
      const bid = getOrderQuote(order.contract.symbol)?.bid;
      return {
        text: bid != null ? formatMarketPrice(bid, { contractSecType: secType, maxWidth: 8 }) : "---",
        color: colors.textDim,
      };
    }
    default: {
      const ask = getOrderQuote(order.contract.symbol)?.ask;
      return {
        text: ask != null ? formatMarketPrice(ask, { contractSecType: secType, maxWidth: 8 }) : "---",
        color: colors.textDim,
      };
    }
  }
}

function renderExecutionCell(execution: Execution, column: DataTableColumn): DataTableCell {
  const secType = execution.contract.secType;
  switch (column.id) {
    case "side":
      return { text: execution.side, color: priceColor(execution.side.toUpperCase() === "BOT" ? 1 : -1) };
    case "symbol":
      return { text: execution.contract.localSymbol || execution.contract.symbol, color: colors.text };
    case "shares":
      return { text: formatMarketQuantity(execution.shares, { contractSecType: secType, maxWidth: 7 }), color: colors.text };
    default:
      return { text: formatMarketPrice(execution.price, { contractSecType: secType }), color: colors.text };
  }
}

export function TradingPaneView({
  emptyTitle,
  filters,
  gatewaySnapshot,
  getOrderQuote,
  height,
  onOpenSelectedOrder,
  onSelectExecutionSymbol,
  onSelectOpenOrderIndex,
  onSelectTab,
  selectedOpenOrderIndex,
  statItems,
  tab,
  tabsInHeader,
  width,
  focused = false,
}: {
  /** Set when there is no Gateway profile to show; replaces the whole body. */
  emptyTitle?: string;
  filters: QueryBarFilter[];
  gatewaySnapshot: IbkrSnapshot;
  getOrderQuote: (symbol: string) => Quote | null;
  height: number;
  onOpenSelectedOrder: () => void;
  onSelectExecutionSymbol: (symbol: string) => void;
  onSelectOpenOrderIndex: (index: number) => void;
  onSelectTab: (tab: TradingConsoleTab) => void;
  selectedOpenOrderIndex: number;
  statItems: StatItem[];
  tab: TradingConsoleTab;
  tabsInHeader: boolean;
  width: number;
  focused?: boolean;
}) {
  const executions = useMemo(
    () => gatewaySnapshot.executions.slice(0, 20),
    [gatewaySnapshot.executions],
  );

  if (emptyTitle) {
    return <PaneStatusBody empty emptyTitle={emptyTitle} />;
  }

  // The terminal draws the tab strip in the body; the desktop puts it in the title bar.
  const tableHeight = Math.max(3, height - (tabsInHeader ? 0 : 1));
  const header = (
    <>
      <QueryBar width={width} filters={filters} />
      <StatGrid items={statItems} width={width} />
    </>
  );

  return (
    <Box flexDirection="column" flexGrow={1} width={width} height={height}>
      {!tabsInHeader && (
        <Tabs
          tabs={TRADING_CONSOLE_TABS}
          activeValue={tab}
          onSelect={(value) => onSelectTab(value as TradingConsoleTab)}
          focused={focused}
          // The pane captures its keys and switches tabs itself.
          keyboardNavigation={false}
          dense
        />
      )}
      {tab === "orders" ? (
        <DataTableView<OpenOrder>
          focused={focused}
          rootWidth={width}
          rootHeight={tableHeight}
          rootBefore={header}
          columns={width >= QUOTE_COLUMNS_MIN_WIDTH ? OPEN_ORDER_COLUMNS : OPEN_ORDER_COLUMNS_NARROW}
          items={gatewaySnapshot.openOrders}
          sortColumnId={null}
          sortDirection="asc"
          getItemKey={(order) => String(order.orderId)}
          renderCell={(order, column) => renderOpenOrderCell(order, column, getOrderQuote)}
          selection={{
            kind: "index",
            selectedIndex: selectedOpenOrderIndex,
            onChange: (index) => onSelectOpenOrderIndex(index),
          }}
          onActivate={onOpenSelectedOrder}
          emptyStateTitle="No open IBKR orders."
        />
      ) : (
        <DataTableView<Execution>
          rootWidth={width}
          rootHeight={tableHeight}
          rootBefore={header}
          columns={EXECUTION_COLUMNS}
          items={executions}
          sortColumnId={null}
          sortDirection="asc"
          getItemKey={(execution) => execution.execId}
          renderCell={renderExecutionCell}
          selection={{ kind: "none" }}
          onActivate={(execution) => {
            const symbol = execution.contract.symbol;
            if (symbol) onSelectExecutionSymbol(symbol);
          }}
          onRowMouseDown={(execution) => {
            const symbol = execution.contract.symbol;
            if (symbol) onSelectExecutionSymbol(symbol);
          }}
          emptyStateTitle="No recent executions."
        />
      )}
    </Box>
  );
}
