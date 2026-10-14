# Contributing to OpenSlide

Use Windows 10/11 x64 and Node.js 22 or later.

```powershell
npm ci
npm start
npm test
npm run test:ui
npm run test:responsive
```

The Electron main process owns planner data, timers, calendar credentials, and native Windows integration. The renderer receives validated state through the preload bridge. Keep Node integration off, context isolation and sandboxing on, and validate new IPC operations in the main process.

Keep changes focused. Explain the behavior being changed, include a screenshot for visual changes, and record the checks you ran. Verify narrow side panels, top drawers, large text, keyboard navigation, and reduced motion when changing layouts. Use a temporary `--test-mode --data-dir=...` profile for testing; never use real calendar credentials in fixtures.

The animated README tutorial is generated from the running app with `npm run docs:demo`. It uses synthetic data and a neutral presentation background. Generated GIF/MP4 files belong in `docs/media/`; raw frames remain in the ignored `.test-output/` folder.

Contributions use the [MIT license](LICENSE). Retain the third-party font license notices supplied with the assets.
