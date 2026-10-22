# Step 10 — exact retained-source storage, v263

The v263 release retains the complete v161/v162 asset graphs for existing clients.
The first hosting preflight therefore exceeded its unchanged 1 GiB budget. The
changes below reduce only source encoding in chunks already changed by v263;
they do not remove a model, lower a limit, alter coordinates or omit an asset.
The release preflight, rather than these source-size estimates, determines fit.

`EAGER_RETAINED_SOURCE_NAMES` in `src/app/losslessJsonData.ts` is a finite exact
list directly beneath `src/app/src`. It includes the already packed Leipzig and
Schloss/Naturkunde inputs plus 33 other inputs present in the changed
`TunnelPortals` chunk and worker. Building attributes, ministry parts, named
building profiles, collision/roof data and their exported source objects are
retained for navigation and rendering. They keep one **eager, strongly owned**
plain object or root array; gzip changes only their module's encoding. All keys,
numeric values, property descriptors, named/default aliases and later mutations
retain their existing semantics. No source object is weakened or made lazy.
The exact allowlist also permits its smaller files to use this encoding when
gzip saves at least 20%; no directory pattern opts in another source.

Three immutable strings in `westVenuesV260.json` (`sourcePositions`,
`facadeBoxes`, `nativeBoxes`) use the existing lazy strong string path.
`WestVenuesV260.ts` converts these strings to its own typed geometry/instance
buffers. Text and decoded bytes remain identical, and a read value remains
strongly held. These three fields save approximately 599 kB of encoded source.

`outerRoofsV262.json.packets` uses the existing weak constructor cache.
`prepareOuterRoofsV262` retains the selected receipt across every fingerprint
yield and attaches that same receipt to the temporary prepared packet. Triangle
and line retirement consume this receipt before the constructor finishes; final
scene roots retain decoded buffers. A collected top-level map can be rebuilt
exactly without invalidating a live prepared receipt. This field saves about
150 kB per source copy. Explicit setters retain their replacement strongly and
the no-WeakRef fallback remains strong.

`districtStreets.surfaces`, `schlossEastStreets.surfaces` and the individually
published Alt-Mitte geometry packets remain unchanged: changing their currently
unchanged chunks would increase retained-release storage instead of reducing it.

Validation covers all 35 finite eager sources with full values, ordinary
descriptors, named aliases, nested/root mutations, array ownership and negative
path matching. Actual production bundles verify venue-string decode-on-demand
and exact typed-buffer bytes; both drawn and native roof transactions continue
after simulated source collection, retain the original packet and apply only
the original receipted triangle retirements. Frozen setters, strong fallback and
the unchanged packed-geometry path are checked separately. The full source
round-trip suite continues to pass.
