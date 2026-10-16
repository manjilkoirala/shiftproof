import { DateTime } from "luxon";

export type Cycle = "weekly" | "biweekly" | "fourweekly" | "monthly";
export type Currency = "GBP" | "EUR" | "USD" | "NPR";
export interface Preset {
  id: string;
  name: string;
  hours: number;
  start: string;
  breakMinutes: number;
}
export interface Job {
  id: string;
  title: string;
  employer: string;
  currency: Currency;
  rate: number;
  overtimeRate: number;
  cycle: Cycle;
  anchor: string;
  zone: string;
  color: string;
  notes: string;
  presets: Preset[];
  archived: boolean;
}
export interface Shift {
  id: string;
  jobId: string;
  date: string;
  title: string;
  mode: "hours" | "times";
  hours: number;
  start: string;
  end: string;
  nextDay: boolean;
  breakMinutes: number;
  overtimeMinutes: number;
  rate: number;
  overtimeRate: number;
  currency: Currency;
  zone: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
export interface Comparison {
  id: string;
  jobId: string;
  from: string;
  to: string;
  hours: number;
  gross: number;
  notes: string;
}
export interface Data {
  version: 1;
  jobs: Job[];
  shifts: Shift[];
  comparisons: Comparison[];
}
export const emptyData: Data = {
  version: 1,
  jobs: [],
  shifts: [],
  comparisons: [],
};
export const cycles: Record<Cycle, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  fourweekly: "Every 4 weeks",
  monthly: "Monthly",
};
export const colors = ["#147D69", "#5476C5", "#BA7740", "#9164B4", "#C75B76"];
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
export const today = () => DateTime.local().toISODate()!;
export const money = (minor: number, currency: Currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(
    minor / 100,
  );
export const hoursText = (minutes: number) =>
  (minutes / 60).toLocaleString("en-GB", { maximumFractionDigits: 2 });
export function requireValue(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
export function validDate(value: string) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    DateTime.fromISO(value).isValid
  );
}
function numberIn(value: number, min: number, max: number) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  );
}
function text(value: unknown, max = 10000) {
  return typeof value === "string" && value.length <= max;
}
export function validateJob(j: Job) {
  requireValue(
    text(j.id) && !!j.id && text(j.title, 100) && !!j.title.trim(),
    "Give your job a title (up to 100 characters).",
  );
  requireValue(
    text(j.employer) &&
      text(j.notes) &&
      typeof j.archived === "boolean" &&
      /^#[0-9a-f]{6}$/i.test(j.color),
    "Invalid job details.",
  );
  requireValue(
    ["GBP", "EUR", "USD", "NPR"].includes(j.currency),
    "Choose a supported currency.",
  );
  requireValue(
    Number.isInteger(j.rate) &&
      numberIn(j.rate, 0, 10000000) &&
      Number.isInteger(j.overtimeRate) &&
      numberIn(j.overtimeRate, 0, 10000000),
    "Enter valid hourly and overtime rates.",
  );
  requireValue(
    Object.keys(cycles).includes(j.cycle) && validDate(j.anchor),
    "Enter a valid pay-period start date (YYYY-MM-DD).",
  );
  requireValue(
    text(j.zone) && DateTime.now().setZone(j.zone).isValid,
    "Enter a valid time zone, such as Europe/London.",
  );
  requireValue(
    Array.isArray(j.presets) && j.presets.length <= 50,
    "A job can have up to 50 shift presets.",
  );
  const ids = new Set<string>();
  j.presets.forEach((p) => {
    requireValue(
      text(p.id) &&
        !!p.id &&
        !ids.has(p.id) &&
        text(p.name, 100) &&
        !!p.name.trim(),
      "Every preset needs a unique ID and a name.",
    );
    ids.add(p.id);
    requireValue(
      numberIn(p.hours, 0.01, 24) &&
        Number.isInteger(p.breakMinutes) &&
        numberIn(p.breakMinutes, 0, 1440) &&
        p.breakMinutes < p.hours * 60,
      "Preset hours must be greater than its unpaid break and no more than 24 hours.",
    );
    requireValue(
      /^([01]\d|2[0-3]):[0-5]\d$/.test(p.start),
      "Preset start times must use HH:mm.",
    );
  });
}
export function shiftInterval(s: Shift) {
  const start = DateTime.fromISO(`${s.date}T${s.start}`, { zone: s.zone });
  const endDate = DateTime.fromISO(s.date)
    .plus({ days: s.nextDay ? 1 : 0 })
    .toISODate();
  const end = DateTime.fromISO(`${endDate}T${s.end}`, { zone: s.zone });
  requireValue(
    start.isValid &&
      end.isValid &&
      start.toFormat("HH:mm") === s.start &&
      end.toFormat("HH:mm") === s.end,
    "That clock time does not exist in this time zone. Choose another time.",
  );
  requireValue(
    start.getPossibleOffsets().length === 1 &&
      end.getPossibleOffsets().length === 1,
    "This clock time occurs twice during a daylight-saving change. Use hours entry with the actual elapsed hours.",
  );
  return { start, end };
}
export function calculate(s: Shift) {
  let elapsed = Math.round(s.hours * 60);
  if (s.mode === "times") {
    const { start, end } = shiftInterval(s);
    elapsed = Math.round(end.diff(start, "minutes").minutes);
  }
  requireValue(
    numberIn(elapsed, 1, 1500),
    "Shift duration must be between 1 minute and 25 hours.",
  );
  requireValue(
    Number.isInteger(s.breakMinutes) &&
      numberIn(s.breakMinutes, 0, elapsed - 1),
    "Unpaid break must be shorter than the shift.",
  );
  const minutes = elapsed - s.breakMinutes;
  requireValue(
    Number.isInteger(s.overtimeMinutes) &&
      numberIn(s.overtimeMinutes, 0, minutes),
    "Overtime cannot exceed paid hours.",
  );
  const gross = Math.round(
    ((minutes - s.overtimeMinutes) * s.rate +
      s.overtimeMinutes * s.overtimeRate) /
      60,
  );
  return { minutes, gross, elapsed };
}
export function validateShift(s: Shift) {
  requireValue(
    text(s.id) &&
      !!s.id &&
      text(s.jobId) &&
      text(s.title, 100) &&
      text(s.notes) &&
      validDate(s.date),
    "Check the shift title and date (YYYY-MM-DD).",
  );
  requireValue(
    ["hours", "times"].includes(s.mode) &&
      numberIn(s.hours, 0, 25) &&
      typeof s.nextDay === "boolean",
    "Invalid shift duration.",
  );
  requireValue(
    /^([01]\d|2[0-3]):[0-5]\d$/.test(s.start) &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(s.end),
    "Use HH:mm for start and finish times.",
  );
  requireValue(
    ["GBP", "EUR", "USD", "NPR"].includes(s.currency) &&
      text(s.zone) &&
      DateTime.now().setZone(s.zone).isValid,
    "Invalid shift currency or time zone.",
  );
  requireValue(
    Number.isInteger(s.rate) &&
      numberIn(s.rate, 0, 10000000) &&
      Number.isInteger(s.overtimeRate) &&
      numberIn(s.overtimeRate, 0, 10000000),
    "Enter valid pay rates.",
  );
  requireValue(
    text(s.createdAt) &&
      DateTime.fromISO(s.createdAt).isValid &&
      text(s.updatedAt) &&
      DateTime.fromISO(s.updatedAt).isValid,
    "Invalid record timestamps.",
  );
  calculate(s);
}
// Clock-based shifts split at local midnight. Breaks, overtime and rounded pay
// are allocated proportionally because break/OT clock positions are not recorded.
export function portions(
  s: Shift,
): { date: string; minutes: number; gross: number }[] {
  const total = calculate(s);
  if (s.mode === "hours") return [{ date: s.date, ...total }];
  const { start, end } = shiftInterval(s);
  const result: { date: string; minutes: number; gross: number }[] = [];
  let cursor = start,
    assignedMinutes = 0,
    assignedGross = 0;
  while (cursor < end) {
    const boundary = cursor.startOf("day").plus({ days: 1 });
    const until = boundary < end ? boundary : end;
    const fraction =
      until.diff(start).milliseconds / end.diff(start).milliseconds;
    const cumulativeMinutes = Math.round(total.minutes * fraction),
      cumulativeGross = Math.round(total.gross * fraction);
    result.push({
      date: cursor.toISODate()!,
      minutes: cumulativeMinutes - assignedMinutes,
      gross: cumulativeGross - assignedGross,
    });
    assignedMinutes = cumulativeMinutes;
    assignedGross = cumulativeGross;
    cursor = until;
  }
  return result;
}
export function period(job: Job, date: string) {
  const anchor = DateTime.fromISO(job.anchor, { zone: "UTC" }),
    target = DateTime.fromISO(date, { zone: "UTC" });
  let start: DateTime, end: DateTime;
  if (job.cycle === "monthly") {
    let offset = (target.year - anchor.year) * 12 + target.month - anchor.month;
    if (anchor.plus({ months: offset }) > target) offset--;
    start = anchor.plus({ months: offset });
    end = anchor.plus({ months: offset + 1 });
  } else {
    const days = { weekly: 7, biweekly: 14, fourweekly: 28 }[job.cycle];
    start = anchor.plus({
      days: Math.floor(target.diff(anchor, "days").days / days) * days,
    });
    end = start.plus({ days });
  }
  return { from: start.toISODate()!, to: end.minus({ days: 1 }).toISODate()! };
}
export function totals(shifts: Shift[], from: string, to: string) {
  let minutes = 0;
  const currencies: Partial<Record<Currency, number>> = {};
  shifts.forEach((s) =>
    portions(s)
      .filter((p) => p.date >= from && p.date <= to)
      .forEach((p) => {
        minutes += p.minutes;
        currencies[s.currency] = (currencies[s.currency] || 0) + p.gross;
      }),
  );
  return { minutes, currencies };
}
export function validateData(value: unknown): Data {
  const d = value as Data;
  requireValue(
    d &&
      d.version === 1 &&
      Array.isArray(d.jobs) &&
      Array.isArray(d.shifts) &&
      Array.isArray(d.comparisons),
    "This is not a supported ShiftProof backup.",
  );
  requireValue(
    d.jobs.length <= 1000 &&
      d.shifts.length <= 100000 &&
      d.comparisons.length <= 10000,
    "Backup is too large.",
  );
  for (const list of [d.jobs, d.shifts, d.comparisons])
    requireValue(
      new Set(list.map((x) => x.id)).size === list.length,
      "Backup contains duplicate records.",
    );
  d.jobs.forEach(validateJob);
  d.shifts.forEach((s) => {
    validateShift(s);
    requireValue(
      d.jobs.some((j) => j.id === s.jobId && j.currency === s.currency),
      "Shift refers to a missing job or mismatched currency.",
    );
  });
  d.comparisons.forEach((c) => {
    requireValue(
      text(c.id) &&
        !!c.id &&
        d.jobs.some((j) => j.id === c.jobId) &&
        validDate(c.from) &&
        validDate(c.to) &&
        c.from <= c.to &&
        numberIn(c.hours, 0, 100000) &&
        Number.isInteger(c.gross) &&
        numberIn(c.gross, 0, 10000000000) &&
        text(c.notes),
      "Invalid employer comparison.",
    );
  });
  return d;
}
