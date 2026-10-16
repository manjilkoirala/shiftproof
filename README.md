# ShiftProof

An offline-first React Native + Expo app for Android, with a responsive browser preview.

## Run

```sh
npm install
npm start
```

Scan the development QR code with an SDK-compatible Expo Go app, or run `npm run android` with an Android emulator connected. `npm run web` opens the browser version. Android uses SQLite; the browser preview uses localStorage. Data does not sync between them.

## Included

- Dashboard opening screen with month-to-date totals and current earnings for each job's pay cycle.
- Summary opens on Pay cycles: browse previous/next cycles, jump to any date, expand history back to the first recorded shift, and export an individual cycle. Date range retains week, month and custom reporting.
- Multiple jobs with employer, title, colour, notes, currency, IANA time zone, normal and overtime rates.
- Weekly, fortnightly, four-week and monthly cycles anchored to a period start date.
- Up to 50 named shift presets per job; editable duration, start time and unpaid break.
- Calendar with daily totals, job filters, multiple shifts per day, and add/edit/delete.
- Hours-only and timed entries, overnight work, unpaid breaks, manually assigned overtime, rate snapshots.
- Custom-range summaries and current pay-period shortcuts; separate currency totals.
- Saved employer comparisons, CSV exports, printable PDF reports, validated JSON backup and restore.
- Archive/reactivate jobs without deleting their historical records.
- No login, backend, ads, analytics or automatic cloud backup.

## Calculation rules

Amounts are integer minor units (pence for GBP); pay rounds once per shift. Preset hours and entered hours mean elapsed shift duration **before unpaid breaks**. Overtime is a subset of paid time, not additional hours. There is no automatic weekly overtime threshold because contracts differ.

Timed shifts use actual elapsed time in the saved IANA zone. Nonexistent or ambiguous DST boundary times are rejected with instructions to enter actual elapsed hours. Timed entries split across local dates; breaks, overtime and money are allocated proportionally, conserving the original totals. Hours-only shifts are wholly attributed to their entered date. These allocation rules are visible in Settings and reports.

Pay cycles use inclusive start/end dates in reports. Monthly anchors such as the 31st clamp to the shorter month's last day without drifting the original anchor. Jobs cannot change currency after creation. Existing shifts retain their rates and time zone even when job defaults change.

## Structure

- `src/app/`: Expo Router entry routes and stack layout. `/` opens Dashboard; the other destinations have named routes.
- `src/Dashboard.tsx`, `src/PayCyclesView.tsx`, `src/payCycles.ts`: dashboard, cycle browsing and history.
- `src/domain.ts`: validated data model, pure calculations, pay cycles and date allocation.
- `src/storage.ts`: SQLite repository, WAL mode, schema version 1, atomic snapshot replacement. One versioned JSON aggregate is stored in SQLite for this MVP; normalized tables can be introduced through a later migration.
- `src/storage.web.ts`: browser-only storage adapter.
- `src/forms.tsx`, `src/Main.tsx`, `src/reports.tsx`, `src/ui.tsx`: native screens and shared controls.
- `src/transfer.ts`: file backup/import, CSV and PDF report sharing.
- `tests/domain.test.ts`: calculation and backup validation tests.

State is updated only after persistence succeeds. Concurrent saves are rejected. Imports validate every record and relationship before a single atomic replacement. Failed loads do not overwrite stored records.

## Checks

```sh
npm test
npm run typecheck
npx expo-doctor
npm run export
```

See `docs/VALIDATION.md` for completed checks and remaining device verification.

## Android packages

`eas.json` contains an internal APK profile and production Android App Bundle profile. Once signed into your own Expo account:

```sh
npx eas-cli login
npx eas-cli build:configure
npx eas-cli build --platform android --profile preview
npx eas-cli build --platform android --profile production
```

The package identifier is `com.shiftproof.app`; confirm ownership and choose your final identifier before your first release. EAS project linkage and Android signing credentials belong to the publisher and have not been created here. Builds may use your Expo plan's allowance. No app has been uploaded or submitted to Google Play.

Before publication, test on physical Android devices, complete Play Console requirements, publish the privacy policy with a real publisher contact, prepare store screenshots, and resolve or explicitly review outstanding upstream dependency advisories. Do not run `npm audit fix --force`: its suggested Expo downgrade is incompatible with this project.
