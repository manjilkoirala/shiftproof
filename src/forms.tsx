import React, { useState } from "react";
import { View, Pressable, Switch } from "react-native";
import { DateTime } from "luxon";
import {
  Job,
  Shift,
  Preset,
  Cycle,
  Currency,
  colors,
  cycles,
  today,
  uid,
  validateJob,
  validateShift,
  calculate,
  money,
  hoursText,
} from "./domain";
import { Button, Card, Chips, Field, Txt, styles, theme } from "./ui";

function ErrorText({ error }: { error: string }) {
  return error ? <Txt color={theme.red}>{error}</Txt> : null;
}
export function JobForm({
  initial,
  onSave,
}: {
  initial?: Job;
  onSave: (j: Job) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.title || ""),
    [employer, setEmployer] = useState(initial?.employer || "");
  const [rate, setRate] = useState(initial ? String(initial.rate / 100) : ""),
    [ot, setOt] = useState(initial ? String(initial.overtimeRate / 100) : "");
  const [currency, setCurrency] = useState<Currency>(
      initial?.currency || "GBP",
    ),
    [cycle, setCycle] = useState<Cycle>(initial?.cycle || "monthly");
  const [anchor, setAnchor] = useState(initial?.anchor || today()),
    [zone, setZone] = useState(initial?.zone || "Europe/London"),
    [notes, setNotes] = useState(initial?.notes || "");
  const [color, setColor] = useState(initial?.color || colors[0]),
    [presets, setPresets] = useState(initial?.presets || []);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [presetName, setPresetName] = useState(""),
    [presetHours, setPresetHours] = useState("7"),
    [presetBreak, setPresetBreak] = useState("0"),
    [presetStart, setPresetStart] = useState("09:00");
  const addPreset = () => {
    const p: Preset = {
      id: uid(),
      name: presetName.trim() || `${presetHours}-hour shift`,
      hours: Number(presetHours),
      breakMinutes: Number(presetBreak),
      start: presetStart,
    };
    if (
      !Number.isFinite(p.hours) ||
      p.hours <= 0 ||
      p.hours > 24 ||
      !Number.isInteger(p.breakMinutes) ||
      p.breakMinutes < 0 ||
      p.breakMinutes >= p.hours * 60 ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start)
    ) {
      setError("Check preset hours, break and start time.");
      return;
    }
    setPresets([...presets, p]);
    setPresetName("");
    setError("");
  };
  return (
    <View style={styles.section}>
      <Field label="Job title" value={title} onChange={setTitle} />
      <Field
        label="Employer / workplace"
        value={employer}
        onChange={setEmployer}
      />
      <Txt bold>Job colour</Txt>
      <View style={styles.wrap}>
        {colors.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={`Job colour ${c}`}
            onPress={() => setColor(c)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: c,
              borderWidth: color === c ? 4 : 0,
              borderColor: "#BCD6CB",
            }}
          />
        ))}
      </View>
      <Txt bold>Pay rates</Txt>
      {initial ? (
        <Txt color={theme.muted}>
          Currency: {currency}. Create another job to use a different currency.
        </Txt>
      ) : (
        <Chips
          values={(["GBP", "EUR", "USD", "NPR"] as Currency[]).map((value) => ({
            value,
            label: value,
          }))}
          selected={currency}
          onSelect={setCurrency}
        />
      )}
      <Field label="Hourly rate" value={rate} onChange={setRate} numeric />
      <Field
        label="Overtime hourly rate"
        value={ot}
        onChange={setOt}
        numeric
        hint="Leave blank to use the normal hourly rate. Overtime hours are entered on each shift."
      />
      <Txt bold>Pay cycle</Txt>
      <Chips
        values={(Object.keys(cycles) as Cycle[]).map((value) => ({
          value,
          label: cycles[value],
        }))}
        selected={cycle}
        onSelect={setCycle}
      />
      <Field
        label="A pay period starts on (YYYY-MM-DD)"
        value={anchor}
        onChange={setAnchor}
        hint="Use the first day covered by a payslip, not the payday. Monthly dates clamp to the last day of shorter months."
      />
      <Field
        label="Job time zone"
        value={zone}
        onChange={setZone}
        hint="For example Europe/London, Asia/Kathmandu or America/New_York."
      />
      <Card>
        <Txt bold size={18}>
          Your shift presets
        </Txt>
        <Txt color={theme.muted}>
          Add as many patterns as you need. Hours are the total shift length
          before unpaid breaks.
        </Txt>
        {presets.map((p) => (
          <View key={p.id} style={styles.between}>
            <View style={{ flex: 1 }}>
              <Txt bold>{p.name}</Txt>
              <Txt size={12} color={theme.muted}>
                {p.hours}h · {p.start} · {p.breakMinutes}m break
              </Txt>
            </View>
            <Button
              secondary
              title="Remove"
              onPress={() => setPresets(presets.filter((x) => x.id !== p.id))}
            />
          </View>
        ))}
        <Field
          label="Preset name (e.g. Long day)"
          value={presetName}
          onChange={setPresetName}
        />
        <Field
          label="Shift length in hours"
          value={presetHours}
          onChange={setPresetHours}
          numeric
        />
        <Field
          label="Usual start (HH:mm)"
          value={presetStart}
          onChange={setPresetStart}
        />
        <Field
          label="Unpaid break in minutes"
          value={presetBreak}
          onChange={setPresetBreak}
          numeric
        />
        <Button title="Add preset" secondary icon="plus" onPress={addPreset} />
      </Card>
      <Field label="Job notes" value={notes} onChange={setNotes} multiline />
      <ErrorText error={error} />
      <Button
        title={busy ? "Saving…" : "Save job"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            if (!rate.trim()) throw new Error("Enter an hourly rate.");
            const j: Job = {
              id: initial?.id || uid(),
              title: title.trim(),
              employer: employer.trim(),
              rate: Math.round(Number(rate) * 100),
              overtimeRate: Math.round(Number(ot.trim() ? ot : rate) * 100),
              currency,
              cycle,
              anchor,
              zone,
              notes,
              color,
              presets,
              archived: initial?.archived || false,
            };
            validateJob(j);
            await onSave(j);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
    </View>
  );
}
export function ShiftForm({
  initial,
  date,
  jobs,
  onSave,
  onDelete,
}: {
  initial?: Shift;
  date: string;
  jobs: Job[];
  onSave: (s: Shift) => Promise<void>;
  onDelete: (s: Shift) => Promise<void>;
}) {
  const available = jobs.filter((j) => !j.archived || j.id === initial?.jobId);
  const [jobId, setJobId] = useState(initial?.jobId || available[0]?.id || "");
  const job = jobs.find((j) => j.id === jobId);
  const [shiftDate, setDate] = useState(initial?.date || date),
    [title, setTitle] = useState(initial?.title || "Shift");
  const [mode, setMode] = useState<"hours" | "times">(initial?.mode || "hours"),
    [hours, setHours] = useState(String(initial?.hours ?? 7));
  const [start, setStart] = useState(initial?.start || "09:00"),
    [end, setEnd] = useState(initial?.end || "16:00"),
    [nextDay, setNextDay] = useState(initial?.nextDay || false);
  const [brk, setBreak] = useState(String(initial?.breakMinutes || 0)),
    [overtime, setOvertime] = useState(
      String((initial?.overtimeMinutes || 0) / 60),
    );
  const [rate, setRate] = useState(
      String((initial?.rate ?? job?.rate ?? 0) / 100),
    ),
    [otRate, setOtRate] = useState(
      String((initial?.overtimeRate ?? job?.overtimeRate ?? 0) / 100),
    );
  const [notes, setNotes] = useState(initial?.notes || ""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmDelete, setConfirmDelete] = useState(false);
  const [zone, setZone] = useState(
    initial?.zone || job?.zone || "Europe/London",
  );
  function draft(): Shift {
    const now = new Date().toISOString();
    return {
      id: initial?.id || uid(),
      jobId,
      date: shiftDate,
      title,
      mode,
      hours: Number(hours),
      start,
      end,
      nextDay,
      breakMinutes: Number(brk),
      overtimeMinutes: Math.round(Number(overtime) * 60),
      rate: Math.round(Number(rate) * 100),
      overtimeRate: Math.round(Number(otRate) * 100),
      currency: job?.currency || "GBP",
      zone,
      notes,
      createdAt: initial?.createdAt || now,
      updatedAt: now,
    };
  }
  let preview = "";
  try {
    const s = draft();
    validateShift(s);
    const c = calculate(s);
    preview = `${hoursText(c.minutes)} paid hours  ·  ${money(c.gross, s.currency)}`;
  } catch {
    preview = "Enter valid shift details to see your estimate";
  }
  if (!job) return <Txt>Create a job first to record your shifts.</Txt>;
  return (
    <View style={styles.section}>
      <Txt bold>Which job?</Txt>
      <Chips
        values={available.map((j) => ({ value: j.id, label: j.title }))}
        selected={jobId}
        onSelect={(id) => {
          if (id === jobId) return;
          const j = jobs.find((x) => x.id === id)!;
          setJobId(id);
          setRate(String(j.rate / 100));
          setOtRate(String(j.overtimeRate / 100));
          setZone(j.zone);
        }}
      />
      {job.presets.length > 0 && (
        <>
          <Txt bold>Start with a preset</Txt>
          <View style={styles.wrap}>
            {job.presets.map((p) => (
              <Button
                secondary
                key={p.id}
                title={`${p.name} · ${p.hours}h`}
                onPress={() => {
                  setTitle(p.name);
                  setHours(String(p.hours));
                  setBreak(String(p.breakMinutes));
                  setStart(p.start);
                  const finish = DateTime.fromISO(`2000-01-01T${p.start}`).plus(
                    { minutes: Math.round(p.hours * 60) },
                  );
                  setEnd(finish.toFormat("HH:mm"));
                  setNextDay(finish.day !== 1);
                  setMode("hours");
                  setOvertime("0");
                }}
              />
            ))}
          </View>
          <Txt size={12} color={theme.muted}>
            Everything below can be changed for this shift.
          </Txt>
        </>
      )}
      <Field label="Date (YYYY-MM-DD)" value={shiftDate} onChange={setDate} />
      <Field label="Shift title" value={title} onChange={setTitle} />
      <Chips
        values={[
          { value: "hours", label: "Enter hours" },
          { value: "times", label: "Start & finish" },
        ]}
        selected={mode}
        onSelect={setMode}
      />
      {mode === "hours" ? (
        <Field
          label="Actual shift length (hours before breaks)"
          value={hours}
          onChange={setHours}
          numeric
          hint="Worked 6 hours instead of your usual 7? Enter 6 here."
        />
      ) : (
        <>
          <Field label="Start (HH:mm)" value={start} onChange={setStart} />
          <Field label="Finish (HH:mm)" value={end} onChange={setEnd} />
          <View style={styles.between}>
            <Txt>Finishes the following day</Txt>
            <Switch
              accessibilityLabel="Finishes the following day"
              value={nextDay}
              onValueChange={setNextDay}
              trackColor={{ true: theme.green }}
            />
          </View>
        </>
      )}
      <Field
        label="Unpaid break (minutes)"
        value={brk}
        onChange={setBreak}
        numeric
      />
      <Field
        label="Of the paid hours, overtime hours"
        value={overtime}
        onChange={setOvertime}
        numeric
        hint="Overtime is part of paid time, not added on top."
      />
      <Field
        label={`Hourly rate (${job.currency})`}
        value={rate}
        onChange={setRate}
        numeric
      />
      <Field
        label={`Overtime hourly rate (${job.currency})`}
        value={otRate}
        onChange={setOtRate}
        numeric
      />
      <Field label="Shift time zone" value={zone} onChange={setZone} />
      <Field label="Notes" value={notes} onChange={setNotes} multiline />
      <Card style={{ backgroundColor: theme.pale }}>
        <Txt bold size={18}>
          {preview}
        </Txt>
        <Txt size={12} color={theme.muted}>
          Estimated gross, before deductions.
        </Txt>
      </Card>
      <ErrorText error={error} />
      <Button
        title={busy ? "Saving…" : "Save shift"}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          try {
            if (![hours, brk, overtime, rate, otRate].every((v) => v.trim()))
              throw new Error("Fill in all numeric fields.");
            const s = draft();
            validateShift(s);
            await onSave(s);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      />
      {initial &&
        (confirmDelete ? (
          <Card>
            <Txt>Delete this shift permanently?</Txt>
            <Button
              danger
              title="Yes, delete shift"
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await onDelete(initial);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button
              secondary
              title="Keep shift"
              onPress={() => setConfirmDelete(false)}
            />
          </Card>
        ) : (
          <Button
            secondary
            danger
            title="Delete shift"
            onPress={() => setConfirmDelete(true)}
          />
        ))}
    </View>
  );
}
