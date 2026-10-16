import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  BackHandler,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  KeyboardAvoidingView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { DateTime } from "luxon";
import {
  Data,
  Job,
  Shift,
  emptyData,
  today,
  cycles,
  calculate,
  hoursText,
  money,
  portions,
  totals,
} from "./domain";
import { readData, writeData } from "./storage";
import { Button, Card, Chips, Empty, Icon, Txt, styles, theme } from "./ui";
import { JobForm, ShiftForm } from "./forms";
import { exportText, importBackup } from "./transfer";
import { Summary, Compare } from "./reports";
import { Dashboard } from "./Dashboard";
import { router, useLocalSearchParams } from "expo-router";

type Tab =
  "Dashboard" | "Calendar" | "Summary" | "Jobs" | "Compare" | "Settings";
type Editor =
  | { kind: "job"; job?: Job }
  | { kind: "shift"; shift?: Shift }
  | { kind: "day" }
  | null;
const tabs: { name: Tab; icon: React.ComponentProps<typeof Icon>["name"] }[] = [
  { name: "Dashboard", icon: "home" },
  { name: "Calendar", icon: "calendar" },
  { name: "Summary", icon: "bar-chart-2" },
  { name: "Jobs", icon: "briefcase" },
  { name: "Compare", icon: "check-square" },
  { name: "Settings", icon: "settings" },
];
const dateLabel = (d: string, format = "d MMMM yyyy") =>
  DateTime.fromISO(d).toFormat(format);
