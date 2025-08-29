export function getTimeDifference(from: Date, to: Date = new Date()): [number, string] {
  const difference = Math.round((from.getTime() - to.getTime()) / 1000);
  const abs = Math.abs(difference);
  if (abs < 60) return [difference, "second"];
  if (abs < 3600) return [Math.round(difference / 60), "minute"];
  if (abs < 86400) return [Math.round(difference / 3600), "hour"];
  if (abs < 604800) return [Math.round(difference / 86400), "day"];
  if (abs < 2629800) return [Math.round(difference / 604800), "week"];
  if (abs < 31557600) return [Math.round(difference / 2629800), "month"];
  return [Math.round(difference / 31557600), "year"];
}

export function formatRelativeTime(date: Date, now: Date = new Date()): string {
  const [diff, unit] = getTimeDifference(date, now);
  if (unit === "second") return "seconds ago";
  const absDiff = Math.abs(diff);
  const suffix = diff < 0 ? ' ago' : ' from now';
  return `${absDiff} ${unit}${absDiff !== 1 ? 's' : ''}${suffix}`;
}
