# v1.0.43 — uninterrupted held-key flight

Step 10. Releasing an arrow key publishes the new camera azimuth, changing
App's copy-view-link callback. The keyboard effect previously cleared every
held key when rebinding its listeners. W therefore stopped even though no W
keyup event had arrived. Listener rebinding now preserves held state; a separate
context cleanup still stops navigation on dialog/readiness/walking changes and
unmount. Blur and Escape retain their explicit stop paths.

The old v1.0.42 production package reproduces zero movement after releasing
ArrowLeft while W remains down. The fixed build continues through eight
alternating Left/Right/Up/Down presses without key repeat, then stops on W
release. The committed stability smoke exercises this sequence. Chrome observed
601 rendered frames and touch WebKit 625, without unwanted underwater/cutaway
states or unpainted resize tasks. Both exercised eight renderer resizes.

Fifteen focused navigation/shortcut/civic-flag tests pass (4,141 assertions),
as do all 459 Python tests, TypeScript build and Ruff checks. Release readiness
and the packaged local HTTP smoke are also checked before publication.

The existing presidential standard on the interim Spreebogen office was checked
in the ordinary day viewer: its clock advanced from 1.733 to 2.650 seconds and
its actual cloth vertices changed during a 1.2-second observation. No flag shape
or animation settings were changed. The owner's additional flag destination was
cut off in the message and remains unresolved; no destination was invented.

Geometry, materials, detail, view distance, render resolution, speeds and arrow
mappings are unchanged. WebKit touch emulation is not physical iPhone testing.
