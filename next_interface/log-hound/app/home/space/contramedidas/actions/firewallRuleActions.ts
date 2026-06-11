"use server";

import { Vercel } from "@vercel/sdk";

const LOG_HOUND_RULESET_NAME = "Log-Hound-Rules";
const LEGACY_LOG_HOUND_RULE_PREFIX = "LH |";
const LOG_HOUND_RULE_MARKER = "managed-by=log-hound";

type RuleAction = "deny" | "challenge";
type ConditionOperator = "eq" | "contains";
type VercelConditionOperator = "eq" | "sub";

type DeployAgentRuleInput = {
  ruleAction: RuleAction;
  conditionOperator: ConditionOperator;
  conditionValue: string;
  agentName?: string;
  clientIp?: string;
  ja4Digest?: string;
};

type RemoveAgentRuleInput = {
  ruleAction: RuleAction;
  conditionOperator: ConditionOperator;
  conditionValue: string;
};

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeAction(value: unknown): RuleAction {
  if (value === "deny" || value === "challenge") return value;
  throw new Error("Invalid firewall action. Expected deny or challenge.");
}

function normalizeOperator(value: unknown): {
  displayOperator: ConditionOperator;
  vercelOperator: VercelConditionOperator;
} {
  if (value === "eq") return { displayOperator: "eq", vercelOperator: "eq" };
  if (value === "contains") return { displayOperator: "contains", vercelOperator: "sub" };
  throw new Error("Invalid condition operator. Expected eq or contains.");
}

function compactName(value: string, maxLength = 82) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized;
}

function buildConditionGroup(vercelOperator: VercelConditionOperator, conditionValue: string) {
  return {
    conditions: [
      {
        type: "user_agent" as const,
        op: vercelOperator,
        value: conditionValue,
      },
    ],
  };
}

function getConditionGroups(rule: unknown) {
  if (!isRecord(rule) || !Array.isArray(rule.conditionGroup)) return [];

  return rule.conditionGroup.filter((group) => {
    if (!isRecord(group) || !Array.isArray(group.conditions)) return false;

    return group.conditions.some((condition) => {
      return isRecord(condition) && condition.type === "user_agent";
    });
  });
}

function hasCondition(rule: unknown, vercelOperator: VercelConditionOperator, conditionValue: string) {
  const groups = getConditionGroups(rule);

  for (const group of groups) {
    if (!isRecord(group) || !Array.isArray(group.conditions)) continue;

    for (const condition of group.conditions) {
      if (!isRecord(condition)) continue;
      if (condition.type === "user_agent" && condition.op === vercelOperator && condition.value === conditionValue) {
        return true;
      }
    }
  }

  return false;
}

function getRuleConditions(rule: unknown, ruleAction: RuleAction) {
  const groups = getConditionGroups(rule);
  const ruleId = isRecord(rule) && typeof rule.id === "string" ? rule.id : "";
  const ruleName = isRecord(rule) && typeof rule.name === "string" ? rule.name : getAggregateRuleName(ruleAction);

  return groups.flatMap((group) => {
    if (!isRecord(group) || !Array.isArray(group.conditions)) return [];

    return group.conditions
      .filter((condition): condition is Record<string, unknown> => isRecord(condition) && condition.type === "user_agent")
      .map((condition) => {
        const apiOperator = condition.op === "sub" ? "sub" : "eq";
        const operator: ConditionOperator = apiOperator === "sub" ? "contains" : "eq";
        const value = typeof condition.value === "string" ? condition.value : "";

        return {
          ruleId,
          ruleName,
          action: ruleAction,
          operator,
          apiOperator,
          conditionValue: value,
          condition: `user_agent ${operator} ${value}`,
        };
      })
      .filter((condition) => condition.conditionValue);
  });
}

function getLogHoundAction(rule: unknown): RuleAction | null {
  const action = getMitigateAction(rule);
  if (action === "deny" || action === "challenge") return action;
  return null;
}

function getMitigateAction(rule: unknown) {
  if (!isRecord(rule) || !isRecord(rule.action) || !isRecord(rule.action.mitigate)) return "";
  return typeof rule.action.mitigate.action === "string" ? rule.action.mitigate.action : "";
}

