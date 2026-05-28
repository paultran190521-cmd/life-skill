import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const baseUrl = args.baseUrl || process.env.BENCHMARK_BASE_URL || "http://localhost:3000";
const route = args.route || "/api/schedules";
const runs = toPositiveInt(args.runs || process.env.BENCHMARK_RUNS, 5);
const payloadPath = args.payload || process.env.BENCHMARK_PAYLOAD_PATH;
const authCookie = args.cookie || process.env.BENCHMARK_AUTH_COOKIE || "";

if (!payloadPath) {
  console.error("Missing payload template. Use --payload <path> or BENCHMARK_PAYLOAD_PATH.");
  process.exit(1);
}

const payloadTemplate = JSON.parse(await readFile(resolve(payloadPath), "utf8"));
const latencies = [];
const failures = [];

for (let index = 0; index < runs; index += 1) {
  const payload = shiftDates(payloadTemplate, index + 1);
  const url = `${baseUrl}${route}`;
  const start = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authCookie ? { Cookie: authCookie } : {}),
    },
    body: JSON.stringify(payload),
  });
  const duration = Math.round(performance.now() - start);
  latencies.push(duration);

  if (!response.ok) {
    const body = await response.text();
    failures.push({
      run: index + 1,
      status: response.status,
      duration,
      body: body.slice(0, 500),
    });
  }
}

const summary = {
  baseUrl,
  route,
  runs,
  success: runs - failures.length,
  failures: failures.length,
  latencyMs: {
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    max: Math.max(...latencies),
    min: Math.min(...latencies),
  },
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) {
  console.log("failureSamples:");
  console.log(JSON.stringify(failures.slice(0, 3), null, 2));
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) {
      continue;
    }
    parsed[key.slice(2)] = argv[i + 1];
    i += 1;
  }
  return parsed;
}

function toPositiveInt(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function percentile(values, p) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(rank, sorted.length - 1))];
}

function shiftDates(template, offsetDays) {
  const clone = JSON.parse(JSON.stringify(template));
  shiftDateOnObject(clone, "date", offsetDays);
  if (Array.isArray(clone.items)) {
    clone.items.forEach((item) => {
      shiftDateOnObject(item, "date", offsetDays);
      shiftDateOnObject(item, "day", offsetDays);
    });
  }
  return clone;
}

function shiftDateOnObject(target, key, offsetDays) {
  const raw = String(target?.[key] || "").trim();
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return;
  }
  const date = new Date(`${raw}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  target[key] = date.toISOString().slice(0, 10);
}
