type Sample = { name: string; ms: number };
let samples: Sample[] = [];
let pendingMenu: { name: string; start: number } | null = null;
export function recordPerformance(name: string, ms: number) {
  if (typeof window === "undefined" || !Number.isFinite(ms) || document.visibilityState !== "visible") return;
  samples = [...samples.slice(-99), { name, ms: Math.round(ms) }];
}
export function beginMenuTiming(name: string) {
  if (typeof performance !== "undefined") pendingMenu = { name, start: performance.now() };
}
export function finishMenuTiming(name: string) {
  if (pendingMenu?.name !== name) return;
  recordPerformance(`menu:${name}`, performance.now() - pendingMenu.start);
  pendingMenu = null;
}
export function performanceSummary() {
  const groups = new Map<string, number[]>();
  for (const sample of samples) groups.set(sample.name, [...(groups.get(sample.name) || []), sample.ms]);
  return [...groups].map(([name, values]) => {
    values.sort((a, b) => a - b);
    return { name, count: values.length, median: values[Math.floor(values.length / 2)], p95: values[Math.ceil(values.length * .95) - 1] };
  });
}