function getRuleText(rule: unknown) {
  if (!isRecord(rule)) return "";

  const id = typeof rule.id === "string" ? rule.id : "";
  const name = typeof rule.name === "string" ? rule.name : "";
  const description = typeof rule.description === "string" ? rule.description : "";

  return `${id} ${name} ${description}`.toLowerCase();
}

function getAggregateRuleName(ruleAction: RuleAction) {
  return `${LOG_HOUND_RULESET_NAME} | ${ruleAction.toUpperCase()}`;
}

function isLogHoundRule(rule: unknown) {
  const ruleText = getRuleText(rule);
  return (
    ruleText.includes(LOG_HOUND_RULE_MARKER) ||
    ruleText.includes(LOG_HOUND_RULESET_NAME.toLowerCase()) ||
    ruleText.includes(LEGACY_LOG_HOUND_RULE_PREFIX.toLowerCase())
  );
}

function findAggregateRule(config: unknown, ruleAction: RuleAction) {
  if (!isRecord(config) || !Array.isArray(config.rules)) return null;

  const aggregateRuleName = getAggregateRuleName(ruleAction).toLowerCase();

  return (
    config.rules.find((rule) => {
      if (!isRecord(rule) || typeof rule.id !== "string") return false;
      return isLogHoundRule(rule) && getRuleText(rule).includes(aggregateRuleName) && getMitigateAction(rule) === ruleAction;
    }) || null
  );
}

function findRemovableRule(
  config: unknown,
  ruleAction: RuleAction,
  vercelOperator: VercelConditionOperator,
  conditionValue: string,
) {
  if (!isRecord(config) || !Array.isArray(config.rules)) return null;

  return (
    config.rules.find((rule) => {
      if (!isRecord(rule) || typeof rule.id !== "string") return false;
      return isLogHoundRule(rule) && getMitigateAction(rule) === ruleAction && hasCondition(rule, vercelOperator, conditionValue);
    }) || null
  );
}

function getVercelClient() {
  const bearerToken = requireEnv("WAF_DEFENDER");
  return new Vercel({ bearerToken });
}

function getProjectContext() {
  const projectId = requireEnv("PROJECT_ID");
  const teamId = requireEnv("TEAM_ID");
  const teamSlug = process.env.TEAM_URL;

  return {
    projectId,
    teamId,
    ...(teamSlug ? { slug: teamSlug } : {}),
  };
}

export async function listLogHoundAgentRules() {
  const vercel = getVercelClient();
  const projectContext = getProjectContext();
  const currentConfig = await vercel.security.getFirewallConfig({
    ...projectContext,
    configVersion: "active",
  });

  const rules = isRecord(currentConfig) && Array.isArray(currentConfig.rules) ? currentConfig.rules : [];
  const agentRules = rules.flatMap((rule) => {
    if (!isLogHoundRule(rule)) return [];

    const action = getLogHoundAction(rule);
    if (!action) return [];

    return getRuleConditions(rule, action);
  });

  return {
    ok: true,
    rules: agentRules,
  };
}

