import { FieldGrid, type GridField } from "gloomberb/components";
import type { BrokerContractRef } from "gloomberb/types/instrument";
import type { TickerRecord } from "gloomberb/types/ticker";
import { formatMarketPrice, formatMarketQuantity } from "gloomberb/market-data";
import type { TradeTicketState } from "../trading/state";

/**
 * The order's inputs. Each opens its own editor (contract search, order type
 * menu, quantity, price picker with bid and ask), so every cell is an action
 * that also takes the ticket's keys.
 */
export function TradeTicketPanel({
  width,
  focused,
  contractValue,
  ticketState,
  ticker,
  activeContract,
  showLimit,
  showStop,
  onEnterInteractive,
  onChooseInstrument,
  onEditOrderType,
  onEditQuantity,
  onEditLimitPrice,
  onEditStopPrice,
}: {
  width: number;
  focused: boolean;
  contractValue: string;
  ticketState: TradeTicketState;
  ticker: TickerRecord;
  activeContract: BrokerContractRef;
  showLimit: boolean;
  showStop: boolean;
  onEnterInteractive: () => void;
  onChooseInstrument: () => void;
  onEditOrderType: () => void;
  onEditQuantity: () => void;
  onEditLimitPrice: () => void;
  onEditStopPrice: () => void;
}) {
  const formatContext = {
    assetCategory: ticker.metadata.assetCategory,
    contractSecType: activeContract.secType,
  };
  const press = (action: () => void) => () => {
    onEnterInteractive();
    action();
  };
  const fields: GridField[] = [
    { id: "contract", label: "Contract", valueText: contractValue, onPress: press(onChooseInstrument) },
    { id: "type", label: "Type", valueText: ticketState.draft.orderType, onPress: press(onEditOrderType) },
    {
      id: "quantity",
      label: "Qty",
      valueText: formatMarketQuantity(ticketState.draft.quantity, formatContext),
      onPress: press(onEditQuantity),
    },
    ...(showLimit ? [{
      id: "limit",
      label: "Limit",
      valueText: ticketState.draft.limitPrice != null ? formatMarketPrice(ticketState.draft.limitPrice, formatContext) : "—",
      onPress: press(onEditLimitPrice),
    }] : []),
    ...(showStop ? [{
      id: "stop",
      label: "Stop",
      valueText: ticketState.draft.stopPrice != null ? formatMarketPrice(ticketState.draft.stopPrice, formatContext) : "—",
      onPress: press(onEditStopPrice),
    }] : []),
  ];

  return (
    <FieldGrid
      fields={fields}
      activeId={null}
      onActivate={() => {}}
      width={width}
      focused={focused}
    />
  );
}
