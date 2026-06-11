"use server";

import { Vercel } from "@vercel/sdk";

const LOG_HOUND_RULESET_NAME = "Log-Hound-Rules";
const LOG_HOUND_RULE_PREFIX = "LH |";
const LOG_HOUND_RULE_MARKER = "managed-by=log-hound";

function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }

  return value;
}

export async function activateAttackChallengeMode() {
  const bearerToken = requireEnv("WAF_DEFENDER");
  const projectId = requireEnv("PROJECT_ID");
  const teamId = requireEnv("TEAM_ID");

  const vercel = new Vercel({ bearerToken });

  await vercel.security.updateAttackChallengeMode({
    teamId,
    requestBody: {
      projectId,
      attackModeEnabled: true,
    },
  });

  return {
    ok: true,
    mode: "attack-challenge",
  };
}

export async function readFirewallConfig() {
  const bearerToken = requireEnv("WAF_DEFENDER");
  const projectId = requireEnv("PROJECT_ID");
  const teamId = requireEnv("TEAM_ID");

  const vercel = new Vercel({ bearerToken });

  const result = await vercel.security.getFirewallConfig({
    projectId,
    teamId,
    configVersion: "active",
  });

  return {
    ok: true,
    config: result,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getRuleText(rule: unknown) {
  if (!isRecord(rule)) return "";

  const name = typeof rule.name === "string" ? rule.name : "";
  const description = typeof rule.description === "string" ? rule.description : "";
  const id = typeof rule.id === "string" ? rule.id : "";

  return `${id} ${name} ${description}`;
}

function getLogHoundRules(config: unknown) {
  if (!isRecord(config) || !Array.isArray(config.rules)) return [];

  return config.rules
    .filter((rule) => {
      const ruleText = getRuleText(rule).toLowerCase();
      return (
        ruleText.includes(LOG_HOUND_RULE_MARKER) ||
        ruleText.includes(LOG_HOUND_RULESET_NAME.toLowerCase()) ||
        ruleText.includes(LOG_HOUND_RULE_PREFIX.toLowerCase())
      );
    })
    .map((rule, index) => {
      const safeRule = isRecord(rule) ? rule : {};
      const action = isRecord(safeRule.action) && isRecord(safeRule.action.mitigate)
        ? safeRule.action.mitigate.action
        : undefined;

      return {
        id: typeof safeRule.id === "string" ? safeRule.id : `log-hound-rule-${index}`,
        name: typeof safeRule.name === "string" ? safeRule.name : `Log Hound rule ${index + 1}`,
        description: typeof safeRule.description === "string" ? safeRule.description : "",
        active: typeof safeRule.active === "boolean" ? safeRule.active : null,
        action: typeof action === "string" ? action : "unknown",
        conditionGroups: Array.isArray(safeRule.conditionGroup) ? safeRule.conditionGroup.length : 0,
      };
    });
}

export async function readLogHoundRuleset() {
  const { config } = await readFirewallConfig();
  const rules = getLogHoundRules(config);

  return {
    ok: true,
    exists: rules.length > 0,
    rules,
    totalRules: isRecord(config) && Array.isArray(config.rules) ? config.rules.length : 0,
    firewallEnabled: isRecord(config) && typeof config.firewallEnabled === "boolean" ? config.firewallEnabled : null,
  };
}