export async function deployAgentFirewallRule(input: DeployAgentRuleInput) {
  const vercel = getVercelClient();
  const projectContext = getProjectContext();
  const ruleAction = normalizeAction(input.ruleAction);
  const { displayOperator, vercelOperator } = normalizeOperator(input.conditionOperator);
  const conditionValue = normalizeString(input.conditionValue);

  if (!conditionValue) {
    throw new Error("Condition value is required.");
  }

  const clientIp = normalizeString(input.clientIp);
  const ja4Digest = normalizeString(input.ja4Digest);
  const currentConfig = await vercel.security.getFirewallConfig({
    ...projectContext,
    configVersion: "active",
  });
  const aggregateRule = findAggregateRule(currentConfig, ruleAction);
  const aggregateRuleHasCondition = hasCondition(aggregateRule, vercelOperator, conditionValue);
  const existingConditionGroups = getConditionGroups(aggregateRule);
  const ruleName = getAggregateRuleName(ruleAction);
  const descriptionParts = [
    LOG_HOUND_RULE_MARKER,
    `ruleset=${LOG_HOUND_RULESET_NAME}`,
    "target=user_agent",
    "mode=or-condition-groups",
  ].filter(Boolean);
  const ruleValue = {
    name: compactName(ruleName, 96),
    description: descriptionParts.join("; "),
    active: true,
    conditionGroup: aggregateRuleHasCondition
      ? existingConditionGroups
      : [...existingConditionGroups, buildConditionGroup(vercelOperator, conditionValue)],
    action: {
      mitigate: {
        action: ruleAction,
      },
    },
  };

  if (!aggregateRuleHasCondition) {
    await vercel.security.updateFirewallConfig({
      ...projectContext,
      requestBody: aggregateRule
        ? {
            action: "rules.update",
            id: aggregateRule.id as string,
            value: ruleValue,
          }
        : {
            action: "rules.insert",
            value: ruleValue,
          },
    });
  }

  return {
    ok: true,
    mode: aggregateRuleHasCondition ? "exists" : aggregateRule ? "updated" : "inserted",
    ruleId: isRecord(aggregateRule) && typeof aggregateRule.id === "string" ? aggregateRule.id : null,
    ruleName: ruleValue.name,
    condition: `user_agent ${displayOperator} ${conditionValue}`,
    apiCondition: `user_agent ${vercelOperator} ${conditionValue}`,
    action: ruleAction,
    conditionGroups: ruleValue.conditionGroup.length,
    notes: [clientIp ? `ip=${clientIp}` : "", ja4Digest ? `ja4=${ja4Digest}` : ""].filter(Boolean),
  };
}

export async function removeAgentFirewallRule(input: RemoveAgentRuleInput) {
  const vercel = getVercelClient();
  const projectContext = getProjectContext();
  const ruleAction = normalizeAction(input.ruleAction);
  const { displayOperator, vercelOperator } = normalizeOperator(input.conditionOperator);
  const conditionValue = normalizeString(input.conditionValue);

  if (!conditionValue) {
    throw new Error("Condition value is required.");
  }

  const currentConfig = await vercel.security.getFirewallConfig({
    ...projectContext,
    configVersion: "active",
  });
  const rule = findRemovableRule(currentConfig, ruleAction, vercelOperator, conditionValue);

  if (!isRecord(rule) || typeof rule.id !== "string") {
    return {
      ok: true,
      mode: "missing",
      condition: `user_agent ${displayOperator} ${conditionValue}`,
      action: ruleAction,
    };
  }

  const remainingGroups = getConditionGroups(rule).filter((group) => {
    if (!isRecord(group) || !Array.isArray(group.conditions)) return true;

    return !group.conditions.some((condition) => {
      return (
        isRecord(condition) &&
        condition.type === "user_agent" &&
        condition.op === vercelOperator &&
        condition.value === conditionValue
      );
    });
  });

  if (remainingGroups.length === 0) {
    await vercel.security.updateFirewallConfig({
      ...projectContext,
      requestBody: {
        action: "rules.remove",
        id: rule.id,
      },
    });

    return {
      ok: true,
      mode: "removed-rule",
      condition: `user_agent ${displayOperator} ${conditionValue}`,
      action: ruleAction,
    };
  }

  await vercel.security.updateFirewallConfig({
    ...projectContext,
    requestBody: {
      action: "rules.update",
      id: rule.id,
      value: {
        name: typeof rule.name === "string" ? rule.name : getAggregateRuleName(ruleAction),
        description:
          typeof rule.description === "string"
            ? rule.description
            : `${LOG_HOUND_RULE_MARKER}; ruleset=${LOG_HOUND_RULESET_NAME}; target=user_agent; mode=or-condition-groups`,
        active: typeof rule.active === "boolean" ? rule.active : true,
        conditionGroup: remainingGroups,
        action: {
          mitigate: {
            action: ruleAction,
          },
        },
      },
    },
  });

  return {
    ok: true,
    mode: "removed-condition",
    condition: `user_agent ${displayOperator} ${conditionValue}`,
    action: ruleAction,
  };
}
