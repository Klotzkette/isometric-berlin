# Kurfürstendamm and Tauentzien — v1.0.135 / Step 10

The requested complete street lengths are already inside retained coverage:
Kurfürstendamm from Breitscheidplatz to Rathenauplatz and Tauentzienstraße from
Breitscheidplatz to Wittenbergplatz. Their source axes meet exactly. This pass
refines street-facing architecture and positively mapped paint without adding
new city coverage or replacing measured roofs and earlier authored landmarks.

## Architecture

164 distinct existing building owners receive 5,714 refined drawn window and
shopfront fields. Their axes and dimensions come from the retained v163/v165
opening interpretation, not a new individual-window survey. Shallow 5 cm
reveals, narrow neutral profiles and muted blue-green glazing make these fields
more readable. 5,632 independently verified exposed native cell faces receive
the corresponding orthogonal treatment. All five sections, including Halensee,
Lehniner Platz, central Ku’damm, Breitscheidplatz and Tauentzien, are represented.
Existing complete measured roofs and dedicated landmarks are preserved.
[Architecture evidence and limits](boulevard-architecture-v235.md).

## Streets

The 179 retained Kurfürstendamm ways include both carriageways and footways;
176 at-grade ways already receive the v210 markings. All 27 Tauentzien ways,
existing v163/v165/v188 road surfaces, sidewalks, curbs and islands remain.
Four mapped dashed crossing owners and five mapped restriction polygons add
117 paint segments on Tauentzien. There are no invented zebra crossings or
signal positions. All three official Tauentzien trees are already present,
so none are duplicated. [Street evidence and fitting limits](citywest-streets-v235.md).

## Preservation and runtime

Both new preparers append bounded geometry inside the existing cancellable
surrounding-tile transaction. They keep original mesh identities, source bytes,
lines and navigation, and merge into the existing final buffers. Small eager
packet indices avoid decoding irrelevant construction payloads; immutable
construction data use the existing weak lossless cache. No texture, global city
root or per-frame animation is added. Drawn mobile detail remains complete;
native geometry follows independently verified orthogonal faces and road tiles.

The unchanged limits remain 16 parts, 400,000 vertices and 2,400,000 indices per
packet, with existing CPU/GPU residency and upload budgets. Seven varied flight
starts, all 93 tour stops, six modes and prior architecture remain intact.

Sources: retained Geoportal Berlin LoD2/ALKIS (dl-de/zero-2-0), OpenStreetMap /
Geofabrik Berlin © OpenStreetMap contributors (ODbL-1.0), and the primary
architecture references linked in the facade evidence. Window subdivisions,
profile dimensions and untagged material colours are display estimates, not
claims of a new facade survey. No photographs or textures are bundled.

## Validation

The production TypeScript/Vite build passes, as do Ruff format/check. The full
Python suite is covered by 1,406 unchanged regression passes and 19 source tests
run after final data generation: 1,425 distinct passes, four pre-existing skips
and two existing CRS-fixture warnings. Four version smoke tests and 101 release /
packager tests also pass again on the final version. The 25 combined house,
material and source-cache tests, five new facade/street tests and 42 residency,
attachment, decoding and cache tests pass.

Across all 486 affected family inputs, original encoded source, mesh identities,
lines and navigation remain intact. Maximum combined packet counts stay at six
parts, 280,328 vertices and 1,332,768 indices. Total extra decoded mesh bytes
across the 13 changed tiles are 4,258,050 drawn and 3,918,774 native; these are not
simultaneous residency. Maximum per-packet increments are 1,002,306 and 1,502,598
bytes, including three drawn and one native index-width promotions. No extra
final tile buffer or draw call is introduced.

Production screenshots check six corridor views and separate night/native
appearances, with all expected facade parts present and the Tauentzien paint
attached. The complete extracted offline package is 887,621,143 bytes
(846.501 MiB), within the existing 847 MiB archive ceiling. Runtime ceilings
remain unchanged. Complete ZIP release readiness passes; limited local disk
space is handled by writing and validating the canonical ZIP in memory before
upload, without omitting any package member.

Chromium desktop and WebKit with an iPhone 13 profile each complete seven
maximum-zoom samples across all six modes and back to day without page errors,
context loss or resets. Tracked GPU buffer peaks are 380.88 MiB and
162.96 MiB respectively; different viewports retain different visible tiles.
These are automated browser checks, not measurements on a physical phone or
a guarantee that every device can never crash.

The deterministic static tar.gz stream is verified member by member against all
4,368 staged files. ZIP upload size and SHA-256 digest match the local verification
receipt. Previous hashed Pages assets remain available for already open tabs.
