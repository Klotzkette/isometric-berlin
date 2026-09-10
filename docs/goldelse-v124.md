# Viktoria / Goldelse refinement

Step 10, v1.0.24. The figure keeps its existing west-facing world anchor,
8.32 m height, raised right-hand wreath, left-hand standard, eagle helmet,
shoes and layered feather fans. A fuller oval chest and hips, curved gathered
bodice, waist overfall and subdivided front drapery replace the circular torso
prisms and flat robe panel. Face, elbows and limbs gain smaller finite facets.
Restrained baked face tones keep these facets visible in unlit drawn modes.

## Evidence and limits

[Bildhauerei in Berlin](https://bildhauerei-in-berlin.de/bildwerk/siegessaeule-4706/)
documents Drake's figure, orientation, attributes, 8.32 m height, 0.92 m shoe
length, 17 cast parts and gold leaf on oil ground. These facts are distinct
from the model's procedural subdivisions. The existing 67 m monument stack
and architectural world axis remain intact.

AlterVista's [Berlin Siegessaeule Victoria.jpg](https://commons.wikimedia.org/wiki/File:Berlin_Siegessaeule_Victoria.jpg),
29 May 2003, [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/),
shows the feather tips fanning outward and downward behind the shoulders,
rather than rising above the helmet. It also guides the fuller draped body.
The already credited BugWarp CC0 full-height view remains contextual evidence.
Both manifests, the reference inventory and NOTICE contain the new per-file
credit; neither photograph is bundled or loaded as a texture.

The 1.58 m chest, 1.26 m waist and 1.80 m hip display widths are local
proportional choices, not measured anatomy or a sculpture scan. The figure
remains stylized and triangulated in the established city palette.

## Bounded geometry

The figure changes from 45 parts / 7,758 vertices / 86 explicit ink segments
to 47 parts / 21,828 vertices / 66 explicit ink segments. It still merges into
one gold material draw. The complete Siegessäule/Bismarck root has five
renderables, 62,776 stored vertices and 2,137,296 unique buffer bytes.

Minecraft changes 42 existing instance transforms: twelve refine body/head/feathers,
and the local left/right frame now places wreath and standard on the same
sides as the drawn figure and reference. Its main architecture batch remains 304 blocks;
all four monument batches remain 340 blocks. Whole-world full and mobile
instance, draw and byte counts remain unchanged. Independently measured
synchronous buffers are checked against cooperative construction in tests.

Unit tests cover height, orientation, shoes, two mirrored wings, attributes,
waist/chest/hip proportions, finite nondegenerate small triangles, descending
outer feather tips, material colours, texture absence and bounded cost. Actual
Three.js geometry was rendered in four orthographic views and inspected in
the desktop and portrait opening view.
