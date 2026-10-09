# Bendlerblock and German Resistance memorial, v202

The two retained LoD2 parents `DEBE01YYK0002MMp` and `DEBE00YY2Bq0001i`
contain ten leaf parts. Until this release, the main parent's largest part was
clipped to the northern edge and most of the remainder used the 15 m fallback
OSM relation `7903504`. The complete original wall/roof sheets, ground rings and
courtyard holes now form the rendered shell. Every raw source coordinate remains
in `geo_data/regierungsviertel/bendlerblock-v202-source.json.gz`.

Only the documented eight source prism IDs and one OSM proxy are transferred.
The original records are retained in `bendlerblockV202Evidence.json`; Minecraft
removal uses an exact position/bottom/top signature list, never a broad bounding
box. All unrelated public city packets remain byte-identical to v1.0.101.

Three retained OSM `building_passage` ways (771045155, 771045154 and 771045153)
locate the court approaches. Their model openings share the same profile as
walking clearance. Heights and widths are proportional readings from free
reference photographs, not surveyed aperture dimensions. Source roof planes
above the openings are preserved. Court paving is clipped against all source
building footprints; the connected court remains open.

Michael Klemm's court photograph and Stefan Kemmerling's statue photograph show
the low transverse Reusch sculptures, the ground-level figure,
and its hands bound in front. They correct the earlier two hedge bars, tall
pedestal and inaccurate arm/bar orientation. The mapped statue and south-wall
memorial plaque anchors remain fixed. No inscription text is copied. Fine
paving courses, the bronze silhouette and facade mullions are vector geometry.
All nine existing OSM court trees remain unchanged in the ParkDetails layer,
including their original positions and dimensions. Four duplicate approximate
tree additions were removed from this model; no source tree is suppressed.

Jörg Zägel's Reichpietschufer photograph supplies the warm stone and pale window
frame character. The measured LoD2 main roof remains its supplied flat sheet;
the reference's pitched historic roof has not been invented as an unmeasured
new volume. This model is a source-bound isometric interpretation, not a scan
or a complete architectural survey. Proportional bay spacing and facade relief
are explicitly separate from the measured building envelope.

Sources and per-file free-photo credits are in the evidence and
`bendlerblock-v202-references.json`, mirrored in the main and viewer attribution
manifests. The memorial's account of the 1980 Erich Reusch redesign is at
<https://www.gdw-berlin.de/ort-der-erinnerung/1945-bis-heute>.

The drawn renderer uses one measured surface batch, one facade/detail instance
batch and one small faceted figure batch. The native renderer has a separate
orthogonal surface/block representation. Touch and pointer inputs construct
the same full static detail. Geometry carries no photo textures, per-frame
callbacks or new residency limits.

Native rooftop walking uses the exact top faces of the existing block skin,
indexed in small spatial cells. This avoids sinking into the stepped native
roof at sloping source planes; drawn walking continues to use the unchanged
measured triangles. Downward geometry rays verify both the native support and
its pedestrian obstacle callback.

The exact generic OSM statue node 7197479254 and wall-plaque node 595339119
are carried by this detailed owner instead of an overlapping generic pedestal.
Their source entries and protection index remain intact. The Bendlerblock group
keeps the protected ordinary Day presentation in Schwellenraum.
