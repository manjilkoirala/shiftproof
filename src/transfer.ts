import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as Print from "expo-print";
import {
  Data,
  hoursText,
  money,
  validateData,
  portions,
  totals,
} from "./domain";
export async function exportText(name: string, content: string, mime: string) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  if (!(await Sharing.isAvailableAsync()))
    throw new Error("File sharing is not available on this device.");
  await Sharing.shareAsync(file.uri, {
    mimeType: mime,
    dialogTitle: "Save your ShiftProof export",
  });
}
export async function importBackup(): Promise<Data | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain"],
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (asset.size && asset.size > 25000000)
    throw new Error("Choose a backup smaller than 25 MB.");
  const raw =
    Platform.OS === "web"
      ? await (await fetch(asset.uri)).text()
      : await new File(asset.uri).text();
  return validateData(JSON.parse(raw));
}
const csv = (value: unknown) => {
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};
export function makeCSV(data: Data, from: string, to: string, jobId?: string) {
  const rows: unknown[][] = [
    [
      "Date",
      "Job",
      "Shift",
      "Paid hours",
      "Gross estimate",
      "Currency",
      "Hourly rate",
      "Overtime rate",
      "Notes",
      "Updated at",
    ],
  ];
  data.shifts
    .filter((s) => !jobId || s.jobId === jobId)
    .forEach((s) =>
      portions(s)
        .filter((p) => p.date >= from && p.date <= to)
        .forEach((p) =>
          rows.push([
            p.date,
            data.jobs.find((j) => j.id === s.jobId)?.title,
            s.title,
            (p.minutes / 60).toFixed(2),
            (p.gross / 100).toFixed(2),
            s.currency,
            s.rate / 100,
            s.overtimeRate / 100,
            s.notes,
            s.updatedAt,
          ]),
        ),
    );
  return "\uFEFF" + rows.map((r) => r.map(csv).join(",")).join("\r\n");
}
const escape = (s: unknown) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function pdfReport(
  data: Data,
  from: string,
  to: string,
  jobId?: string,
) {
  const rows = data.shifts
    .filter((s) => !jobId || s.jobId === jobId)
    .flatMap((s) =>
      portions(s)
        .filter((p) => p.date >= from && p.date <= to)
        .map(
          (p) =>
            `<tr><td>${p.date}</td><td>${escape(data.jobs.find((j) => j.id === s.jobId)?.title)}<br><small>${escape(s.title)}</small></td><td>${hoursText(p.minutes)}</td><td>${money(p.gross, s.currency)}</td></tr>`,
        ),
    )
    .join("");
  const comparisons = data.comparisons
    .filter(
      (c) => (!jobId || c.jobId === jobId) && c.from >= from && c.to <= to,
    )
    .map((c) => {
      const j = data.jobs.find((j) => j.id === c.jobId)!;
      const actual = totals(
        data.shifts.filter((s) => s.jobId === c.jobId),
        c.from,
        c.to,
      );
      return `<p><strong>${escape(j.title)}</strong> · ${c.from} to ${c.to}<br>Employer: ${c.hours} hours / ${money(c.gross, j.currency)} gross.<br>Your records: ${hoursText(actual.minutes)} hours / ${money(actual.currencies[j.currency] || 0, j.currency)}.<br>Possible discrepancy (records minus employer): ${hoursText(actual.minutes - Math.round(c.hours * 60))} hours / ${money((actual.currencies[j.currency] || 0) - c.gross, j.currency)}.<br>${escape(c.notes)}</p>`;
    })
    .join("");
  const html = `<html><head><meta charset="utf-8"><style>@page{margin:32px}body{font-family:Arial;color:#193B35;font-size:12px}h1{font-size:28px}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:10px;border-bottom:1px solid #ddd}thead{display:table-header-group}tr{page-break-inside:avoid}small,p{color:#596963}</style></head><body><h1>ShiftProof</h1><p>Personal work record · ${from} — ${to}</p><table><thead><tr><th>Date</th><th>Job / shift</th><th>Paid hours</th><th>Estimated gross</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No recorded shifts in this period.</td></tr>'}</tbody></table><h2>Employer records</h2>${comparisons || "<p>No employer records wholly within this range.</p>"}<p>Estimates before deductions. Differences are possible discrepancies, not proof of underpayment. Clock-based shifts split at local midnight; breaks and overtime are allocated proportionally. Hours-only shifts belong to their entered date.</p></body></html>`;
  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const result = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(result.uri, { mimeType: "application/pdf" });
}
