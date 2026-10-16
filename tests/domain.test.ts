import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculate,
  period,
  portions,
  totals,
  validateData,
  validateShift,
  validateJob,
  type Job,
  type Shift,
} from "../src/domain";
const job: Job = {
  id: "j",
  title: "Care assistant",
  employer: "Care home",
  currency: "GBP",
  rate: 1271,
  overtimeRate: 1907,
  cycle: "weekly",
  anchor: "2026-09-07",
  zone: "Europe/London",
  color: "#147D69",
  notes: "",
  presets: [],
  archived: false,
};
const shift: Shift = {
  id: "s",
  jobId: "j",
  date: "2026-09-08",
  title: "Day",
  mode: "hours",
  hours: 7,
  start: "09:00",
  end: "16:00",
  nextDay: false,
  breakMinutes: 0,
  overtimeMinutes: 0,
  rate: 1271,
  overtimeRate: 1907,
  currency: "GBP",
  zone: "Europe/London",
  notes: "",
  createdAt: "2026-09-08T08:00:00Z",
  updatedAt: "2026-09-08T08:00:00Z",
};
test("7-hour preset can be overridden to 6, without changing the rate", () => {
  assert.equal(calculate({ ...shift, hours: 6 }).gross, 7626);
  assert.equal(calculate(shift).minutes, 420);
});
test("unpaid breaks and overtime are not double-counted", () => {
  assert.deepEqual(
    calculate({ ...shift, hours: 8, breakMinutes: 30, overtimeMinutes: 90 }),
    { minutes: 450, elapsed: 480, gross: 10487 },
  );
});
test("overnight shift counts elapsed time", () => {
  assert.equal(
    calculate({
      ...shift,
      mode: "times",
      start: "22:00",
      end: "06:00",
      nextDay: true,
      breakMinutes: 30,
    }).minutes,
    450,
  );
});
test("rejects zero-length, backwards and excessive breaks", () => {
  for (const s of [
    { ...shift, hours: 0 },
    { ...shift, breakMinutes: 421 },
    { ...shift, overtimeMinutes: 421 },
    { ...shift, mode: "times" as const, start: "16:00", end: "09:00" },
  ])
    assert.throws(() => calculate(s));
});
test("spring DST uses actual elapsed time", () => {
  assert.equal(
    calculate({
      ...shift,
      mode: "times",
      date: "2026-03-29",
      start: "00:00",
      end: "08:00",
    }).minutes,
    420,
  );
});
test("autumn DST uses actual elapsed time", () => {
  assert.equal(
    calculate({
      ...shift,
      mode: "times",
      date: "2026-10-25",
      start: "00:00",
      end: "08:00",
    }).minutes,
    540,
  );
});
test("nonexistent and ambiguous clock times require explicit hours entry", () => {
  for (const date of ["2026-03-29", "2026-10-25"])
    assert.throws(() =>
      calculate({
        ...shift,
        mode: "times",
        date,
        start: "01:30",
        end: "08:00",
      }),
    );
});
test("overnight portions conserve rounded money and paid minutes", () => {
  const s = {
    ...shift,
    mode: "times" as const,
    start: "22:13",
    end: "06:17",
    nextDay: true,
    breakMinutes: 37,
    overtimeMinutes: 93,
  };
  const parts = portions(s),
    total = calculate(s);
  assert.equal(parts.length, 2);
  assert.equal(
    parts.reduce((n, p) => n + p.minutes, 0),
    total.minutes,
  );
  assert.equal(
    parts.reduce((n, p) => n + p.gross, 0),
    total.gross,
  );
});
test("period boundary reports include only relevant overnight portions", () => {
  const s = {
    ...shift,
    date: "2026-09-30",
    mode: "times" as const,
    start: "22:00",
    end: "06:00",
    nextDay: true,
  };
  assert.equal(totals([s], "2026-10-01", "2026-10-31").minutes, 360);
});
test("multiple shifts aggregate but currencies remain separate", () => {
  const t = totals(
    [shift, { ...shift, id: "b", currency: "USD" }],
    shift.date,
    shift.date,
  );
  assert.equal(t.minutes, 840);
  assert.deepEqual(t.currencies, { GBP: 8897, USD: 8897 });
});
test("weekly, fortnightly and four-week cycles work before and after anchor", () => {
  assert.deepEqual(period(job, "2026-09-06"), {
    from: "2026-08-31",
    to: "2026-09-06",
  });
  assert.deepEqual(period({ ...job, cycle: "biweekly" }, "2026-09-20"), {
    from: "2026-09-07",
    to: "2026-09-20",
  });
  assert.deepEqual(period({ ...job, cycle: "fourweekly" }, "2026-10-04"), {
    from: "2026-09-07",
    to: "2026-10-04",
  });
});
test("monthly cycles clamp month end without anchor drift", () => {
  const j = { ...job, cycle: "monthly" as const, anchor: "2024-01-31" };
  assert.deepEqual(period(j, "2024-02-29"), {
    from: "2024-02-29",
    to: "2024-03-30",
  });
  assert.deepEqual(period(j, "2024-03-31"), {
    from: "2024-03-31",
    to: "2024-04-29",
  });
});
test("editing job defaults does not change historical earnings", () => {
  const changed = { ...job, rate: 1500 };
  validateJob(changed);
  assert.equal(calculate(shift).gross, 8897);
});
test("backup round trip preserves data; invalid versions and references rejected", () => {
  const d = { version: 1, jobs: [job], shifts: [shift], comparisons: [] };
  assert.deepEqual(validateData(JSON.parse(JSON.stringify(d))), d);
  assert.throws(() => validateData({ ...d, version: 2 }));
  assert.throws(() => validateData({ ...d, jobs: [] }));
  assert.throws(() => validateData({ ...d, shifts: [shift, shift] }));
  assert.throws(() => validateData({ ...d, shifts: [{ ...shift, rate: -1 }] }));
});
test("rejects impossible dates, malformed clocks and invalid zones", () => {
  for (const s of [
    { ...shift, date: "2026-02-30" },
    { ...shift, start: "25:00" },
    { ...shift, zone: "Invalid/Zone" },
  ])
    assert.throws(() => validateShift(s));
});
