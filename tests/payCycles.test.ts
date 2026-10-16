import { test } from "node:test";
import assert from "node:assert/strict";
import { cycleHistory, movePeriod } from "../src/payCycles";
import { Job, Shift, period } from "../src/domain";
const job: Job = {
  id: "j",
  title: "Job",
  employer: "",
  currency: "GBP",
  rate: 1000,
  overtimeRate: 1000,
  cycle: "monthly",
  anchor: "2024-01-31",
  zone: "Europe/London",
  color: "#147D69",
  notes: "",
  presets: [],
  archived: false,
};
const shift: Shift = {
  id: "s",
  jobId: "j",
  date: "2024-01-31",
  title: "Shift",
  mode: "hours",
  hours: 7,
  start: "09:00",
  end: "16:00",
  nextDay: false,
  breakMinutes: 0,
  overtimeMinutes: 0,
  rate: 1000,
  overtimeRate: 1000,
  currency: "GBP",
  zone: "Europe/London",
  notes: "",
  createdAt: "2024-01-31T09:00:00Z",
  updatedAt: "2024-01-31T09:00:00Z",
};
test("previous and next cycle preserve monthly anchor through leap February", () => {
  const p = period(job, "2024-03-15");
  const next = movePeriod(job, p.from, p.to, 1);
  assert.deepEqual(next, { from: "2024-03-31", to: "2024-04-29" });
  assert.deepEqual(movePeriod(job, next.from, next.to, -1), p);
});
test("cycle history includes empty gaps and pages back to earliest recorded shift", () => {
  const first = cycleHistory(job, [shift], "2024-10-10", 3);
  assert.equal(first.rows.length, 3);
  assert.equal(first.hasMore, true);
  const all = cycleHistory(job, [shift], "2024-10-10", 100);
  assert.equal(all.rows.at(-1)?.from, "2024-01-31");
  assert.equal(all.hasMore, false);
});
test("no records still shows the current cycle", () => {
  assert.deepEqual(cycleHistory(job, [], "2024-10-10", 6), {
    rows: [period(job, "2024-10-10")],
    hasMore: false,
  });
});
test("weekly, biweekly and four-week navigation has no gaps", () => {
  for (const cycle of ["weekly", "biweekly", "fourweekly"] as const) {
    const j = { ...job, cycle };
    const p = period(j, "2026-09-08");
    const next = movePeriod(j, p.from, p.to, 1);
    assert.deepEqual(movePeriod(j, next.from, next.to, -1), p);
  }
});
