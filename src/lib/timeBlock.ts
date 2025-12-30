export function getBlockStartUTC(date: Date = new Date()): Date {
  const d = new Date(date.getTime());
  const minutes = d.getUTCMinutes();
  const floored = minutes < 30 ? 0 : 30;
  d.setUTCMinutes(floored, 0, 0);
  return d;
}

export function secondsToNextBlock(date: Date = new Date()): number {
  const d = new Date(date.getTime());
  const minutes = d.getUTCMinutes();
  const nextMinutes = minutes < 30 ? 30 : 60;

  const next = new Date(d.getTime());
  next.setUTCMinutes(nextMinutes, 0, 0);
  if (nextMinutes === 60) {
    next.setUTCHours(d.getUTCHours() + 1);
    next.setUTCMinutes(0, 0, 0);
  }

  const diffMs = next.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

