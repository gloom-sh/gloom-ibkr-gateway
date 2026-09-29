import { expect, test } from "bun:test";
import { isFuturesGenericTicker } from "./generic";

test("generic futures tickers are recognized so they are never sent to IBKR as a contract", () => {
  for (const symbol of ["CL1", "cl2", "TY1", "ES1D15A", "VX2F5R", "SR31", "SFR1"]) expect(isFuturesGenericTicker(symbol)).toBe(true);
  for (const symbol of ["AAPL", "CL=F", "CLZ26", "CLZ26.NYM", "CL0", "CL25", "BRK.B", "", null]) expect(isFuturesGenericTicker(symbol)).toBe(false);
});
