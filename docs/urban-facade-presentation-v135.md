# Bounded urban facade presentation — v1.0.35

Pipeline step 10 adjusts ordinary building colours around Potsdamer and Pariser
Platz, the Charité–Robert-Koch-Platz corridor, Europacity and the immediate
Tiergarten surroundings. The geographic masks are display scopes, not surveyed
district boundaries. Existing Berlin LoD2 footprints, heights, courtyard holes,
roof forms and source records remain unchanged.

## Evidence and priority

The retained `buildingAttributeSource.json` supplies original OpenStreetMap
`building:colour`, `building:material`, `roof:colour` and `roof:material` tags.
Its conservative LoD2 identity matches and retrieval provenance are documented
in [Ordinary building detail](building-attribute-detail.md). The revision uses
that existing source snapshot and adds no runtime request or new survey.

Within the display scope, an explicit mapped colour takes precedence over a
material's display swatch. A mapped material in turn takes precedence over the
old overview sample. Unambiguous retained CSS colour names, including `tan` and
`lightblue`, are resolved rather than silently falling back to the generic
paint. Material-only swatches remain illustrative colours, not measured
reflectance values. Mixed or invalid colour strings stay unresolved.

The `tone` field is sampled from the committed Step-8 **drawn overview**, as
described in [Generation](generation.md). It is not a facade-photo survey.
Buildings without stronger colour evidence receive a restrained rebalancing of
that existing illustration palette. The change does not establish a newly
verified real-world colour for an otherwise undocumented house.

Authored landmark and building-specific panorama palettes retain their existing
priority. Ordinary buildings outside the scope keep their previous colours.
The early complete envelopes and the later detailed buildings use the same
colour selection, avoiding a change of facade identity when detail arrives.

## Detail and cost limits

Existing facade subdivisions receive clearer tonal separation where applicable.
No new windows, floor counts, entrances, balconies, roof equipment, textures or
geometry are inferred. Existing mapped storey counts and authored facade models
remain responsible for architectural detail. The colour-only changes add no
draw calls or drawn geometry buffers. Existing dashed facade lines in the five
named area boxes receive a shader-only contrast adjustment; their dash pattern,
distance fading and stable depth handling remain intact after worker transfer.

The source scope contains **9,631 LoD2 parts**, of which **9,457** survive the
existing early-envelope replacement rules. These are source parts, including
small structures, not a count of individual houses. **1,845** scoped parts have
accepted retained OSM attributes, including **253** with facade-colour tags and
**213** with facade-material tags. The added CSS-name support resolves **26**
previously unresolved facade-colour parts and **16** roof-colour parts in this
scope. Those source coverage counts include authored landmarks, whose existing
palette priority is preserved; they are not counts of visibly repainted houses.

Minecraft's full profile keeps **3,811,391 instances / 105 renderables /
290,675,013 bytes**. The mobile profile has **1,017,557 instances / 103
renderables / 77,894,173 bytes**. Recognized roof colours now activate **141**
additional mobile cap instances in the existing building batch, adding
**10,716 bytes** within unchanged source column bounds. Scope and roof-colour
selection are cached per source prism rather than recalculated for each column.
No profile gains another draw call.

The targeted tests check retained named colours and material priority in both
actual building factories, unchanged authored and out-of-scope colour buffers,
and unchanged position buffers for representative source parts. These checks
verify presentation continuity and the bounded implementation; they do not
claim an opening-by-opening architectural survey.

The separately measured synchronous Minecraft outputs are pinned against the
cooperative constructor in `minecraft-construction.test.ts`, including colour
buffers, instance capacity and geometry bytes for both profiles.
