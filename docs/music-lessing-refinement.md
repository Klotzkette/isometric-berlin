# Composer and Lessing memorial refinement

Step 10, v1.0.5. These are code-authored recognition models on the committed
anchors, with no photographic texture, imported scan or changed park path.

## Evidence and changes

The [Berlin monument inventory](https://denkmaldatenbank.berlin.de/daobj.php?obj_dok_nr=09046318)
identifies the composer monument as part `09046318,T,030` and Lessing as
`09046318,T,027`. The sculpture inventories for the
[composer monument](https://bildhauerei-in-berlin.de/bildwerk/haydn-mozart-beethoven-denkmal-5236/)
and [Lessing](https://bildhauerei-in-berlin.de/bildwerk/lessingdenkmal-4997/)
provide their documented heights, materials and sculptural programmes.

The composer monument retains its 10 m overall height and the published
1.56–1.70 m half-figure range. Its former hemisphere becomes a curved,
three-sided cupola following the chamfered pavilion plan. Upright pinecones,
gold ribs, putti legs and separate laurel leaves articulate the crown.
Mozart's scroll and cupped hand, Haydn's score book and Beethoven's broad head,
coat and hair distinguish the figures. Niche jambs, console carvings, swan
feathers and lyre strings provide close detail. Inward-facing triangles in the
old pavilion sides are corrected: exterior rays now hit all three walls.

The historical inventory describes restored roof gilding. The inspected full
view instead shows pale scaled roof fields between gilded edges. The model
records this distinction explicitly in `MUSIC_COMPOSER_REFINEMENT`; it does
not present the entire roof as solid gold or claim a new conservation survey.
The committed world anchor and focus remain unchanged. All unquoted local
radii, carving subdivisions and bearings remain display estimates.

Lessing retains its 7 m silhouette, with a 3 m figure above a 4 m pedestal,
exact OSM node `884700390`, and existing approach bearing. Chamfered-square
courses and four concave cornice faces replace generic regular octagons.
Corner volutes, facade-facing portrait medallions and foliage, hollow fluted
basins, the book/hip-hand pose, coat, hair and bronze allegory attributes gain
separate geometry. The mantle is behind the legs so it no longer closes their
gap. Minecraft now distinguishes all five steps, the book and hip hand, side
basins and spread wings in its own cube batch.

The current 28-field/eight-segment chamfered fence is preserved; it does not
reinstate the lost historical ornate fence. Geometry, Minecraft outline,
protection radii, analytical collision and mapped surrounding approaches retain
their existing shared contracts. Reversible Lessing snow uses the updated
stone-course outline.

## Visual references

All six files below were retrieved and visually inspected for this revision.
They remain references only; this change adds no image asset. Per-file credits
accompany the viewer in the Wikimedia attribution manifests.

- MrPanyGoff, [Beethoven-Haydn-Mozart Memorial, Berlin.jpg](https://commons.wikimedia.org/wiki/File:Beethoven-Haydn-Mozart_Memorial,_Berlin.jpg), CC BY-SA 4.0: complete restored composition and roof colour separation.
- Daderot, [Beethoven … DSC09442.JPG](https://commons.wikimedia.org/wiki/File:Beethoven_-_Beethoven-Haydn-Mozart-Denkmal_-_Berlin,_Germany_-_DSC09442.JPG), public domain: portrait, double-breasted coat and Titan console.
- Daderot, [Mozart … DSC09446.JPG](https://commons.wikimedia.org/wiki/File:Mozart_-_Beethoven-Haydn-Mozart-Denkmal_-_Berlin,_Germany_-_DSC09446.JPG), public domain: turned portrait, hand/scroll gesture and dancer console.
- Dosseman, [Lessing monument in Berlin Tiergarten 9593.jpg](https://commons.wikimedia.org/wiki/File:Lessing_monument_in_Berlin_Tiergarten_9593.jpg), CC BY-SA 4.0: complete front, costume, stepped pedestal and current fence.
- Manfred Brueckels, [Lessing Tiergarten 3K.jpg](https://commons.wikimedia.org/wiki/File:Lessing_Tiergarten_3K.jpg), CC BY-SA 3.0: Kleist portrait, volutes and open basin.
- Manfred Brueckels, [Lessing Tiergarten 4K.jpg](https://commons.wikimedia.org/wiki/File:Lessing_Tiergarten_4K.jpg), CC BY-SA 3.0: rear criticism figure, feathered wings, owl and lion skin.

## Bounded rendering and checks

| Representation | Renderables | Stored vertices | Rendered vertices | Geometry and instance bytes |
|---|---:|---:|---:|---:|
| Composer drawn | 31 | 16,777 | 20,659 | 394,297 |
| Composer Minecraft | 1 | 24 | 22,824 (951 blocks) | 73,116 |
| Goethe + Lessing drawn, including Snowstorm caps | 8 | 33,306 | 33,306 | 638,010 |
| Goethe + Lessing Minecraft | 1 | 24 | 18,312 (763 blocks) | 58,828 |

The same bounded model is used on desktop and mobile. The four drawn modes
share one source-owned composer root; Minecraft substitutes the cube batch.
The geometry byte count includes position/normal/UV/colour/index attributes
and instance matrix/colour arrays, counting each geometry once.

`music-lessing-refinement.test.ts` checks actual heights, front-facing pavilion
and roof triangles, the four-sided cornice, clear leg articulation, colour
separation, source anchors, deterministic Minecraft construction, visibility
switching, texture absence and exact geometry budgets. Existing literary tests
continue to exercise reversible snow, both fences and eight clear approaches.
Six orthographic software renders inspect actual Three.js triangles and
instance matrices from front, rear and isometric views, including both
Minecraft readings. These checks are geometry QA, not a browser screenshot or
a physical-phone test.
