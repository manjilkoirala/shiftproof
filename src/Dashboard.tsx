import React from "react";
import { View } from "react-native";
import { DateTime } from "luxon";
import {
  Data,
  totals,
  money,
  hoursText,
  period,
  cycles,
  today,
  Job,
} from "./domain";
import { Button, Card, Empty, Txt, styles, theme } from "./ui";
import { rangeLabel } from "./PayCyclesView";

export function Dashboard({
  data,
  onAdd,
  onCalendar,
  onCycles,
}: {
  data: Data;
  onAdd: () => void;
  onCalendar: () => void;
  onCycles: (id?: string) => void;
}) {
  const now = today(),
    month = DateTime.fromISO(now).startOf("month").toISODate()!;
  const total = totals(data.shifts, month, now);
  const active = data.jobs.filter((j) => !j.archived);
  return (
    <>
      <Card style={{ backgroundColor: theme.ink, borderColor: theme.ink }}>
        <Txt color="#B9D2C8">
          {DateTime.fromISO(now).toFormat("MMMM yyyy").toUpperCase()} · MONTH TO
          DATE
        </Txt>
        <Txt size={38} bold color="#FFF">
          {hoursText(total.minutes)} h
        </Txt>
        {Object.entries(total.currencies).map(([currency, value]) => (
          <Txt key={currency} size={25} color="#FFF" bold>
            {money(value!, currency as Job["currency"])}
          </Txt>
        ))}
        <Txt color="#B9D2C8">Estimated gross from your recorded shifts</Txt>
      </Card>
      <View style={styles.wrap}>
        <Button
          title={active.length ? "Add shift" : "Create your first job"}
          icon="plus"
          onPress={onAdd}
        />
        <Button
          title="Open calendar"
          secondary
          icon="calendar"
          onPress={onCalendar}
        />
      </View>
      <View style={styles.between}>
        <Txt size={22} bold>
          Your pay cycles
        </Txt>
        <Button title="View all cycles" secondary onPress={() => onCycles()} />
      </View>
      <Txt color={theme.muted}>
        What you’ve recorded in each job’s current cycle.
      </Txt>
      {!active.length && (
        <Empty
          icon="briefcase"
          title="Make every hour count"
          detail="Set up a job with your rate and pay cycle. Your earnings will appear here as you record shifts."
        />
      )}
      {active.map((j) => {
        const p = period(j, DateTime.now().setZone(j.zone).toISODate()!);
        const t = totals(
          data.shifts.filter((s) => s.jobId === j.id),
          p.from,
          p.to,
        );
        return (
          <Card key={j.id}>
            <View style={styles.between}>
              <Txt size={20} bold color={j.color}>
                {j.title}
              </Txt>
              <Txt size={12} color={theme.muted}>
                {cycles[j.cycle]}
              </Txt>
            </View>
            <Txt color={theme.muted}>{rangeLabel(p.from, p.to)}</Txt>
            <Txt size={30} bold>
              {money(t.currencies[j.currency] || 0, j.currency)}
            </Txt>
            <Txt>{hoursText(t.minutes)} paid hours · Estimated gross</Txt>
            <Button
              title="Browse this job’s cycles"
              secondary
              onPress={() => onCycles(j.id)}
            />
          </Card>
        );
      })}
      <Card>
        <Txt bold>Your records, ready for payday</Txt>
        <Txt color={theme.muted}>
          Browse previous cycles in Summary, check your payslip in Compare, and
          keep a backup of your records.
        </Txt>
      </Card>
    </>
  );
}
