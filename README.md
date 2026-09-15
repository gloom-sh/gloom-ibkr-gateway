# IBKR Gateway for Gloomberb

Live market data, the trading console, and order entry through IBKR Gateway or TWS.

This branch uses the shared pane UI in [Gloomberb #743](https://github.com/gloom-sh/gloomberb/pull/743), targeting Gloomberb 0.14.0. That release is pending; released 0.13.3 is not supported.

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

- **IBKR Console** pane: connection status, accounts, open orders, executions
- **Trade** tab on the ticker research pane, with preview, place, modify, and cancel
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
