import { afterEach, expect, test } from "bun:test";
import { act } from "react";
import { Box } from "gloomberb/ui";
import {
  PaneFooterBar,
  PaneFooterProvider,
  TestDialogProvider,
  TestPaneProvider,
  createInitialState,
  createTestPaneConfig,
  createTestPluginRuntime,
  emitKeypress,
  settleFrame,
  testRender,
} from "gloomberb/test-support";
import type { BrokerInstanceConfig } from "gloomberb/types/config";
import type { IbkrSnapshot } from "gloom-ibkr/gateway-types";
import { ibkrGatewayManager } from "../gateway/service";
import { clearTradingDraft } from "./state";
import { TradingPane } from "./pane";

const PANE_ID = "ibkr-trading:test";
const INSTANCE_ID = "ibkr-paper";

let setup: Awaited<ReturnType<typeof testRender>> | undefined;

function createGatewayInstance(): BrokerInstanceConfig {
  return {
    id: INSTANCE_ID,
    brokerType: "ibkr",
    label: "Paper",
    connectionMode: "gateway",
    config: { connectionMode: "gateway", gateway: { host: "127.0.0.1", port: 4002, clientId: 1 } },
    enabled: true,
  };
}

const SNAPSHOT: IbkrSnapshot = {
  status: { state: "connected", updatedAt: Date.now() },
  accounts: [{ accountId: "DU123456", name: "DU123456", currency: "USD", netLiquidation: 125000, buyingPower: 500000 }],
  openOrders: [{
    orderId: 42,
    brokerInstanceId: INSTANCE_ID,
    accountId: "DU123456",
    status: "Submitted",
    action: "BUY",
    orderType: "LMT",
    quantity: 10,
    filled: 0,
    remaining: 10,
    limitPrice: 190.5,
    updatedAt: Date.now(),
    contract: { brokerId: "ibkr", brokerInstanceId: INSTANCE_ID, symbol: "AAPL", localSymbol: "AAPL", secType: "STK", exchange: "SMART", currency: "USD" },
  }],
  executions: [],
};

/** A connected service that answers from SNAPSHOT and records cancels instead of sending them. */
function stubGateway(cancelled: number[]): void {
  const service = ibkrGatewayManager.getService(INSTANCE_ID) as any;
  service.getSnapshot = () => SNAPSHOT;
  service.subscribe = () => () => {};
  service.connect = async () => {};
  service.getAccounts = async () => SNAPSHOT.accounts;
  service.listOpenOrders = async () => SNAPSHOT.openOrders;
  service.listExecutions = async () => [];
  service.cancelOrder = async (_config: unknown, orderId: number) => { cancelled.push(orderId); };
}

function Harness() {
  const config = {
    ...createTestPaneConfig("/tmp/gloom-ibkr-gateway-console", { instanceId: PANE_ID, paneId: "ibkr-trading", binding: { kind: "none" } }),
    brokerInstances: [createGatewayInstance()],
  };
  const state = createInitialState(config);
  state.focusedPaneId = PANE_ID;
  return (
    <TestDialogProvider>
      <TestPaneProvider state={state} paneId={PANE_ID} pluginId="ibkr-gateway" runtime={createTestPluginRuntime()}>
        <PaneFooterProvider>
          {(footer) => (
            <Box width={84} height={20} flexDirection="column">
              <Box height={19}><TradingPane paneId={PANE_ID} paneType="ibkr-trading" focused width={84} height={19} /></Box>
              <PaneFooterBar footer={footer} width={84} focused />
            </Box>
          )}
        </PaneFooterProvider>
      </TestPaneProvider>
    </TestDialogProvider>
  );
}

afterEach(async () => {
  if (setup) {
    await act(async () => { setup!.renderer.destroy(); });
    setup = undefined;
  }
  clearTradingDraft();
  await ibkrGatewayManager.removeInstance(INSTANCE_ID);
});

test("asks before cancelling an open order and cancels only once confirmed", async () => {
  const cancelled: number[] = [];
  stubGateway(cancelled);

  await act(async () => { setup = await testRender(<Harness />, { width: 84, height: 20 }); });
  await settleFrame(setup!);
  expect(setup!.captureCharFrame()).toContain("[c]ancel");

  await emitKeypress(setup!, { name: "c", sequence: "c" });
  await settleFrame(setup!);
  expect(setup!.captureCharFrame()).toContain("Cancel order 42?");

  await emitKeypress(setup!, { name: "escape", sequence: "\u001b" });
  await settleFrame(setup!);
  expect(setup!.captureCharFrame()).not.toContain("Cancel order 42?");
  expect(cancelled).toEqual([]);

  await emitKeypress(setup!, { name: "c", sequence: "c" });
  await settleFrame(setup!);
  await emitKeypress(setup!, { name: "return", sequence: "\r" });
  await settleFrame(setup!);
  expect(cancelled).toEqual([42]);
});
