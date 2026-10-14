# Design principles

OpenSlide keeps daily planning within reach while leaving room for the rest of your desktop.

## Compact by design

The workspace opens from a screen corner as a small side panel. Top positions use a horizontal drawer. Native bounds fit the selected monitor's available work area, with responsive columns and scrolling for smaller displays.

## Clear hierarchy

- Selected navigation has a distinct surface and visible focus state.
- Paper-colored cards separate tasks, focus, notes, and reminders.
- Tabular timer digits keep the countdown steady; the active task and Focusing indicator make the current session clear.
- Secondary controls stay quiet until needed. Task editing uses a bounded dialog with a fixed Save/Cancel row.
- Empty states explain where to begin without adding unnecessary controls.

## Personal appearance

Inter is the bundled default. Other font, text-size, accent, theme, glass-intensity, corner, and companion choices live in Customize. Existing preferences are preserved across updates.

## Accessible interaction

Controls support keyboard navigation, visible focus, larger text, forced colors, and reduced motion. Hover delays reduce accidental opening; pinning and text-entry protection keep the panel available when needed.

## Tutorial

The README animation uses real OpenSlide window captures, synthetic tasks/notes, a neutral presentation background, and numbered instructions. Cursor coordinates are simulated through the test harness. Run npm run docs:demo to recreate the GIF and MP4.
