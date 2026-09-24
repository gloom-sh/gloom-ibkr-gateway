import type { QueryBarSelectFilter, SelectButtonOption } from "gloomberb/components";
import type { BrokerInstanceConfig } from "gloomberb/types/config";
import type { BrokerAccount } from "gloomberb/types/trading";
import { formatCurrency } from "gloomberb/utils";

/**
 * The Gateway profile the console and the ticket trade through, as a query bar
 * choice. A portfolio managed by one profile locks the others out.
 */
export function buildProfileFilter({
  gatewayInstances,
  selectedInstance,
  lockedBrokerInstanceId,
  onChange,
  controlRef,
}: {
  gatewayInstances: BrokerInstanceConfig[];
  selectedInstance?: BrokerInstanceConfig;
  lockedBrokerInstanceId?: string;
  onChange: (instanceId: string) => void;
  controlRef?: QueryBarSelectFilter["controlRef"];
}): QueryBarSelectFilter {
  const options: SelectButtonOption[] = gatewayInstances.map((instance) => ({
    value: instance.id,
    label: instance.label,
    disabled: lockedBrokerInstanceId != null && instance.id !== lockedBrokerInstanceId,
  }));
  if (selectedInstance && !options.some((option) => option.value === selectedInstance.id)) {
    options.unshift({ value: selectedInstance.id, label: selectedInstance.label });
  }
  return {
    id: "profile",
    label: "Profile",
    value: selectedInstance?.id ?? "",
    options,
    onChange,
    controlRef,
  };
}

/** The IBKR account orders go to, with each account's net liquidation beside it in the menu. */
export function buildAccountFilter({
  accounts,
  accountId,
  lockedAccountId,
  onChange,
  controlRef,
}: {
  accounts: BrokerAccount[];
  accountId?: string;
  lockedAccountId?: string;
  onChange: (accountId: string) => void;
  controlRef?: QueryBarSelectFilter["controlRef"];
}): QueryBarSelectFilter {
  const options: SelectButtonOption[] = accounts.map((account) => ({
    value: account.accountId,
    label: account.accountId,
    description: `${formatCurrency(account.netLiquidation || 0, account.currency || "USD")} net liq`,
    disabled: lockedAccountId != null && account.accountId !== lockedAccountId,
  }));
  if (accountId && !options.some((option) => option.value === accountId)) {
    options.unshift({ value: accountId, label: accountId });
  }
  if (!accountId) {
    options.unshift({ value: "", label: "None", disabled: true });
  }
  return {
    id: "account",
    label: "Account",
    value: accountId ?? "",
    options,
    onChange,
    controlRef,
  };
}
