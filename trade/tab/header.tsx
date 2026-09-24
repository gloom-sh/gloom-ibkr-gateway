import { QueryBar, StatGrid, type QueryBarFilter, type StatItem } from "gloomberb/components";

/**
 * The ticket's header zone: who and where it trades (profile, account, side)
 * in the query bar, then the quote and the account's net liquidation.
 */
export function TradeTabHeader({
  width,
  filters,
  meta,
  quoteItems,
}: {
  width: number;
  filters: QueryBarFilter[];
  meta?: string;
  quoteItems: StatItem[];
}) {
  return (
    <>
      <QueryBar width={width} filters={filters} meta={meta} />
      <StatGrid items={quoteItems} width={width} />
    </>
  );
}
