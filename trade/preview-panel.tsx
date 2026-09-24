import { Button, StatGrid } from "gloomberb/components";
import { Box } from "gloomberb/ui";
import type { TradeTicketState } from "../trading/state";
import { buildTradePreviewItems } from "./tab/model";

/** The what-if figures and the ticket's own buttons: preview first, then submit once a preview exists. */
export function TradePreviewPanel({
  width,
  interactive,
  ticketState,
  onPreviewOrder,
  onSubmitOrder,
}: {
  width: number;
  interactive: boolean;
  ticketState: TradeTicketState;
  onPreviewOrder: () => void;
  onSubmitOrder: () => void;
}) {
  return (
    <>
      <StatGrid items={buildTradePreviewItems(ticketState.preview)} width={width} />
      <Box flexDirection="row" gap={1} paddingX={1} marginTop={1}>
        <Button
          label="Preview"
          variant="secondary"
          shortcut={interactive ? "p" : undefined}
          disabled={ticketState.busy}
          onPress={onPreviewOrder}
        />
        <Button
          label={ticketState.editingOrderId ? "Submit Change" : "Submit Order"}
          variant="primary"
          shortcut={interactive ? "Enter" : undefined}
          disabled={!ticketState.preview || ticketState.busy}
          onPress={onSubmitOrder}
        />
      </Box>
    </>
  );
}
