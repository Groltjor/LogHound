"use client";

const RULES_KEY = "log-hound-demo-firewall-rules";
const ATTACK_MODE_KEY = "log-hound-demo-attack-mode";

function readRules() {
  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(window.localStorage.getItem(RULES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function wait(ms = 420) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function activateAttackChallengeMode() {
  await wait(540);
  window.localStorage.setItem(ATTACK_MODE_KEY, "true");
  return { ok: true, mode: "attack-challenge", simulated: true };
}

export async function readLogHoundRuleset() {
  await wait();
  const conditions = readRules();
  const groupedRules = ["deny", "challenge"].flatMap((action) => {
    const actionRules = conditions.filter((rule) => rule.action === action);
    if (!actionRules.length) return [];

    return [
      {
        id: `demo-ruleset-${action}`,
        name: `Log-Hound-Rules | ${action.toUpperCase()}`,
        description: "Demo local: ninguna configuración externa fue modificada.",
        active: true,
        action,
        conditionGroups: actionRules.length,
      },
    ];
  });

  return {
    ok: true,
    exists: groupedRules.length > 0,
    rules: groupedRules,
    totalRules: groupedRules.length,
    firewallEnabled: true,
    attackModeEnabled: window.localStorage.getItem(ATTACK_MODE_KEY) === "true",
    simulated: true,
  };
}
