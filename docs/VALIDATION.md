# Validation record

## Dashboard and cycle browsing update

- Dashboard is the opening route; navigation uses Expo Router.
- Summary defaults to pay cycles, with independent cycle browsing per job, previous/next navigation, jump-to-date, paginated history and cycle-specific exports. Custom date reports remain available.
- 19 calculation tests passed, including monthly anchor navigation, history pagination and empty cycles.
- Lint and TypeScript checks passed.
- Browser checks passed for dashboard entry, job-specific Summary navigation, previous/current/upcoming cycles, date jump and switching to custom date ranges.
- Android, iOS and web production bundles exported successfully. These are bundle checks, not signed device builds.

## Completed

- 15 automated domain tests: preset override, breaks, overtime, overnight shifts, invalid durations, spring/autumn DST, ambiguous/nonexistent times, rounding conservation, pay-period overlap, multiple currencies, weekly/biweekly/four-week periods, month-end anchors, historical rates, backup validation and bad dates/zones.
- TypeScript compile check.
- Expo Doctor: all 21 compatibility checks passed.
- Android Hermes bundle and browser production export.
- Browser UI: create a job with four-week cycle and two presets; choose a seven-hour preset, change it to six hours, save, verify 6 hours / GBP 76.26, reload and confirm persistence.
- Browser UI: edit the saved shift to include a 30-minute break; verify 5.5 paid hours / GBP 69.91. Save an employer comparison and verify the difference.
- Browser UI: create a second weekly-paid job with five presets (4, 6, 7, 8 and 10 hours), select its four-hour preset, and save on the same date. Verify combined totals of 9.5 hours / GBP 127.91.
- Responsive browser layouts checked at phone and desktop widths; no browser error logs. Screenshots are in `docs/screenshots/`. Preview records are labelled Demo and are not bundled into the native app.

## Release checks still required

- Physical Android testing of SQLite persistence, process termination, keyboard, small screens and accessibility text scaling.
- Native file picker, share sheet, PDF generation, backup export/import round trip and cancellation.
- Browser download-event verification timed out in the test browser; exported file download and import should also be checked in a normal browser. Schema validation and in-memory backup round trip are covered by automated tests.
- Signed APK/AAB installation and Play Console pre-launch report. A JavaScript/Hermes export is not an APK build.
- Privacy policy publisher/contact, store listing, screenshots, package ownership and release signing.
- Dependency audit currently reports 29 transitive advisories (18 high, 11 moderate), rooted in build-tool dependencies including braces, node-forge and uuid. Compatible audit fixes were applied, but remaining suggestions would downgrade Expo or its modules. Review upstream fixes before public release.

No Android SDK/device was detected on this workstation during the initial implementation. No release signing, remote EAS build or store submission was performed.