export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}
function Main() {
  const params = useLocalSearchParams<{ destination?: string; job?: string }>();
  const tab: Tab =
    tabs.find((t) => t.name.toLowerCase() === params.destination)?.name ||
    "Dashboard";
  const setTab = (next: Tab) =>
    router.replace(
      next === "Dashboard"
        ? "/"
        : {
            pathname: "/[destination]",
            params: { destination: next.toLowerCase() },
          },
    );
  const [data, setData] = useState<Data>(emptyData),
    dataRef = useRef(data),
    writing = useRef(false);
  const [loaded, setLoaded] = useState(false),
    [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState(today()),
    [month, setMonth] = useState(today().slice(0, 7));
  const [filter, setFilter] = useState(params.job || "all"),
    [editor, setEditor] = useState<Editor>(null),
    [notice, setNotice] = useState("");
  const [restore, setRestore] = useState<Data | null>(null),
    [busy, setBusy] = useState(false);
  const { width } = useWindowDimensions();
  const wide = width > 850;
  useEffect(() => {
    readData()
      .then((d) => {
        setData(d);
        dataRef.current = d;
        setLoaded(true);
      })
      .catch((e) => setLoadError(e.message));
  }, []);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (editor) {
        setEditor(null);
        return true;
      }
      if (tab !== "Dashboard") {
        router.replace("/");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [editor, tab]);
  async function commit(update: (current: Data) => Data) {
    if (writing.current)
      throw new Error("A save is in progress. Please try again.");
    writing.current = true;
    try {
      const next = update(dataRef.current);
      await writeData(next);
      dataRef.current = next;
      setData(next);
    } finally {
      writing.current = false;
    }
  }
  async function action(fn: () => Promise<void>, success?: string) {
    setBusy(true);
    try {
      await fn();
      if (success) setNotice(success);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const activeJobs = data.jobs.filter((j) => !j.archived);
  const filtered = useMemo(
    () => data.shifts.filter((s) => filter === "all" || s.jobId === filter),
    [data.shifts, filter],
  );
  const days = useMemo(() => {
    const index = new Map<
      string,
      { minutes: number; shifts: Shift[]; colors: string[] }
    >();
    const jobColors = new Map(data.jobs.map((j) => [j.id, j.color]));
    filtered.forEach((s) =>
      portions(s).forEach((p) => {
        const day = index.get(p.date) || { minutes: 0, shifts: [], colors: [] };
        day.minutes += p.minutes;
        day.shifts.push(s);
        const color = jobColors.get(s.jobId)!;
        if (!day.colors.includes(color)) day.colors.push(color);
        index.set(p.date, day);
      }),
    );
    return index;
  }, [filtered, data.jobs]);
  const first = DateTime.fromISO(`${month}-01`),
    last = first.endOf("month").toISODate()!;
  const monthly = totals(filtered, `${month}-01`, last);
  const selectedShifts = days.get(selected)?.shifts || [];
  const monthShifts = filtered.filter((s) =>
    portions(s).some((p) => p.date.startsWith(month)),
  );
  const addShift = () =>
    activeJobs.length
      ? setEditor({ kind: "shift" })
      : setEditor({ kind: "job" });
  const earnings = (t: ReturnType<typeof totals>) =>
    Object.entries(t.currencies)
      .map(([c, n]) => money(n!, c as Job["currency"]))
      .join(" + ") ||
    money(0, data.jobs.find((j) => j.id === filter)?.currency || "GBP");
  if (!loaded)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: theme.bg,
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        {loadError ? (
          <>
            <Txt bold>Unable to open your records</Txt>
            <Txt>{loadError}</Txt>
            <Txt>
              Your saved data has not been replaced. Restart the app to retry.
            </Txt>
          </>
        ) : (
          <ActivityIndicator color={theme.green} size="large" />
        )}
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style="dark" />
      <View style={{ flex: 1, flexDirection: wide ? "row" : "column" }}>
        {wide && (
          <View
            style={{
              width: 224,
              backgroundColor: "#FFF",
              borderRightWidth: 1,
              borderRightColor: theme.line,
              padding: 24,
              gap: 32,
            }}
          >
            <Brand />
            <View style={{ gap: 10 }}>
              {tabs.map((t) => (
                <Pressable
                  key={t.name}
                  onPress={() => setTab(t.name)}
                  accessibilityRole="button"
                  style={[
                    styles.row,
                    {
                      padding: 14,
                      borderRadius: 12,
                      backgroundColor: tab === t.name ? theme.pale : "#FFF",
                    },
                  ]}
                >
                  <Icon
                    name={t.icon}
                    color={tab === t.name ? theme.green : theme.muted}
                  />
                  <Txt bold={tab === t.name}>{t.name}</Txt>
                </Pressable>
              ))}
            </View>
            <View style={{ flex: 1 }} />
            <Card style={{ backgroundColor: theme.bg, padding: 15 }}>
              <Icon name="shield" color={theme.green} />
              <Txt bold size={12}>
                Your records, yours.
              </Txt>
              <Txt size={12} color={theme.muted}>
                Saved on this device. No account needed.
              </Txt>
            </Card>
          </View>
        )}
        <View style={{ flex: 1 }}>
          {!wide && (
            <View
              style={[
                styles.between,
                { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 6 },
              ]}
            >
              <Brand />
              <View style={styles.row}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: theme.green,
                  }}
                />
                <Txt size={11} color={theme.muted}>
                  ON DEVICE
                </Txt>
              </View>
            </View>
          )}
          <ScrollView
            contentContainerStyle={{
              padding: wide ? 36 : 20,
              gap: 22,
              maxWidth: 1150,
              width: "100%",
              alignSelf: "center",
              paddingBottom: 36,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.between}>
              <View style={{ flex: 1 }}>
                <Txt size={11} color={theme.green} bold>
                  YOUR HOURS. YOUR EARNINGS.
                </Txt>
                <Txt size={wide ? 32 : 27} bold>
                  {tab === "Dashboard"
                    ? "Welcome to your dashboard"
                    : tab === "Calendar"
                      ? "Your work, at a glance"
                      : tab === "Jobs"
                        ? "Your jobs"
                        : tab === "Summary"
                          ? "The bigger picture"
                          : tab === "Compare"
                            ? "Check your pay"
                            : "Make it yours"}
                </Txt>
                <Txt color={theme.muted}>
                  {tab === "Dashboard"
                    ? "Your working life, all in one place."
                    : tab === "Calendar"
                      ? "A little clarity for every working day."
                      : tab === "Jobs"
                        ? "Different jobs. One place to keep track."
                        : tab === "Summary"
                          ? "Know what your time adds up to."
                          : tab === "Compare"
                            ? "Your records alongside your payslip."
                            : "Your data stays in your hands."}
                </Txt>
              </View>
              {wide && (
                <Button
                  title={tab === "Jobs" ? "New job" : "Add shift"}
                  icon="plus"
                  onPress={() =>
                    tab === "Jobs" ? setEditor({ kind: "job" }) : addShift()
                  }
                />
              )}
            </View>
            {!!notice && (
              <Pressable
                onPress={() => setNotice("")}
                style={{
                  backgroundColor: theme.pale,
                  padding: 14,
                  borderRadius: 12,
                }}
              >
                <Txt>{notice} ×</Txt>
              </Pressable>
            )}
            {(tab === "Calendar" || tab === "Summary") && (
              <Chips
                values={[
                  { value: "all", label: "All jobs" },
                  ...data.jobs.map((j) => ({
                    value: j.id,
                    label: j.title + (j.archived ? " (archived)" : ""),
                  })),
                ]}
                selected={filter}
                onSelect={setFilter}
              />
            )}
            {tab === "Dashboard" && (
              <Dashboard
                data={data}
                onAdd={() => {
                  setSelected(today());
                  addShift();
                }}
                onCalendar={() => setTab("Calendar")}
                onCycles={(id) =>
                  router.replace({
                    pathname: "/[destination]",
                    params: {
                      destination: "summary",
                      ...(id ? { job: id } : {}),
                    },
                  })
                }
              />
            )}
            {tab === "Calendar" && (
              <>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <Card
                    style={{
                      flex: 1,
                      backgroundColor: theme.ink,
                      borderColor: theme.ink,
                    }}
                  >
                    <Txt size={12} color="#B9D2C8">
                      HOURS THIS MONTH
                    </Txt>
                    <Txt size={wide ? 34 : 28} bold color="#FFF">
                      {hoursText(monthly.minutes)}
                      <Txt size={18} color="#B9D2C8">
                        {" "}
                        h
                      </Txt>
                    </Txt>
                    <Txt size={12} color="#B9D2C8">
                      {monthShifts.length} recorded shifts
                    </Txt>
                  </Card>
                  <Card style={{ flex: 1 }}>
                    <Txt size={12} color={theme.muted}>
                      ESTIMATED GROSS
                    </Txt>
                    <Txt size={wide ? 30 : 23} bold>
                      {earnings(monthly)}
                    </Txt>
                    <Txt size={12} color={theme.muted}>
                      Before tax & deductions
                    </Txt>
                  </Card>
                </View>
                <View
                  style={{
                    flexDirection: wide ? "row" : "column",
                    gap: 20,
                    alignItems: "stretch",
                  }}
                >
                  <Card style={{ flex: wide ? 1.65 : undefined }}>
                    <View style={styles.between}>
                      <Txt size={20} bold>
                        {first.toFormat("MMMM yyyy")}
                      </Txt>
                      <View style={styles.row}>
                        <NavArrow
                          label="Previous month"
                          name="chevron-left"
                          onPress={() =>
                            setMonth(
                              first.minus({ months: 1 }).toFormat("yyyy-MM"),
                            )
                          }
                        />
                        <Pressable
                          onPress={() => {
                            setMonth(today().slice(0, 7));
                            setSelected(today());
                          }}
                        >
                          <Txt size={12} color={theme.green} bold>
                            Today
                          </Txt>
                        </Pressable>
                        <NavArrow
                          label="Next month"
                          name="chevron-right"
                          onPress={() =>
                            setMonth(
                              first.plus({ months: 1 }).toFormat("yyyy-MM"),
                            )
                          }
                        />
                      </View>
                    </View>
                    <View style={{ flexDirection: "row" }}>
                      {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                        <View
                          key={i}
                          style={{ width: "14.2857%", alignItems: "center" }}
                        >
                          <Txt size={11} color={theme.muted} bold>
                            {d}
                          </Txt>
                        </View>
                      ))}
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        rowGap: 5,
                      }}
                    >
                      {Array.from(
                        {
                          length:
                            Math.ceil(
                              (first.weekday - 1 + first.daysInMonth!) / 7,
                            ) * 7,
                        },
                        (_, i) => {
                          const d = first.plus({ days: i - first.weekday + 1 }),
                            iso = d.toISODate()!,
                            inMonth = d.month === first.month;
                          const day = days.get(iso) || {
                            minutes: 0,
                            colors: [],
                          };
                          const chosen = selected === iso;
                          const jobColors = day.colors;
                          return (
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel={`${dateLabel(iso)}, ${hoursText(day.minutes)} hours`}
                              key={iso}
                              onPress={() => {
                                setSelected(iso);
                                setEditor({ kind: "day" });
                                if (!inMonth) setMonth(d.toFormat("yyyy-MM"));
                              }}
                              style={{ width: "14.2857%", padding: 2 }}
                            >
                              <View
                                style={{
                                  minHeight: wide ? 72 : 61,
                                  borderRadius: 12,
                                  backgroundColor: chosen
                                    ? theme.green
                                    : day.minutes
                                      ? "#EEF5EF"
                                      : "#FFF",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 2,
                                  borderWidth:
                                    iso === today() && !chosen ? 1 : 0,
                                  borderColor: theme.green,
                                }}
                              >
                                <Txt
                                  bold={chosen || iso === today()}
                                  color={
                                    chosen
                                      ? "#FFF"
                                      : inMonth
                                        ? theme.ink
                                        : "#B6C0B9"
                                  }
                                >
                                  {d.day}
                                </Txt>
                                <Txt
                                  size={10}
                                  color={chosen ? "#DDEFE7" : theme.green}
                                >
                                  {day.minutes
                                    ? `${hoursText(day.minutes)}h`
                                    : " "}
                                </Txt>
                                <View style={{ flexDirection: "row", gap: 3 }}>
                                  {jobColors.slice(0, 3).map((c, i) => (
                                    <View
                                      key={i}
                                      style={{
                                        height: 4,
                                        width: 4,
                                        borderRadius: 2,
                                        backgroundColor: chosen ? "#FFF" : c,
                                      }}
                                    />
                                  ))}
                                </View>
                              </View>
                            </Pressable>
                          );
                        },
                      )}
                    </View>
                    <View style={styles.wrap}>
                      {data.jobs
                        .filter((j) => !j.archived)
                        .map((j) => (
                          <View key={j.id} style={styles.row}>
                            <View
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: 4,
                                backgroundColor: j.color,
                              }}
                            />
                            <Txt size={11} color={theme.muted}>
                              {j.title}
                            </Txt>
                          </View>
                        ))}
                    </View>
                  </Card>
                  <Card style={{ flex: wide ? 1 : undefined }}>
                    <View style={styles.between}>
                      <View>
                        <Txt size={11} color={theme.muted}>
                          {dateLabel(selected, "EEEE").toUpperCase()}
                        </Txt>
                        <Txt size={21} bold>
                          {dateLabel(selected, "d MMMM")}
                        </Txt>
                      </View>
                      <Icon name="sun" color={theme.green} />
                    </View>
                    {selectedShifts.length ? (
                      selectedShifts.map((s) => (
                        <ShiftCard
                          key={s.id}
                          shift={s}
                          job={data.jobs.find((j) => j.id === s.jobId)!}
                          onPress={() => setEditor({ kind: "shift", shift: s })}
                        />
                      ))
                    ) : (
                      <Empty
                        title={
                          activeJobs.length
                            ? "A clear day"
                            : "Your first shift starts here"
                        }
                        detail={
                          activeJobs.length
                            ? "Worked today? Add a shift and make every hour count."
                            : "Create a job with your pay rate and usual shifts to get started."
                        }
                      />
                    )}
                    <Button
                      title={
                        activeJobs.length
                          ? "Add shift"
                          : "Create your first job"
                      }
                      icon="plus"
                      onPress={addShift}
                    />
                    <Txt size={11} color={theme.muted}>
                      Tap a shift to edit its hours, rate or notes.
                    </Txt>
                  </Card>
                </View>
              </>
            )}
            {tab === "Jobs" && (
              <>
                <Button
                  title="Create a job"
                  icon="plus"
                  onPress={() => setEditor({ kind: "job" })}
                />
                {!data.jobs.length && (
                  <Empty
                    icon="briefcase"
                    title="Room for every role"
                    detail="Add your workplace, pay cycle and favourite shift patterns."
                  />
                )}
                {data.jobs.map((j) => (
                  <Card key={j.id}>
                    <View style={styles.between}>
                      <View style={[styles.row, { flex: 1 }]}>
                        <View
                          style={{
                            backgroundColor: j.color,
                            padding: 12,
                            borderRadius: 14,
                          }}
                        >
                          <Icon name="briefcase" color="#FFF" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Txt bold size={19}>
                            {j.title}
                            {j.archived ? " · Archived" : ""}
                          </Txt>
                          <Txt color={theme.muted}>
                            {j.employer || "Personal workplace"}
                          </Txt>
                        </View>
                      </View>
                      <Button
                        secondary
                        title="Edit"
                        onPress={() => setEditor({ kind: "job", job: j })}
                      />
                    </View>
                    <View style={styles.wrap}>
                      <Txt bold>{money(j.rate, j.currency)}/hr</Txt>
                      <Txt color={theme.muted}>
                        · {cycles[j.cycle]} · {j.zone}
                      </Txt>
                    </View>
                    <View style={styles.wrap}>
                      {j.presets.map((p) => (
                        <View key={p.id} style={styles.chip}>
                          <Txt size={12}>
                            {p.name} · {p.hours}h
                          </Txt>
                        </View>
                      ))}
                    </View>
                    {!!j.notes && <Txt color={theme.muted}>{j.notes}</Txt>}
                    <Button
                      secondary
                      title={j.archived ? "Reactivate job" : "Archive job"}
                      onPress={() =>
                        action(
                          () =>
                            commit((d) => ({
                              ...d,
                              jobs: d.jobs.map((x) =>
                                x.id === j.id
                                  ? { ...x, archived: !x.archived }
                                  : x,
                              ),
                            })),
                          j.archived
                            ? "Job reactivated."
                            : "Job archived. Past shifts are preserved.",
                        )
                      }
                    />
                  </Card>
                ))}
              </>
            )}
            {tab === "Summary" && (
              <Summary
                data={data}
                filter={filter}
                busy={busy}
                action={action}
              />
            )}
            {tab === "Compare" && <Compare data={data} commit={commit} />}
            {tab === "Settings" && (
              <>
                <Card>
                  <Icon name="shield" color={theme.green} />
                  <Txt size={21} bold>
                    Private by design
                  </Txt>
                  <Txt color={theme.muted}>
                    Your jobs, shifts and pay records stay on this device. There
                    are no accounts, adverts or analytics. Backups and reports
                    leave the app only when you choose to share them.
                  </Txt>
                  <Txt color={theme.muted}>
                    Uninstalling the app or losing this device may erase your
                    records. Save regular backups somewhere you trust.
                  </Txt>
                </Card>
                <Card>
                  <Txt size={19} bold>
                    Backup & restore
                  </Txt>
                  <Txt color={theme.muted}>
                    {data.jobs.length} jobs · {data.shifts.length} shifts ·{" "}
                    {data.comparisons.length} employer records
                  </Txt>
                  <Button
                    title="Export full backup"
                    icon="download"
                    disabled={busy}
                    onPress={() =>
                      action(
                        () =>
                          exportText(
                            `shiftproof-backup-${today()}.json`,
                            JSON.stringify(data, null, 2),
                            "application/json",
                          ),
                        "Backup export opened. Save a copy in a safe place.",
                      )
                    }
                  />
                  <Button
                    title="Import a backup"
                    secondary
                    icon="upload"
                    disabled={busy}
                    onPress={() =>
                      action(async () => {
                        const d = await importBackup();
                        if (d) setRestore(d);
                      })
                    }
                  />
                  {restore && (
                    <Card style={{ backgroundColor: "#FFF6E9" }}>
                      <Txt bold>Replace your current records?</Txt>
                      <Txt>
                        This backup contains {restore.jobs.length} jobs and{" "}
                        {restore.shifts.length} shifts. Export your current
                        backup first if you want to keep it.
                      </Txt>
                      <Button
                        danger
                        title="Replace with this backup"
                        disabled={busy}
                        onPress={() =>
                          action(async () => {
                            await commit(() => restore);
                            setRestore(null);
                            setFilter("all");
                          }, "Backup restored.")
                        }
                      />
                      <Button
                        secondary
                        title="Cancel import"
                        onPress={() => setRestore(null)}
                      />
                    </Card>
                  )}
                </Card>
                <Card>
                  <Txt bold size={19}>
                    How estimates work
                  </Txt>
                  <Txt color={theme.muted}>
                    All pay figures are gross estimates before deductions. Enter
                    overtime hours manually according to your contract. Shifts
                    retain their recorded rates when job rates change.
                  </Txt>
                  <Txt color={theme.muted}>
                    Hours-only entries belong to their chosen date. Timed shifts
                    use actual elapsed time in the saved time zone and split at
                    midnight. Breaks, overtime and pay are shared proportionally
                    across those dates.
                  </Txt>
                  <Txt color={theme.muted}>
                    A possible discrepancy can come from different pay periods,
                    breaks, allowances or adjustments. Your entries are personal
                    records, not independent proof of attendance.
                  </Txt>
                </Card>
                <Txt size={12} color={theme.muted}>
                  ShiftProof 1.0.0 · Your hours. Your earnings. Your proof.
                </Txt>
              </>
            )}
          </ScrollView>
          {!wide && tab === "Calendar" && (
            <View style={{ position: "absolute", right: 20, bottom: 16 }}>
              <Button title="Add shift" icon="plus" onPress={addShift} />
            </View>
          )}
        </View>
        {!wide && (
          <View
            style={{
              flexDirection: "row",
              backgroundColor: "#FFF",
              borderTopWidth: 1,
              borderColor: theme.line,
              paddingTop: 10,
              paddingBottom: 6,
            }}
          >
            {tabs.map((t) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: tab === t.name }}
                key={t.name}
                onPress={() => setTab(t.name)}
                style={{ flex: 1, alignItems: "center", padding: 6, gap: 5 }}
              >
                <Icon
                  name={t.icon}
                  color={tab === t.name ? theme.green : theme.muted}
                />
                <Txt
                  size={10}
                  bold={tab === t.name}
                  color={tab === t.name ? theme.green : theme.muted}
                >
                  {t.name}
                </Txt>
              </Pressable>
            ))}
          </View>
        )}
      </View>
      <Modal
        visible={!!editor}
        animationType="slide"
        onRequestClose={() => setEditor(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View
              style={[
                styles.between,
                {
                  padding: 20,
                  width: "100%",
                  maxWidth: 650,
                  alignSelf: "center",
                },
              ]}
            >
              <Txt size={24} bold>
                {editor?.kind === "job"
                  ? editor.job
                    ? "Edit job"
                    : "New job"
                  : editor?.kind === "day"
                    ? dateLabel(selected, "d MMMM")
                    : editor?.kind === "shift" && editor.shift
                      ? "Edit shift"
                      : "Add a shift"}
              </Txt>
              <Button secondary title="Close" onPress={() => setEditor(null)} />
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                gap: 16,
                maxWidth: 650,
                width: "100%",
                alignSelf: "center",
                paddingBottom: 60,
              }}
            >
              {editor?.kind === "day" && (
                <>
                  <Txt color={theme.muted}>
                    {dateLabel(selected, "EEEE, d MMMM yyyy")}
                  </Txt>
                  {selectedShifts.map((s) => (
                    <ShiftCard
                      key={s.id}
                      shift={s}
                      job={data.jobs.find((j) => j.id === s.jobId)!}
                      onPress={() => setEditor({ kind: "shift", shift: s })}
                    />
                  ))}
                  {!selectedShifts.length && (
                    <Empty
                      title="A fresh page for your day"
                      detail="Choose your job and a usual shift, then adjust anything that changed."
                    />
                  )}
                  <Button
                    title={activeJobs.length ? "Add shift" : "Create a job"}
                    icon="plus"
                    onPress={addShift}
                  />
                </>
              )}
              {editor?.kind === "job" && (
                <JobForm
                  initial={editor.job}
                  onSave={async (j) => {
                    await commit((d) => ({
                      ...d,
                      jobs: [...d.jobs.filter((x) => x.id !== j.id), j],
                    }));
                    setEditor(null);
                    setNotice(
                      "Job saved. You can now choose it when adding a shift.",
                    );
                  }}
                />
              )}
              {editor?.kind === "shift" && (
                <ShiftForm
                  date={selected}
                  initial={editor.shift}
                  jobs={data.jobs}
                  onSave={async (s) => {
                    await commit((d) => ({
                      ...d,
                      shifts: [...d.shifts.filter((x) => x.id !== s.id), s],
                    }));
                    setSelected(s.date);
                    setMonth(s.date.slice(0, 7));
                    setEditor(null);
                    setNotice("Shift saved on this device.");
                  }}
                  onDelete={async (s) => {
                    await commit((d) => ({
                      ...d,
                      shifts: d.shifts.filter((x) => x.id !== s.id),
                    }));
                    setEditor(null);
                    setNotice("Shift deleted.");
                  }}
                />
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
function Brand() {
  return (
    <View style={styles.row}>
      <View
        style={{ padding: 8, backgroundColor: theme.green, borderRadius: 11 }}
      >
        <Icon name="check" color="#FFF" size={21} />
      </View>
      <Txt bold size={21}>
        ShiftProof
        <Txt color={theme.green} size={22}>
          .
        </Txt>
      </Txt>
    </View>
  );
}
function NavArrow({
  label,
  name,
  onPress,
}: {
  label: string;
  name: "chevron-left" | "chevron-right";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{ padding: 9 }}
    >
      <Icon name={name} size={18} />
    </Pressable>
  );
}
function ShiftCard({
  shift: s,
  job,
  onPress,
}: {
  shift: Shift;
  job: Job;
  onPress: () => void;
}) {
  const c = calculate(s);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={{
        padding: 16,
        borderRadius: 14,
        backgroundColor: "#F4F7F2",
        borderLeftWidth: 3,
        borderLeftColor: job.color,
        gap: 8,
      }}
    >
      <View style={styles.between}>
        <Txt size={11} bold color={job.color}>
          {job.title.toUpperCase()}
        </Txt>
        <Icon name="arrow-up-right" size={16} />
      </View>
      <Txt bold size={17}>
        {s.title}
      </Txt>
      <Txt size={12} color={theme.muted}>
        {s.mode === "times"
          ? `${s.start} – ${s.end}${s.nextDay ? " (+1 day)" : ""}`
          : `${s.hours}h shift`}{" "}
        · {s.breakMinutes}m break
      </Txt>
      <View style={styles.between}>
        <Txt bold>{hoursText(c.minutes)} paid hours</Txt>
        <Txt bold>{money(c.gross, s.currency)}</Txt>
      </View>
      {s.nextDay && s.mode === "times" && (
        <Txt size={11} color={theme.muted}>
          Whole shift · starts {dateLabel(s.date, "d MMM")}
        </Txt>
      )}
      {!!s.notes && (
        <Txt size={12} color={theme.muted}>
          {s.notes}
        </Txt>
      )}
    </Pressable>
  );
}
