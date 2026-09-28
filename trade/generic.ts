/**
 * Gloomberb's generic futures tickers (CL1, TY2F5R) follow the nth listed
 * contract of a root and roll; IBKR has no contract by that name, so they
 * cannot be traded. Mirrors the app's grammar (src/utils/futures-generic.ts):
 * a root or its Bloomberg alias, a position from 1 to 24, then an optional
 * roll code (F5, D15) and adjustment (R, A).
 */
const ROOTS = new Set([
  "ES", "NQ", "RTY", "YM", "6E", "6J", "6B", "6A", "6C", "6S", "SR3", "ZQ", "ZT", "ZF", "ZN", "ZB", "UB",
  "CL", "BZ", "NG", "RB", "HO", "B0", "TTF", "GC", "SI", "HG", "PL", "PA", "ALI", "HRC", "UX",
  "ZC", "ZS", "ZW", "ZM", "ZL", "KE", "ZO", "ZR", "KC", "SB", "CC", "CT", "OJ", "LE", "GF", "HE", "LBR", "DC", "CSC",
  "GD", "BTC", "ETH", "SOL", "XRP", "VX",
  "TY", "US", "FV", "TU", "WN", "DM", "FF", "SFR", "CO", "XB", "LC", "LH", "FC", "SM", "BO", "KW",
]);

export function isFuturesGenericTicker(symbol: string | null | undefined): boolean {
  const ticker = symbol?.trim().toUpperCase() ?? "";
  if (!/^[A-Z0-9]{2,12}$/.test(ticker)) return false;
  for (let length = Math.min(4, ticker.length - 1); length >= 1; length -= 1) {
    if (!ROOTS.has(ticker.slice(0, length))) continue;
    const match = /^(\d{1,2})(?:[FD]\d{1,2})?[RA]?$/.exec(ticker.slice(length));
    if (match && !match[1]!.startsWith("0") && Number(match[1]) <= 24) return true;
  }
  return false;
}
