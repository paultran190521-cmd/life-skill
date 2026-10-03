export function activityHasEnded(date: string, endTime: string | undefined, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (name: string) => parts.find((item) => item.type === name)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return date < today || (date === today && (!endTime || endTime <= `${part("hour")}:${part("minute")}`));
}
