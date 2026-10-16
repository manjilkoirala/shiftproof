import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { DateTime } from "luxon";
import {
  Data,
  Job,
  cycles,
  period,
  totals,
  money,
  hoursText,
  validDate,
} from "./domain";
import { cycleHistory, movePeriod } from "./payCycles";
import { Button, Card, Empty, Field, Txt, styles, theme } from "./ui";
import { exportText, makeCSV, pdfReport } from "./transfer";

type Props = {
  data: Data;
  filter: string;
  busy: boolean;
  action: (fn: () => Promise<void>) => Promise<void>;
};
export const rangeLabel = (from: string, to: string) =>
  `${DateTime.fromISO(from).toFormat("d MMM yyyy")} – ${DateTime.fromISO(to).toFormat("d MMM yyyy")}`;
export function PayCyclesView(props: Props) {
  const jobs = props.data.jobs.filter(
    (j) => props.filter === "all" || j.id === props.filter,
  );
  return (
    <>
      <Txt color={theme.muted}>
        Each job follows its own pay calendar. Browse any cycle, or open an
        earlier one from your history. Amounts are estimates from recorded
        shifts.
      </Txt>
      {!jobs.length && (
        <Empty
          icon="briefcase"
          title="Your pay cycles start with a job"
          detail="Add a job and choose its pay cycle to see your earnings here."
        />
      )}
      {jobs.map((j) => (
        <JobCycles key={`${j.id}-${j.anchor}-${j.cycle}`} {...props} job={j} />
      ))}
    </>
  );
}
function JobCycles({ data, job, busy, action }: Props & { job: Job }) {
  const now = DateTime.now().setZone(job.zone).toISODate()!;
  const current = period(job, now);
  const [selected, setSelected] = useState(current),
    [jump, setJump] = useState(now),
    [limit, setLimit] = useState(6);
  const shifts = useMemo(
    () => data.shifts.filter((s) => s.jobId === job.id),
    [data.shifts, job.id],
  );
  const result = totals(shifts, selected.from, selected.to);
  const history = useMemo(
    () => cycleHistory(job, shifts, now, limit),
    [job, shifts, now, limit],
  );
  const status =
    selected.from > now
      ? "Upcoming cycle"
      : selected.to < now
        ? "Past cycle"
        : "Current cycle";
  return (
    <Card>
      <View style={styles.between}>
        <View style={{ flex: 1 }}>
          <Txt size={21} bold color={job.color}>
            {job.title}
          </Txt>
          <Txt color={theme.muted}>
            {cycles[job.cycle]}
            {job.archived ? " · Archived job" : ""}
          </Txt>
        </View>
        <Txt size={11} bold color={theme.green}>
          {status}
        </Txt>
      </View>
      <Txt bold size={18}>
        {rangeLabel(selected.from, selected.to)}
      </Txt>
      <View style={styles.wrap}>
        <Button
          title="Previous cycle"
          secondary
          icon="chevron-left"
          onPress={() =>
            setSelected(movePeriod(job, selected.from, selected.to, -1))
          }
        />
        <Button
          title="Next cycle"
          secondary
          icon="chevron-right"
          onPress={() =>
            setSelected(movePeriod(job, selected.from, selected.to, 1))
          }
        />
        <Button
          title="Current cycle"
          secondary
          onPress={() => setSelected(current)}
        />
      </View>
      <View
        style={{
          backgroundColor: theme.pale,
          padding: 18,
          borderRadius: 14,
          gap: 6,
        }}
      >
        <Txt bold size={30}>
          {money(result.currencies[job.currency] || 0, job.currency)}
        </Txt>
        <Txt>{hoursText(result.minutes)} paid hours · Estimated gross</Txt>
        <Txt size={12} color={theme.muted}>
          {status === "Upcoming cycle"
            ? "Only shifts already entered are included; this is not a forecast."
            : "Based on recorded shifts, before deductions."}
        </Txt>
      </View>
      <Field
        label={`Find a cycle by date · ${job.title}`}
        value={jump}
        onChange={setJump}
        hint="YYYY-MM-DD · Enter any day in the cycle you want."
      />
      <Button
        title="Go to this date’s cycle"
        secondary
        disabled={!validDate(jump)}
        onPress={() => setSelected(period(job, jump))}
      />
      <View style={styles.wrap}>
        <Button
          title="Export cycle CSV"
          disabled={busy}
          icon="download"
          onPress={() =>
            action(() =>
              exportText(
                `shiftproof-cycle-${selected.from}-${selected.to}.csv`,
                makeCSV(data, selected.from, selected.to, job.id),
                "text/csv",
              ),
            )
          }
        />
        <Button
          title="Cycle PDF"
          secondary
          disabled={busy}
          onPress={() =>
            action(() => pdfReport(data, selected.from, selected.to, job.id))
          }
        />
      </View>
      <Txt bold size={18}>
        Pay-cycle history
      </Txt>
      <Txt size={12} color={theme.muted}>
        Current and earlier cycles back to your first recorded shift, including
        cycles with no entries.
      </Txt>
      {history.rows.map((p) => {
        const t = totals(shifts, p.from, p.to);
        return (
          <View
            key={p.from}
            style={{
              borderTopWidth: 1,
              borderColor: theme.line,
              paddingTop: 14,
              gap: 8,
            }}
          >
            <Txt bold>{rangeLabel(p.from, p.to)}</Txt>
            <View style={styles.between}>
              <View>
                <Txt bold>
                  {money(t.currencies[job.currency] || 0, job.currency)}
                </Txt>
                <Txt size={12} color={theme.muted}>
                  {hoursText(t.minutes)} paid hours
                  {p.from === current.from ? " · Current" : ""}
                </Txt>
              </View>
              <Button
                title={p.from === selected.from ? "Selected" : "View cycle"}
                secondary
                disabled={p.from === selected.from}
                onPress={() => setSelected(p)}
              />
            </View>
          </View>
        );
      })}
      {history.hasMore && (
        <Button
          title="Show older cycles"
          secondary
          onPress={() => setLimit(limit + 6)}
        />
      )}
    </Card>
  );
}
