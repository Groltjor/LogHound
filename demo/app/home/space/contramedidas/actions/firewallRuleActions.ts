"use client";

const RULES_KEY = "log-hound-demo-firewall-rules";

type RuleAction = "deny" | "challenge";
type ConditionOperator = "eq" | "contains";

type DemoRule = {
  ruleId: string;
  ruleName: string;
  action: RuleAction;
  operator: ConditionOperator;
  apiOperator: "eq" | "sub";
  conditionValue: string;
  condition: string;
};

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

function readRules(): DemoRule[] {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RULES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRules(rules: DemoRule[]) {
  window.localStorage.setItem(RULES_KEY, JSON.stringify(rules));
  window.dispatchEvent(new CustomEvent("log-hound-demo-rules-change"));
}

function wait(ms = 420) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function listLogHoundAgentRules() {
  await wait(120);
  return { ok: true, rules: readRules(), simulated: true };
}

export async function deployAgentFirewallRule(input: DeployAgentRuleInput) {
  const conditionValue = input.conditionValue.trim();
  if (!conditionValue) throw new Error("Condition value is required.");

  await wait();
  const rules = readRules();
  const existing = rules.find(
    (rule) =>
      rule.action === input.ruleAction &&
      rule.operator === input.conditionOperator &&
      rule.conditionValue === conditionValue,
  );

  if (existing) {
    return {
      ok: true,
      mode: "exists",
      ruleName: existing.ruleName,
      condition: existing.condition,
      action: existing.action,
      simulated: true,
    };
  }

  const sameActionCount = rules.filter((rule) => rule.action === input.ruleAction).length;
  const apiOperator = input.conditionOperator === "contains" ? "sub" : "eq";
  const nextRule: DemoRule = {
    ruleId: `demo-${input.ruleAction}-${Date.now()}`,
    ruleName: `Log-Hound-Rules | ${input.ruleAction.toUpperCase()}`,
    action: input.ruleAction,
    operator: input.conditionOperator,
    apiOperator,
    conditionValue,
    condition: `user_agent ${input.conditionOperator} ${conditionValue}`,
  };

  writeRules([...rules, nextRule]);

  return {
    ok: true,
    mode: sameActionCount > 0 ? "updated" : "inserted",
    ruleId: nextRule.ruleId,
    ruleName: nextRule.ruleName,
    condition: nextRule.condition,
    apiCondition: `user_agent ${apiOperator} ${conditionValue}`,
    action: nextRule.action,
    conditionGroups: sameActionCount + 1,
    notes: [input.clientIp ? `ip=${input.clientIp}` : "", input.ja4Digest ? `ja4=${input.ja4Digest}` : ""].filter(Boolean),
    simulated: true,
  };
}

export async function removeAgentFirewallRule(input: RemoveAgentRuleInput) {
  await wait(320);
  const rules = readRules();
  const nextRules = rules.filter(
    (rule) =>
      !(
        rule.action === input.ruleAction &&
        rule.operator === input.conditionOperator &&
        rule.conditionValue === input.conditionValue
      ),
  );

  writeRules(nextRules);
  return {
    ok: true,
    mode: nextRules.length === rules.length ? "missing" : "removed-rule",
    condition: `user_agent ${input.conditionOperator} ${input.conditionValue}`,
    action: input.ruleAction,
    simulated: true,
  };
}
