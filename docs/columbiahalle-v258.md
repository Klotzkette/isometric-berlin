> Historical release record: actual recordings were withdrawn in v1.0.160 at the owner’s request. Current Columbiahalle uses a silent procedural graphic loop only; see [v260](venues-v260.md).

# Columbiahalle media and interior follow-up — v258

This bounded follow-up incorporates the owner's additional Columbiahalle media.
Three of the four supplied photographs are byte-identical to earlier references:
the two exterior views and the red-lit interior view. The remaining photograph
adds a blue-lit interior view. The exterior photographs confirm the existing
three double doors, steps, blue venue lettering, dated marquee and KASSE; no
additional facade geometry or source-envelope change was necessary.

The renewed interior comparison supports triangular truss webs, the large
ventilation duct under the right side of the roof, suspended stage lights,
stage-left cable drops and an open balcony rail. These join the existing static
instance batch. Only the two previously illustrative solid balcony panels are
replaced by open rails and uprights; their exact old centres and dimensions are
recorded in the [photo supplement](columbiahalle-v257-photo-supplement.md).
The existing decks, stage, audience, performers and structural chords remain.
All interior dimensions, counts, repetition and symmetry remain illustrative
display estimates, not an as-built survey.

Drawn truss diagonals and faceted duct surfaces use rotated box instances.
Minecraft uses independently constructed orthogonal steps and duct slices.
Mobile retains the complete detail of its selected family. Both families still
use ten mesh batches, with no new renderer, animation loop, city packet or live
residency allowance.

| Temporary interior resource | Drawn | Native |
|---|---:|---:|
| GPU attribute/index/instance arrays | 72,780 B | 93,624 B |
| Previous GPU arrays | 59,404 B | 70,672 B |
| Instances | 930 | 1,248 |
| Mesh batches | 10 | 10 |
| Browser render calls (two-sided transparent light passes included) | 18 | 18 |

Both remain below the existing 100,000-byte interior test ceiling. Static details
share the existing scene lifetime and disposal, including explicit disposal of
instanced GPU buffers. The existing slow light cycle, reduced-motion still view,
hidden-view suspension and outside-camera preservation remain in place.

The recording panel now offers three individually selected, silent local clips:
the original hall view, red stage lighting and a portrait close-up. The original
recording remains available; the two additional derivatives total 583,516 bytes.
The panel reuses one video element and loads only the selected recording on
request. Aspect-preserving containment presents the portrait clip without
cropping. All derivatives omit audio tracks and remain muted. Pause, return to
the light scene and exit remain available; labels follow the current German or
English interface language.

Each play attempt has a generation token. Clip changes, manual pause,
suspension and closing invalidate obsolete attempts, so a delayed rejection
cannot overwrite the current playback state. Closing pauses playback and
unloads the source. Arrow keys in the recording selector and other editable or
button controls pass through the window-level room handler; canvas arrow keys
continue to control the room view.

Media identities, hashes, derivatives and attribution are recorded in
[the v258 source receipt](columbiahalle-v258-sources.json). The earlier exterior
and source-preservation account remains in [the v257 report](columbiahalle-v257.md).
Photographs are reference-only and are not shipped as textures.

## Validation status

At the time of this report, 13 focused Bun tests passed with 1,790 assertions;
five focused Python tests, Ruff checks and TypeScript checking also passed.
Coverage includes geometry bounds, independent native transforms, physical
balcony openings, GPU disposal, light-cycle behavior, interaction lifetime,
selector keyboard handling, stale playback promises and single-video reuse.

The production build passed. Browser QA passed in iPhone 13 WebKit and desktop
Chrome, each in Day and Minecraft. Each case checked all three recordings,
aspect ratios, one video element, no initial media request, natural looping,
manual pause across clip switches and hidden/resume, preserved city camera,
and four entry/exit cycles. All concert GPU buffers were deleted on each exit (40 tracked allocations across
four drawn visits, 72 across four native visits, zero retained). No city GPU
buffers were created while inside;
no page error, crash or GL error was observed. Screenshots were inspected.
These bounded runs do not establish immunity to all browser/device failures.

The extracted package has 4,729 files and 934,000,260 bytes (890.732 MiB), below
the unchanged 891 MiB ceiling. Release readiness passed. Pages preflight retains
the exact previous two live asset sets and totals 1,043,425,697 bytes, leaving
30,316,127 bytes below 1 GiB. The local HTTP package smoke test passed. Both complete archive validators
passed before upload; GitHub returned matching sizes and SHA-256 digests.
Archives were built sequentially in RAM to avoid duplicate local disk usage.

| Archive | Bytes | SHA-256 |
|---|---:|---|
| `isometric-berlin-regierungsviertel-local.zip` | 753,721,529 | `affe3258e48af9b119cc23c8a7ad571f12aaf328ff1c021c12278f2154c0e818` |
| `isometric-berlin-viewer-v1.0.158.tar.gz` | 752,917,065 | `39f2849c503255bf78438d5d1f2e3d275b4e4efec185a883345fc98478632956` |

The implementation commit is `56d1d1537871d33b2cc616f747317ea69ecf1cab`.
Release tag `v1.0.158` points to `832211d5ca0073d698fdb79061a38f7a49c6fad9`.
Pages commit `1cfb51e4aa5a79e1975280bd521a59bba66015c8` deployed successfully
in GitHub Actions run `39668809645`. Nine hosted files (entry point, package
manifest, credits, all three videos and the three changed runtime bundles)
match the verified local package byte-for-byte. Both published archive sizes
and SHA-256 digests match their local validation receipts.

The complete public iPhone/WebKit Day concert flow passed: three selected silent
recordings with correct aspect ratios, pause and background/resume, natural
looping, camera preservation, four entry/exit cycles, zero retained concert GPU
buffers and no page/GL error or crash. The published release is
[v1.0.158](https://github.com/Klotzkette/isometric-berlin/releases/tag/v1.0.158).
