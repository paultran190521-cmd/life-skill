type TeachingFrame = { periodLabel: string; start: string; end: string };

/** School source rows are teaching frames; a paired frame represents two lessons. */
export function schoolNeedPeriodCount(frame: TeachingFrame) {
  const start = /^([01]\d|2[0-3]):[0-5]\d$/.test(frame.start) ? Number(frame.start.slice(0, 2)) * 60 + Number(frame.start.slice(3)) : NaN;
  const end = /^([01]\d|2[0-3]):[0-5]\d$/.test(frame.end) ? Number(frame.end.slice(0, 2)) * 60 + Number(frame.end.slice(3)) : NaN;
  const duration = end - start;
  return duration >= 70 || /tiết\s*\d+\s*,\s*(?:tiết\s*)?\d+/i.test(frame.periodLabel) ? 2 : 1;
}

export function schoolNeedPeriodTotal(frames: TeachingFrame[]) {
  return frames.reduce((total, frame) => total + schoolNeedPeriodCount(frame), 0);
}
