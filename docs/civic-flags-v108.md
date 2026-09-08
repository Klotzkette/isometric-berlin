# Civic flags: visible, coherent wind in v1.0.8

This is a step-10 presentation correction. It does not introduce a new
geographic or visual-reference source. The existing Reichstag roof positions,
Flag of Unity's 28.5 m mast and 60 m² cloth, square Swiss flag and presidential
standard remain source-bound as documented by their existing model profiles.
The presidential standard here belongs to the interim Amtssitz am Spreebogen;
its display is not a live indication of the President's presence.

The previous runtime already admitted civic wind in every mode, but tied it
to the global fine-detail switch. Beyond 1,200 m camera-to-target distance,
flags stopped along with facade ornaments even when a large flag still covered
several pixels. The runtime now checks the actual flag bounds, inherited
visibility and screen coverage independently. Day, Night, Snowstorm,
Schwellenraum and Minecraft can all request an idle cloth frame. Offscreen or
subpixel flags do not keep the city repainting. A hidden document, underside
view or reduced-motion preference still suspends this animation.

The shared wind retains its 0.95 rad/s primary and 1.7 rad/s secondary motion,
at 12 updates/s on desktop and 8 on the touch profile. Maximum displacement is
6.5% of cloth width, capped at 0.5 m: approximately 14 cm on the Swiss flag,
16 cm on the standard and 50 cm on the much larger Flag of Unity. These are
bounded presentation values, not weather observations. The mast edge remains
fixed and the cloth clock continues across mode changes.

The German stripes previously had three different rotations. They now share
one plane and meet continuously. EU stars and the red details of the
presidential eagle now use their cloth's local transform; twelve EU stars
appear on each side. Flag triangles are split at 24 shared horizontal
positions. A common piecewise-linear deformation then keeps borders, Swiss
crosses, eagle shapes and stripes attached to the same rendered surface,
including the large triangles of the standard's formerly rigid red border.
The geometry and instance buffers use dynamic upload hints; no texture or
shader-specific asset is introduced.

The full nine-flag inventory remains 30 artwork draw calls, with 6,198 stored
geometry vertices, 30,846 indices and 86 symbol instances. Its geometry,
instance matrices and saved rest positions occupy 339,500 bytes together;
the same bounded cloth mesh is used on the mobile profile. A local Bun CPU
microbenchmark averaged 0.26 ms per whole-inventory update over 500 updates.
This measures deformation work only, not browser or phone frame rate.

Minecraft retains its existing single flag-artwork set over the native
Reichstag block masts. Its visibility filter already exposes the shared civic
cloth and suppresses the drawn architecture, so no extra mast or duplicate
flag is added. Reversible winter frost and the existing shared icicle batches
continue to use the same cloth motion.

Regression checks sample the actual rendered triangles for joined German
stripes, presidential border/eagle depth, Swiss crosses and EU-star placement.
An idle-camera simulation exercises all five modes at desktop and mobile
cadences after the global fine-detail tier has faded. Further checks reject
hidden, behind-camera and subpixel flags, and animate the real models through
the Minecraft visibility filter. These are geometry/runtime tests; they do
not substitute for direct browser or iPhone visual inspection.
