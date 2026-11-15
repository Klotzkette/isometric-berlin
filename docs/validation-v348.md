# V348 validation

- Production build passed; complete TypeScript project check passed in isolation.
- 40 relevant frontend tests passed across ground/water, DB crown, V347/V348
  source history, ordinary/core facade colour and U-Bahn ground contracts. An
  interrupted file-read during the parallel run was rerun successfully alone
  (all six core-house tests, 185,945 assertions).
- Actual surrounding packets retained identical positions, colours, indices and
  navigation with V348 ground/water finish enabled versus disabled.
- Complete ZIP/TAR inventories match the same 6,702-file local package exactly.
  Public candidate retains all 6,076 original city packets and all six modes.
  Public bytes: 998,544,110; delta: 16,949. Offline bytes: 1,228,036,652.
- Existing broad Python-suite failures remain in the unchanged V261-to-V196
  manifest replay (14 setup errors); the run stopped after 43 passing tests.
  Unchanged source manifest and replay files demonstrate this is outside V348.
  Ruff reports 3 pre-existing findings in V334 bus/rail import scripts and
  formatting differences in 31 untouched files. Changed Python files pass the
  focused formatter/linter checks. Complete package readiness passes.
- Visual browser QA could not be completed: the app's internal browser transport
  closed before loading the local test page, including after a reset. No external
  browser was started. No screenshot, frame-rate or startup-time claim is made.
- The separately requested chimney is not identified; the location question
  remains open. No chimney was guessed or altered.
