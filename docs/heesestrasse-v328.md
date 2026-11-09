# Heesestraße and Gymnasium Steglitz

The residential context now extends along both sides of the Heesestraße from
Albrechtstraße to Bergstraße. One existing city packet receives small
street-facing details on 17 confirmed LoD2 families. These represent numbers
1–12 including 9A, and 17–20. The work includes the evidenced return walls of
number 8 at Südendstraße 7, number 17 at Südendstraße 5, and number 12 at
Bergstraße 2–3. It stops at the Heesestraße face of number 1 / Albrechtstraße
120. The gymnasium, the former post office and Südendstraße 2 keep their
separate models and owners. [Official Berlin address points](https://gdi.berlin.de/services/wfs/adressen_berlin?SERVICE=WFS&REQUEST=GetCapabilities),
[District school record](https://www.berlin.de/ba-steglitz-zehlendorf/aktuelles/schulbauoffensive/weiterfuehrende-schulen/gymnasium-steglitz-1218110.php).

At number 3 the two main window registers, dark timber colour, horizontal
bands and tall rounded central portal follow the exterior photograph of the
listed 1875 tenement. The exterior cue preserves the existing solid behind it.
The design information for number 18 distinguishes four full storeys from
the roof level and shows outer balcony parapets. The model picks up the
parapets and main window bands below the eaves. Their projection and all
individual opening dimensions are estimates. The developer's 2015 brochure
documents the refurbishment design. It supplies no current survey of
individual windows or paint. [Heesestraße 3, Landesdenkmalamt](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09065531),
[Muns, exterior photograph, 22 September 2012, CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:120922-Steglitz-Heesestra%C3%9Fe-3.JPG),
[BEWOCON, Heesestraße 18 refurbishment brochure](https://bewocon.com/wp-content/uploads/2025/09/P51_Heesestrasse-18-Expose_05.02.2015.pdf).

On the other houses the measured support planes, address crosswalk and
available mapped storey counts set the visible extent. Window widths,
spacing and trim on those fronts are illustrative. The source street
panorama is context for the street setting and does not identify every
house or shop. The plan adds no façade photograph or texture, invented
tenant sign, new roof part or inferred courtyard opening.
[Bodo Kubrak, Heesestraße street panorama, 19 May 2012, CC0 1.0](https://commons.wikimedia.org/wiki/File:Heesestra%C3%9Fe_Berlin-Steglitz.JPG),
[OpenStreetMap contributors, retained small source excerpt](https://www.openstreetmap.org/#map=18/52.4567/13.3260).

## Source preservation and checks

`geo_data/regierungsviertel/heesestrasse-v328-source.json.gz` contains the
complete selected source family sheets with original polygon and address
identities. It records the two Berlin LoD2 tile digests and the queried
address and OpenStreetMap extract digests. The compiler accepts only the
two exact retained `ring182--7_13` input packets. Projected Drawn details
fit the complete measured wall plane and its holes, the actual older
envelope perimeter, and the street-facing line of sight. Native places
each façade axis on its own retained cardinal exterior surface, and
tests the whole outward fitting against neighboring bodies. Both use the
existing city packet datum. [Geoportal Berlin LoD2](https://gdi.berlin.de/data/a_lod2/atom/LoD2_386_5813.zip).

The two V300 receipts append one packed part each. The existing packet
decoder retains every earlier source vertex, colour, index, ink and
navigation word. No additional draw call, stream descriptor or live
budget is needed. Drawn adds 482 window units and Native adds 582
independently placed cardinal units. Both have six balcony parapets at
number 18. Drawn uses 212,832 bytes of added geometry at worst, Native
259,416 bytes if every added index requires four bytes. Both still use
the existing complete static Drawn detail on touch. The tests exercise
the exact delivered packet, the previous network recipe, the later
disjoint V320 fitting recipe, Native cardinality, and closed source
validation.
