import type { AppConfig } from "gloomberb/types/config";
import type { BrokerAccount } from "gloomberb/types/trading";
import { getBrokerInstance } from "gloomberb/utils";
import { normalizeIbkrConfig } from "gloom-ibkr/config";
import { ibkrGatewayManager } from "./service";
import {
  getConfiguredIbkrGatewayInstances,
  getConfiguredIbkrTradingInstances,
  getLockedIbkrTradingInstanceId,
  resolveIbkrTradingInstanceId,
} from "gloom-ibkr/instance-selection";
import {
  getGatewayRequiredMessage,
  useGatewaySnapshot,
} from "./helpers";
import { getKnownIbkrAccounts } from "../trade/utils";

export function useIbkrGatewaySelection(
  config: AppConfig,
  brokerAccounts: Record<string, BrokerAccount[]>,
  collectionId: string | null | undefined,
  preferredInstanceId?: string,
  { includeCloud = false }: { includeCloud?: boolean } = {},
) {
  const activePortfolio = config.portfolios.find((portfolio) => portfolio.id === collectionId);
  // The Trade tab also takes sign-in profiles, whose orders open in IBKR for review; the console needs a Gateway.
  const gatewayInstances = includeCloud ? getConfiguredIbkrTradingInstances(config) : getConfiguredIbkrGatewayInstances(config);
  const lockedBrokerInstanceId = getLockedIbkrTradingInstanceId(config, collectionId ?? null, { includeCloud });
  const selectedBrokerInstanceId = resolveIbkrTradingInstanceId(config, collectionId ?? null, preferredInstanceId, { includeCloud });
  const selectedInstance = getBrokerInstance(config.brokerInstances, selectedBrokerInstanceId);
  const normalizedConfig = selectedInstance ? normalizeIbkrConfig(selectedInstance.config) : null;
  const isGatewayMode = selectedInstance != null && normalizedConfig?.connectionMode === "gateway";
  const isCloudMode = selectedInstance != null && normalizedConfig?.connectionMode === "cloud";
  const gatewayInstanceId = isCloudMode ? undefined : selectedBrokerInstanceId;
  const gatewaySnapshot = useGatewaySnapshot(gatewayInstanceId);
  const gatewayService = gatewayInstanceId ? ibkrGatewayManager.getService(gatewayInstanceId) : null;
  const availableAccounts = getKnownIbkrAccounts(
    brokerAccounts,
    selectedBrokerInstanceId,
    gatewaySnapshot.accounts,
  );

  return {
    activePortfolio,
    gatewayInstances,
    lockedBrokerInstanceId,
    selectedBrokerInstanceId,
    selectedInstance,
    gatewaySnapshot,
    gatewayService,
    normalizedConfig,
    isGatewayMode,
    isCloudMode,
    availableAccounts,
    gatewayRequiredMessage: getGatewayRequiredMessage(gatewayInstances.length, includeCloud),
  };
}
