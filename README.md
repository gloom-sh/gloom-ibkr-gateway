# IBKR Gateway for Gloomberb

Live market data, the trading console, and order entry through IBKR Gateway or TWS.

Requires Gloomberb 0.15.0 or later, for the query bar, stat bands and title-bar tabs from [Gloomberb #1091](https://github.com/gloom-sh/gloomberb/pull/1091).

```bash
gloomberb install gloom-sh/gloom-ibkr-gateway
```

Requires [`gloom-ibkr`](https://github.com/gloom-sh/gloom-ibkr), which owns the Interactive Brokers profile. Install both, then set a profile's connection mode to Gateway.

Press `IBKR` in the command bar for the trading console, or use the Trade tab on any ticker.

## Terminal and desktop only

Gateway speaks the TWS API over a raw TCP socket to a local Gateway or TWS process. A browser cannot open one, so this plugin declares `targets: ["cli", "tui", "desktop"]` and does not appear as installable at term.gloom.sh.

On the desktop the socket lives in the app's Bun process, which loads `index.tsx`; the window loads `index.browser.tsx`, the same plugin without the socket module, and every request from a pane reaches the socket through Gloomberb's remote broker client.

Flex account sync has no such limit, which is why the two are separate plugins.

## What it adds

- **IBKR Console** pane: Open Orders and Executions tabs, the Gateway profile and account in the query bar, and the account's net liquidation, buying power, available funds and day P&L above the table. The footer shows the connection state and the last result. `i` and `a` open the profile and account menus; on an open order, `m` loads it into the Trade tab to modify and `c` cancels it after a confirmation.
- **Trade** tab on the ticker research pane, with preview, place, modify, and cancel. The query bar holds the profile, account and side; the quote and net liquidation sit under it, then the order fields (contract, type, quantity, limit and stop prices), IBKR's what-if figures, and the Preview and Submit buttons. Click a field, or press Enter, to give the ticket the keyboard: `i` profile, `a` account, `b`/`v` buy or sell, `s` contract, `q` quantity, `t` type, `l` limit, `x` stop, `p` preview, Enter submit, Esc to hand the keyboard back.
- Live quotes, price history, and instrument search sourced from Gateway
- `Buy Selected` / `Sell Selected` commands

## Development

`gloomberb`, `gloom-ibkr`, and `react` are peer dependencies. Gloomberb links its own copies in at install time so there is one instance of each in the process.

```bash
bun install
git clone --depth 1 https://github.com/gloom-sh/gloomberb.git /tmp/gloomberb
bun install --cwd /tmp/gloomberb
ln -sfn /tmp/gloomberb node_modules/gloomberb
ln -sfn /tmp/gloomberb/node_modules/react node_modules/react
bun run typecheck && bun test
```

## License

MIT
