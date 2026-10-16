import React, { useState } from "react";
import { View } from "react-native";
import { DateTime } from "luxon";
import {
  Data,
  Job,
  Comparison,
  today,
  uid,
  cycles,
  hoursText,
  money,
  period,
  totals,
  validDate,
} from "./domain";
import { Button, Card, Chips, Empty, Field, Txt, styles, theme } from "./ui";
import { exportText, makeCSV, pdfReport } from "./transfer";
import { PayCyclesView } from "./PayCyclesView";
const label = (d: string, format = "d MMMM yyyy") =>
  DateTime.fromISO(d).toFormat(format);
export function Summary({
  data,
  filter,
  busy,
  action,
}: {
  data: Data;
  filter: string;
  busy: boolean;
  action: (fn: () => Promise<void>, success?: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"cycles" | "range">("cycles");
  const modePicker = (
    <Chips
      values={[
        { value: "cycles", label: "Pay cycles" },
        { value: "range", label: "Date range" },
      ]}
      selected={mode}
      onSelect={setMode}
    />
  );
  const [from, setFrom] = useState(
      DateTime.local().startOf("month").toISODate()!,
    ),
    [to, setTo] = useState(today());
  const valid = validDate(from) && validDate(to) && from <= to;
  const shifts = data.shifts.filter(
      (s) => filter === "all" || s.jobId === filter,
    ),
    result = valid ? totals(shifts, from, to) : null;
  if (mode === "cycles")
    return (
      <>
        {modePicker}
        <PayCyclesView
          data={data}
          filter={filter}
          busy={busy}
          action={action}
        />
      </>
    );
  return (
    <>
      {modePicker}
      <Card>
        <Txt bold size={19}>
          Reporting period
        </Txt>
        <Chips
          values={[
            { value: "week", label: "This week" },
            { value: "month", label: "This month" },
          ]}
          selected=""
          onSelect={(v) => {
            setFrom(
              DateTime.local()
                .startOf(v === "week" ? "week" : "month")
                .toISODate()!,
            );
            setTo(
              DateTime.local()
                .endOf(v === "week" ? "week" : "month")
                .toISODate()!,
            );
          }}
        />
        <Field label="From (YYYY-MM-DD)" value={from} onChange={setFrom} />
        <Field
          label="Through (YYYY-MM-DD, inclusive)"
          value={to}
          onChange={setTo}
        />
        {filter !== "all" && (
          <Button
            secondary
            title="Use current job pay period"
            onPress={() => {
              const p = period(
                data.jobs.find((j) => j.id === filter)!,
                today(),
              );
              setFrom(p.from);
              setTo(p.to);
            }}
          />
        )}
      </Card>
      {!valid ? (
        <Txt color={theme.red}>Enter a valid date range.</Txt>
      ) : (
        <>
          <Card style={{ backgroundColor: theme.ink }}>
            <Txt color="#B9D2C8">TOTAL PAID HOURS</Txt>
            <Txt size={38} bold color="#FFF">
              {hoursText(result!.minutes)} h
            </Txt>
            {Object.entries(result!.currencies).map(([c, n]) => (
              <Txt size={22} bold color="#FFF" key={c}>
                {money(n!, c as Job["currency"])}
              </Txt>
            ))}
            <Txt color="#B9D2C8" size={12}>
              Estimated gross · currencies shown separately
            </Txt>
          </Card>
          {data.jobs
            .filter((j) => filter === "all" || j.id === filter)
            .map((j) => {
              const t = totals(
                shifts.filter((s) => s.jobId === j.id),
                from,
                to,
              );
              return (
                <Card key={j.id}>
                  <View style={styles.between}>
                    <Txt bold size={18} color={j.color}>
                      {j.title}
                    </Txt>
                    <Txt bold>
                      {money(t.currencies[j.currency] || 0, j.currency)}
                    </Txt>
                  </View>
                  <Txt>
                    {hoursText(t.minutes)} paid hours · {cycles[j.cycle]}
                  </Txt>
                  <Txt size={12} color={theme.muted}>
                    Selected range: {label(from, "d MMM yyyy")} –{" "}
                    {label(to, "d MMM yyyy")}
                  </Txt>
                  <View
                    style={{
                      height: 6,
                      backgroundColor: theme.pale,
                      borderRadius: 4,
                    }}
                  >
                    <View
                      style={{
                        height: 6,
                        borderRadius: 4,
                        backgroundColor: j.color,
                        width: `${result!.minutes ? (t.minutes / result!.minutes) * 100 : 0}%`,
                      }}
                    />
                  </View>
                </Card>
              );
            })}
          <Card>
            <Txt bold size={18}>
              Take your records with you
            </Txt>
            <Button
              title="Export CSV"
              disabled={busy}
              icon="download"
              onPress={() =>
                action(() =>
                  exportText(
                    `shiftproof-${from}-${to}.csv`,
                    makeCSV(
                      data,
                      from,
                      to,
                      filter === "all" ? undefined : filter,
                    ),
                    "text/csv",
                  ),
                )
              }
            />
            <Button
              title="Print / save PDF report"
              disabled={busy}
              secondary
              icon="file-text"
              onPress={() =>
                action(() =>
                  pdfReport(
                    data,
                    from,
                    to,
                    filter === "all" ? undefined : filter,
                  ),
                )
              }
            />
          </Card>
        </>
      )}
    </>
  );
}
export function Compare({
  data,
  commit,
}: {
  data: Data;
  commit: (fn: (d: Data) => Data) => Promise<void>;
}) {
  const [jobId, setJobId] = useState(data.jobs[0]?.id || ""),
    job = data.jobs.find((j) => j.id === jobId);
  const p = job ? period(job, today()) : { from: today(), to: today() };
  const [from, setFrom] = useState(p.from),
    [to, setTo] = useState(p.to),
    [hours, setHours] = useState(""),
    [gross, setGross] = useState(""),
    [notes, setNotes] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const valid = validDate(from) && validDate(to) && from <= to;
  const expected = valid
    ? totals(
        data.shifts.filter((s) => s.jobId === jobId),
        from,
        to,
      )
    : null;
  const entered =
    !!hours.trim() &&
    !!gross.trim() &&
    Number.isFinite(Number(hours)) &&
    Number.isFinite(Number(gross)) &&
    Number(hours) >= 0 &&
    Number(gross) >= 0;
  if (!job)
    return (
      <Empty
        icon="check-square"
        title="A clearer view of payday"
        detail="Create a job and record your shifts, then compare them with your employer’s records here."
      />
    );
  return (
    <>
      <Card>
        <Txt bold size={19}>
          Compare a pay period
        </Txt>
        <Chips
          values={data.jobs.map((j) => ({ value: j.id, label: j.title }))}
          selected={jobId}
          onSelect={(id) => {
            setJobId(id);
            const next = period(
              data.jobs.find((j) => j.id === id)!,
              today(),
            );
            setFrom(next.from);
            setTo(next.to);
            setHours("");
            setGross("");
            setNotes("");
            setMessage("");
          }}
        />
        <Field
          label="Period from (YYYY-MM-DD)"
          value={from}
          onChange={setFrom}
        />
        <Field
          label="Period through (YYYY-MM-DD)"
          value={to}
          onChange={setTo}
        />
        <Field
          label="Employer-recorded paid hours"
          value={hours}
          onChange={setHours}
          numeric
        />
        <Field
          label={`Employer-recorded gross (${job.currency})`}
          value={gross}
          onChange={setGross}
          numeric
          hint="Use gross pay for these hours, before tax and deductions."
        />
        <Field
          label="Payslip notes / reference"
          value={notes}
          onChange={setNotes}
          multiline
        />
        {expected && (
          <View style={{ gap: 12 }}>
            <View style={styles.between}>
              <Txt>Your recorded hours</Txt>
              <Txt bold>{hoursText(expected.minutes)} h</Txt>
            </View>
            <View style={styles.between}>
              <Txt>Your estimated gross</Txt>
              <Txt bold>
                {money(expected.currencies[job.currency] || 0, job.currency)}
              </Txt>
            </View>
            {entered && (
              <Card style={{ backgroundColor: theme.pale }}>
                <Txt bold>
                  {Math.abs(expected.minutes - Number(hours) * 60) < 0.5 &&
                  Math.abs(
                    (expected.currencies[job.currency] || 0) -
                      Math.round(Number(gross) * 100),
                  ) < 1
                    ? "Your records match"
                    : "Possible discrepancy"}
                </Txt>
                <Txt>
                  Recorded minus employer:{" "}
                  {hoursText(expected.minutes - Math.round(Number(hours) * 60))}{" "}
                  h ·{" "}
                  {money(
                    (expected.currencies[job.currency] || 0) -
                      Math.round(Number(gross) * 100),
                    job.currency,
                  )}
                </Txt>
                <Txt size={12} color={theme.muted}>
                  A positive difference means your estimate is higher. Check pay
                  dates, allowances, overtime and breaks before drawing
                  conclusions.
                </Txt>
              </Card>
            )}
          </View>
        )}
        {!!message && <Txt color={theme.green}>{message}</Txt>}
        <Button
          title="Save comparison"
          disabled={busy || !valid || !entered}
          onPress={async () => {
            setBusy(true);
            try {
              const c: Comparison = {
                id:
                  data.comparisons.find(
                    (c) => c.jobId === jobId && c.from === from && c.to === to,
                  )?.id || uid(),
                jobId,
                from,
                to,
                hours: Number(hours),
                gross: Math.round(Number(gross) * 100),
                notes,
              };
              await commit((d) => ({
                ...d,
                comparisons: [...d.comparisons.filter((x) => x.id !== c.id), c],
              }));
              setMessage(
                "Comparison saved. Saving this period again updates its record.",
              );
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        />
      </Card>
      <Txt size={19} bold>
        Saved comparisons
      </Txt>
      {data.comparisons
        .filter((c) => c.jobId === jobId)
        .sort((a, b) => b.from.localeCompare(a.from))
        .map((c) => (
          <Card key={c.id}>
            <Txt bold>
              {label(c.from, "d MMM")} – {label(c.to)}
            </Txt>
            <Txt color={theme.muted}>
              Employer: {c.hours} h · {money(c.gross, job.currency)}
            </Txt>
            <Button
              secondary
              title="Open comparison"
              onPress={() => {
                setFrom(c.from);
                setTo(c.to);
                setHours(String(c.hours));
                setGross(String(c.gross / 100));
                setNotes(c.notes);
                setMessage("Saved record loaded above.");
              }}
            />
          </Card>
        ))}
    </>
  );
}
