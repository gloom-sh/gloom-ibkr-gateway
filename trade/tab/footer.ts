import { usePaneFooter, type PaneFooterSegment } from "gloomberb/components";
import type { TickerRecord } from "gloomberb/types/ticker";
import type { TradeTicketState } from "../../trading/state";
import type { TradeTabActions } from "./actions";

/**
 * Status on the left: work in flight, the last result, the order being
 * modified. The field keys only reach the ticket while it holds the keyboard,
 * so until then the one hint is the key that hands it over. Preview and
 * Submit are the form's own buttons and are not repeated here.
 */
export function useTradeTabFooter({
  actions,
  canEnterOrder,
  enterInteractive,
  info,
  interactive,
  showLimit,
  showStop,
  symbol,
  ticketState,
  ticker,
}: {
  actions: TradeTabActions;
  /** False until a broker profile and account are picked, so order fields cannot be edited yet. */
  canEnterOrder: boolean;
  enterInteractive: () => void;
  info: PaneFooterSegment[];
  interactive: boolean;
  showLimit: boolean;
  showStop: boolean;
  symbol: string | null;
  ticketState: TradeTicketState;
  ticker: TickerRecord | null;
}) {
  usePaneFooter("ibkr-trade", () => {
    if (!symbol || !ticker) return null;
    if (!interactive) {
      return { info, hints: [{ id: "edit", key: "Enter", label: "edit", onPress: enterInteractive }] };
    }
    return {
      info,
      hints: ticketState.busy ? [] : [
        { id: "profile", key: "i", label: "profile", onPress: () => actions.chooseBrokerInstance().catch(() => {}) },
        { id: "account", key: "a", label: "ccount", onPress: () => actions.chooseAccount().catch(() => {}) },
        ...(canEnterOrder ? [
          { id: "side", key: "b/v", label: "side", onPress: actions.toggleSide },
          { id: "quantity", key: "q", label: "ty", onPress: () => actions.editQuantity().catch(() => {}) },
          { id: "type", key: "t", label: "ype", onPress: () => actions.editOrderType().catch(() => {}) },
          ...(showLimit ? [{ id: "limit", key: "l", label: "imit", onPress: () => actions.editLimitPrice().catch(() => {}) }] : []),
          ...(showStop ? [{ id: "stop", key: "x", label: "stop", onPress: () => actions.editStopPrice().catch(() => {}) }] : []),
        ] : []),
      ],
    };
  }, [
    actions,
    canEnterOrder,
    enterInteractive,
    info,
    interactive,
    showLimit,
    showStop,
    symbol,
    ticketState.busy,
    ticketState.draft,
    ticker,
  ]);
}
