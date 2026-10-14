# Windows validation

Validated on 14 October 2026 for OpenSlide 0.2.0.

## Planner and integration checks

All 14 unit/provider/geometry checks pass. They cover countdown deadlines, pause exclusion, stopwatch checkpoints, interrupted-session recovery, local-midnight attribution, task/reminder operations, atomic saving, corrupt-data preservation, preference migration, multi-monitor geometry, and simulated Google Calendar OAuth/event loading.

## Interface checks

- End-to-end smoke checks cover tasks, notes, Ctrl+Enter conversion, focus controls, reminders, settings, insights, collapse/reopen, simulated corner opening, auto-hide, sandbox boundaries, and saved state after restart.
- Task-management checks cover held clicks, renaming without timer reset, complete/reopen, duplication, deletion, rescheduling, search, bundled font rendering, and optional system-font preferences.
- Dialog checks verify every field and action remains unobscured at narrow side and short top sizes, with Save/Cancel reachable and nested date dialogs preserving edits.
- Compact-layout checks cover all five positions, monitor containment, chart visibility, and large text across all three themes.
- Responsive checks cover every page at 340, 640, 800, and 1120 logical pixels, plus forced colors and reduced motion.
- Companion checks cover all character choices, still/gentle motion, hidden-tab animation pausing, and saved preferences.

## Packaged app

The Windows x64 installer builds successfully. Smoke and compact-layout checks pass against the packaged OpenSlide.exe. The GitHub Windows build runs model/provider tests and produces installer and portable artifacts with SHA-256 checksums. Installer building explicitly disables implicit publishing; the release job handles uploads.

## Demo

The 188-frame tutorial is 23.5 seconds long. Intro, notes, personalization, and closing frames were inspected visually. The GIF, MP4, and overview image are in docs/media; raw frames and test profiles are excluded from the repository.

## Checks that need a device or account

The installer is unsigned. Live Google sign-in, actual Windows notification delivery, launch-at-login behavior, and physical mixed-DPI monitor combinations need account/device checks. The installer was not installed into the user's profile as part of automated validation.
