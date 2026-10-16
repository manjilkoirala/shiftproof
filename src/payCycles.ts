import { DateTime } from "luxon";
import { Job, Shift, period, portions } from "./domain";

export function movePeriod(
  job: Job,
  from: string,
  to: string,
  direction: -1 | 1,
) {
  return period(
    job,
    DateTime.fromISO(direction === -1 ? from : to, { zone: "UTC" })
      .plus({ days: direction })
      .toISODate()!,
  );
}
export function cycleHistory(
  job: Job,
  shifts: Shift[],
  reference: string,
  limit: number,
) {
  const dates = shifts
    .filter((s) => s.jobId === job.id)
    .flatMap((s) => portions(s).map((p) => p.date));
  const earliest = dates.reduce((a, b) => (a < b ? a : b), reference);
  let cursor = period(job, reference);
  const rows: ReturnType<typeof period>[] = [];
  for (let i = 0; i < limit && cursor.to >= earliest; i++) {
    rows.push(cursor);
    cursor = movePeriod(job, cursor.from, cursor.to, -1);
  }
  return { rows, hasMore: cursor.to >= earliest };
}
