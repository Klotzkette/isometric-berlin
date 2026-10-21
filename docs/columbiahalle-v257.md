# Columbiahalle entrance and silent concert — v257

The four supplied photographs and 21.87-second MOV inform a bounded entrance
refinement and an explicitly illustrative concert view. The actual supplied
recording is also available inside, as a silent local loop. The nearby Columbia
Theater is a separate building and is not changed.

The four measured v238 LoD2 parts of `DEBE07YY900008dL`, their source roof/wall
surfaces, side door, eaves and navigation remain intact. The exact previous
single name-board/lettering estimate and two main-door proxies are receipted in
`columbiahalle-v257-evidence.json.gz`. A whole-packed-mesh fingerprint gates the
replacement; a changed prior source fails closed. No old source packet or v238
replacement JSON is rewritten. The correction uses its existing `2_7` batch and
its existing decode, residency, culling and disposal lifetime, with no new city
descriptor or draw call. The source triangles are unchanged: 130 drawn / 3,216
independently sampled native shell triangles.

The photos support three black double doors, three shallow steps, warm beige
plaster, blue COLUMBIA / HALLE lettering, a cream marquee with red 19.10.2026 /
THE SISTERS OF MERCY lettering, right-hand KASSE aperture and short queue rails.
Those fitting dimensions and placements are photo estimates, not surveyed
openings. The third main door corrects the incomplete mapped-node interpretation;
the two mapped main nodes remain evidence, and the mapped side door survives.
The marquee represents the supplied dated photograph, not a live event listing.
Native fittings are generated independently as orthogonal short bars. No source
facade/roof is cut, and no new collision or terrain floor blocks the entrance.

The south-facing, visible approach offers an accessible **Columbiahalle betreten**
button within 72 m forward / 32 m sideways, and the three-door facade can be
tapped. Entering displays the illustrative stage, dense anonymous crowd, balcony,
roof trusses and slow blue/violet/red/white light cones in the existing canvas.
It uses the same renderer and existing frame loop, with a separate temporary
camera; the outside camera and navigation do not move. Drag or arrow keys look
around. Controls and recording labels follow the app’s current German/English
language. Browser modifier chords, Tab, button activation and refresh keys pass
through unchanged. **Verlassen** or Escape returns to the unchanged outside position.

The room is not an as-built interior survey. Dimensions, stage furnishings,
anonymous silhouettes, light fixture placements and movement are illustrative.
Drawn heads are simple geometry; native heads and all native light volumes are
independent orthogonal boxes. Mobile receives the complete same scene. A 24-second
soft light cycle has no high-frequency strobe. Reduced-motion preference uses
static soft illumination. No audio is created; App suspends its existing sound
graphs on entry while retaining user intent, and restores only on explicit exit.

**Aufnahme ansehen** explicitly loads the actual supplied clip. A video-only
OpenCV H.264 encode drops the audio stream entirely: 640×360, 15 fps, 328 frames,
1,244,331 bytes, full duration 21.8667 seconds. It is always muted and loops;
the user can pause or return to the procedural light scene. The visible label
identifies it as the provided recording. Original JPG pixels and the large MOV
are not bundled. `docs/columbiahalle-v257-sources.json` records all five original
hashes, output hash and source credit text.

No second WebGL context or animation loop is created. The interior is lazy-loaded
on entry and destroyed on exit. Hidden/frozen/inactive/zero-size views do not
advance lighting or video; both the controls and recording panel are hidden and
restored when the view resumes. The recording unloads its `src` on close, and all
temporary geometry/materials and instanced GPU buffers are disposed. Mode changes that cross the native
family exit the view; unmount exits without restarting sound. Existing blur/reset
handlers clear held movement and touch state at both transitions. The city frame
work and asynchronous GPU preparation pause while the temporary interior is presented.
City controls are inert beneath the concert view and recover their original
state on exit; double-clicks cannot move the hidden city camera. A resumed
reduced-motion view redraws one static frame.

| Resource | Drawn | Native |
|---|---:|---:|
| Previous Columbia packed vertex/color/index arrays | 31,521 B | 138,420 B |
| Refined Columbia packed arrays | 104,277 B | 266,058 B |
| Temporary interior GPU attribute/index/instance arrays | 59,404 B | 70,672 B |
| Temporary interior draw calls | 10 | 10 |
| Temporary interior instances | 754 | 946 |

The complete decoded `2_7` packet, including its existing other owners and ink,
changes from 305,736 to 362,184 bytes drawn (two draws) and from 567,300 to
665,844 bytes native (one draw). Its complete navigation object compares equal
before/after. These are measured runtime buffer bytes, separate from packed
source bytes above; both remain well below the existing 12 MiB per-packet cap.

These small additions change no resident, transfer, prefetch or draw-quality
policy. Packed fields are read-only constructor inputs; no render root retains
the source objects. The offline media allowance separately includes the compact
clip.

Integration: `columbiaFacadeV257` augments only the exact Columbia receipt in
`namedSiteReplacementsV238`; `ColumbiahalleV257` owns entry/UI/video lifetime;
`ColumbiaConcertV257` owns the lazy temporary scene. The minimal `ThreeViewer`
hook adds `onConcertInteriorChange(entered, restoreAudio?)`, construction,
hidden suspend, existing-frame update/early return and disposal. App owns audio.

Validation includes two focused Python receipt/native/scope tests, nine Bun
scene/fingerprint/media/interaction/lifetime tests, existing named-site transaction
tests and the TypeScript production build. Runtime browser QA is recorded in
the integrated release audit. Camera:
`[1340,14,3890] → [1340,7,3855]`; the interior uses local `[0,2.35,12.2]` facing
the stage at negative Z. Exterior source replay is regenerated with
`uv run python scripts/build_columbiahalle_v257.py`; video via
`uv run python scripts/prepare_columbia_video_v257.py <supplied-MOV-path>`.

Primary current venue references: [operator description](https://www.columbiahalle.berlin/about-us.html),
[operator address](https://www.columbiahalle.berlin/kontakt.html), read 21 October
2026. Original measured source: [Berlin LoD2 tile](https://gdi.berlin.de/data/a_lod2/atom/LoD2_390_5816.zip),
dl-de/zero-2-0; retained entrance nodes: OpenStreetMap contributors, ODbL-1.0.
