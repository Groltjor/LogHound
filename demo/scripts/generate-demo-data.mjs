import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const outputPath = join(scriptDirectory, "..", "public", "data", "demo-predictions.json");

let seed = 0x1a2b3c4d;
function random() {
  seed = (1664525 * seed + 1013904223) >>> 0;
  return seed / 4294967296;
}

function between(min, max) {
  return Math.round(min + random() * (max - min));
}

function decimal(min, max, digits = 6) {
  return Number((min + random() * (max - min)).toFixed(digits));
}

const profiles = [
  {
    label: 0,
    requests: [8, 28],
    uniqueRoutes: [4, 18],
    activityWindow: [180_000, 760_000],
    cadence: [18_000, 74_000],
    distance: [0.18, 1.15],
    oneShot: false,
    agents: [
      "Mozilla/5.0 (Demo Desktop) AppleWebKit/537.36 Chrome/126.0 Safari/537.36",
      "Mozilla/5.0 (Demo Mobile) AppleWebKit/537.36 Mobile Safari/537.36",
      "ResearchIndexer/2.4 (+https://example.invalid/bot)",
    ],
  },
  {
    label: 1,
    requests: [1, 1],
    uniqueRoutes: [1, 1],
    activityWindow: [0, 0],
    cadence: [0, 0],
    distance: [0.002, 0.04],
    oneShot: true,
    agents: [
      "Mozilla/5.0 (Demo Browser) AppleWebKit/537.36 Chrome/125.0 Safari/537.36",
      "LinkPreview-Demo/1.0 (+https://example.invalid/preview)",
      "HealthCheck-Demo/3.1",
    ],
  },
  {
    label: 2,
    requests: [2, 7],
    uniqueRoutes: [1, 4],
    activityWindow: [360_000, 1_440_000],
    cadence: [95_000, 360_000],
    distance: [0.7, 1.8],
    oneShot: false,
    agents: [
      "ArchiveObserver/1.8 (+https://example.invalid/archive)",
      "Mozilla/5.0 (Demo Tablet) AppleWebKit/537.36 Safari/605.1",
      "StatusMonitor-Demo/2.0",
    ],
  },
  {
    label: 3,
    requests: [48, 132],
    uniqueRoutes: [28, 86],
    activityWindow: [420_000, 1_080_000],
    cadence: [2_400, 11_000],
    distance: [0.45, 2.4],
    oneShot: false,
    agents: [
      "DemoCrawler/4.2 (+https://example.invalid/bot)",
      "SyntheticSearchBot/7.0 (+https://example.invalid/crawler)",
      "AggressiveIndexer-Demo/5.6",
    ],
  },
];

const documentationNetworks = ["192.0.2", "198.51.100", "203.0.113"];
const records = [];
const baseTime = Date.parse("2026-07-20T18:00:00Z");

for (const profile of profiles) {
  for (let index = 0; index < 54; index += 1) {
    const requests = between(...profile.requests);
    const uniqueRoutes = Math.min(requests, between(...profile.uniqueRoutes));
    const activityWindow = between(...profile.activityWindow);
    const meanCadence = between(...profile.cadence);
    const identityIndex = index % 18;
    const network = documentationNetworks[(profile.label + identityIndex) % documentationNetworks.length];
    const host = 10 + ((profile.label * 57 + identityIndex * 7) % 230);
    const agentIndex = (index + profile.label) % profile.agents.length;
    const ja4Family = (index + profile.label * 2) % 6;
    const timestamp = new Date(baseTime + (profile.label * 60 + index) * 600_000).toISOString();

    records.push({
      ja4Digest: `demo_ja4_l${profile.label}_${String(ja4Family + 1).padStart(2, "0")}`,
      time_window: timestamp,
      "proxy.userAgent": profile.agents[agentIndex],
      "proxy.clientIp": `${network}.${host}`,
      label: profile.label,
      distancias: decimal(...profile.distance),
      conteo_requests: requests,
      times_timestamp: requests,
      request_amount: requests,
      routes_visited: requests,
      unique_routes: uniqueRoutes,
      activity_window_ms: activityWindow,
      mean_time_between_requests_ms: meanCadence,
      median_time_between_requests_ms: meanCadence ? Math.max(1, Math.round(meanCadence * decimal(0.76, 1.18, 3))) : 0,
      is_one_shot: profile.oneShot,
    });
  }
}

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
console.log(`Generated ${records.length} synthetic records at ${outputPath}`);
