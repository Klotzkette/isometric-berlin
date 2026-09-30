# Fernsehturm detail and sunlight reflection — v1.0.49

Pipeline step 10. The owner now authorizes detailed treatment of the initial
v1.0.48 tower silhouette. The original `schlossEastSource.json`, original
`schlossEastProfile.ts`, outline renderer and offline voxel cache remain intact.
Only the two tower parts' visible presentation is replaced, never the separate
Alexanderplatz station or another building. The original LoD2 full-height
36 m annulus remains documented as a source generalization, not rendered as an
opaque duplicate around the narrow shaft.

## Evidence and interpretation

The operator's [2021 facts](https://convention.visitberlin.de/sites/default/files/2021-10/BANKETTMAPPE-2021-BERLINER-FERNSEHTURM_7.pdf),
[Berlin heritage account](https://www.berlin.de/ost-west-ost-kulturbahnhoefe/history-walk/artikel.1558558.php)
and [bpb technical sheet](https://www.bpb.de/system/files/dokument_pdf/MuM_10_Berliner%20Fernsehturm.pdf)
retain the 368 m height, 32 m spherical head, public levels at 203 and 207 m,
16-to-9 m shaft diameter and 118 m antenna. The bpb's mean sphere height of
212 m remains the existing display centre; 207 m is the restaurant level.
The exact source-circle centre and ground y=4.63 m are unchanged.

The [Federal Archives/Stasi archive](https://www.stasi-mediathek.de/medien/fototechnik-auf-dem-berliner-fernsehturm/blatt/11/)
documents the direct-sunlight cross and its nickname. The steel association's
[material account](https://www.wzv-rostfrei.de/presse/detail/edelstahl-rostfrei-gibt-wahrzeichen-ein-gesicht)
identifies the stainless outer cladding and sun-dependent reflection. The
reflection is not a fixed religious ornament on the structure.

Two licensed Commons images were opened and visually inspected:

- [Berliner Fernsehturm – Kugel](https://commons.wikimedia.org/wiki/File:Berliner_Fernsehturm_-_Kugel.jpg),
  21 March 2004, **© Raimond Spekking / CC BY-SA 4.0 (via Wikimedia Commons)**.
- [The Pope's Revenge](https://commons.wikimedia.org/wiki/File:The_Pope%27s_Revenge.jpg),
  16 August 2009, **Tobi85 / public domain (PD-self)**.

They show the projecting diamond facets, two lower glazed levels with inclined
mullions, paired collars below the ball and a visibly open service structure
with dishes above it. Original image files remain temporary QA references;
no photograph, crop, texture or remote runtime request is added.

The 64 circumferential subdivisions, 24 nominal shell courses, 0.15 m relief,
window extents, maintenance-floor/member sizes and distribution of 20 dishes
are procedural display estimates guided by those photographs. They are not an
individual-panel or present-day antenna survey. The service structure remains
open outside the retained tapering core. Glazing mullions follow the spherical
slope rather than becoming vertical teeth that float beyond the lower belt.

## Optical and mode behaviour

The steel's existing single draw pass adds a small shader evaluating the
half-vector between the actual scene sunlight direction and camera direction.
Two anisotropic surface lobes approximate the steel pyramids' horizontal and
vertical families. Their highlight moves on the sphere with camera and sun;
front/sun visibility and grazing-angle attenuation prevent equal brightness on
the opposite side. It is neither a floating cross nor an alpha decal. Small
screen derivatives keep the narrow reflection readable from approximately
1.7 km without adding or resizing scene geometry. This is an illustrative
surface BRDF, not a claim of a calibrated optical reconstruction.

`updateFernsehturmLighting(root, sunDirection, daylight)` and the root metadata
callback `setFernsehturmLighting` update only shared uniforms during the
existing mode-lighting traversal. Three.js supplies camera position each draw;
there is no extra per-frame scene traversal, render target or texture. Day and
Minecraft have sunlight, overcast Snowstorm and Night have none. Schwellenraum
can use the attenuated 0.45 value and its normal grade. The night model keeps
lit public windows and ordinary steel lighting without the sunlight cross.

`createFernsehturmArchitecture(mobileLike=false)` retains identical geometry on
pointer and touch. `createMinecraftFernsehturmArchitecture(mobileLike=false)`
is a separate deterministic surface-only block representation, with its native
sun direction. It does not contain a smooth shell, allocate hidden solid fill,
load the archived voxel cache or triangulate the original source at runtime.

## Frozen budgets and checks

- Drawn: **4 renderables, 900 instances, 1,676,088 geometry/instance bytes**.
  Geometry and transform hash:
  `63bd34dd23fa2da7dd50d77ddf129865eb152753df290aa8a9a4586711d914dc`.
- Native: **3 renderables, 11,831 exterior blocks, 901,100 bytes**.
  Geometry and transform hash:
  `7cd716b8317d35b43f30bf12e27735e2199c246f74a8bf1b4a91a4d6c977b247`.

The focused test checks source identity and top/ground dimensions, finite
bounded buffers, identical desktop/touch geometry, separate native cubes,
reflection direction/absence, shared shader uniforms and preservation of the
Schwellenraum grade. An isolated real WebGL renderer was visually inspected in
Chrome for front/opposite views, distant view, Night, Schwellenraum and native
Minecraft. The screenshot comparison also toggles only the sunlight uniform,
proving that the highlight is confined to the shader and absent at night.

Chrome and mobile-profile WebKit both compiled the shader without errors in
Day, distant Day, Night, Minecraft and Schwellenraum (ten checked states).
Uniform-off pixel comparisons found the distant highlight in both engines
and zero sunlight-highlight pixels at night. WebKit uses an iPhone 13 profile;
this is browser-engine emulation, not a physical iPhone memory/crash guarantee.
