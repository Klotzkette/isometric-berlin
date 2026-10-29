# Distant Fernsehturm rendering — v283

Step 10, released in v1.0.182. The owner's bounded request concerns the existing
tower viewed toward Mitte from BER, Teufelsberg, Spandau and Marzahn.
Original architectural evidence remains in fernsehturm-detail-v149.md.
No new geographic coverage or changed tower dimensions are introduced.

## Diagnosis and correction

The tower is already required and resident in both model families. Its real
source ground (4.63 m), 368 m height and 32 m head are not lost to regional
streaming. All original meshes intersect the frustum at the four QA anchors;
the checked camera far plane is91 km.

At568x320 with a224px canvas and66-degree lens, BER's head is approximately
0.30 CSS pixel wide. Single-sample rasterization can miss the entire tower
during a small pan; SMAA cannot recover fragments that were never generated.
Snow's540–2250 m fog independently erased the tower.

FernsehturmHorizon.ts adds one depth-tested coverage companion at the real
world axis and original metric radii. Each projected band is clipped to the
current unit pixel; its intersection area supplies opacity. A transparent
one-pixel raster border ensures evaluation, without a minimum opaque width,
screen-locked icon, depth override or enlarged architectural geometry.
Coverage fades from full below0.75-device-pixel head diameter to zero at2px.
Inactive or behind-camera filters exit before projection divisions.

The complete original models remain rendered. The drawn companion has47
piecewise silhouette bands. The native companion derives283 source-height
intervals from actual independent exterior blocks and coalesces adjacent
equal-radius/equal-paint intervals into125 identical-area rectangles. Gaps,
paint changes and stepped radii remain separate. This is an explicit subpixel
row-envelope approximation, not a replacement smooth sphere or a change to
any native block. Coalescing avoids repeated unsigned-byte blend rounding.

All tower materials retain at least28% distant contrast through ordinary
linear fog, preserving existing reflection and Schwellenraum hooks. Exact
Snow fog additionally ramps a distant muted silhouette between2.25 and4.5 km,
limiting paint to15% of fog colour before blending where necessary. This is
a recognition display parameter, not a calibrated atmospheric measurement.
Nearby paint and original geometry remain unchanged. Actual submerged4–240 m
fog remains opaque. Intervening opaque buildings still occlude the tower.

## Preservation and cost

Original geometry/transform hashes are unchanged:

- Drawn:63bd34dd23fa2da7dd50d77ddf129865eb152753df290aa8a9a4586711d914dc;
  four original renderables,900 instances,1,676,088 geometry/instance bytes.
- Native:7cd716b8317d35b43f30bf12e27735e2199c246f74a8bf1b4a91a4d6c977b247;
  three original renderables,11,831 exterior blocks,901,100 bytes.

The companion adds one draw call and9,588 geometry bytes drawn or25,500 bytes
native. It casts/receives no shadows, writes no depth and has no texture or
render target. Desktop/touch detail is identical. Existing mode daylight is
shared; the draw callback reads the current viewport into a reused vector.
No additional residency, streaming, scene traversal or animation loop is added.

## Validation evidence and remaining gates

The final release source `b4d19da3e9a4aa187b849acffeddb834c8ef263e` passed GitHub Actions
[run 40677648990](https://github.com/Klotzkette/isometric-berlin/actions/runs/40677648990):
46 model/horizon tests and 33 lossless/portability tests, with no failures,
followed by the full TypeScript/Vite build, archive readiness and HTTP package
smoke. Both final archives were completely SHA256-verified; all 4,752 ZIP entries
passed CRC, length and SHA checks. The complete retained Pages tree is
1,056,661,631 bytes, below the unchanged 1 GiB limit, with every old asset kept.

The four standard fog uniforms use local independent defaults, avoiding new
shared-library exports while retaining identical shaders and renderer updates.
A build-only gzip OS marker correction prevents platform-only data chunk names
from changing; compressed payloads and prepared streams remain unchanged.
See [release receipts and remaining limits](release-v1.0.182-review.md).

Original hashes and native coalescing were also evaluated in memory. At BER66 degrees, centered DPR1,
the uncoalesced filter changed zero8-bit pixels; coalescing changed6 pixels
with maximum9 channel levels. All10 phases survived at DPR1/1.35/1.75.
Per-pixel integrated-area differences stayed below3.8e-14.

Internal-browser isolated-scene QA exercised all four anchors in Day, Night,
Snow, Minecraft, Schwellenraum and submerged fog with actual constructors,
camera depth, unsigned-byte composer and SMAA. An initial GLSL literal error
was fixed; fresh subsequent logs contained no shader errors. Ten0.1px BER
Day pans retained nonzero contrast. Toggling the companion behind an opaque
block changed zero pixels, confirming normal occlusion.

The initial Snow zero-pixel failure prompted its contrast correction. The
corrected BER16-degree screenshot and seven subsequent pan screenshots are
valid and retain nonzero tower contrast. ENOSPC interrupted phase7 saving;
that truncated file and absent later frames are not counted. At publication,
the final native wide-angle and full-city follow-up remained incomplete; the
final remote package checks above did pass. The [29 October visual follow-up](visual-qa-v283-20261029.md)
now records four full-city Day anchors, BER pans and Snow, plus an independent
native 66-degree GPU comparison at DPR 1: all eleven pixel phases retain nonzero
contrast, and an opaque blocker yields zero changed pixels when coverage is
toggled. The tiny full-city native screenshot alone is inconclusive; no physical
mobile device was tested. Actual camera poses and the source/built distinction
are documented in that follow-up.
Screenshots and temporary harnesses are local evidence, not shipped assets.
A small horizon feature remains faint; visibility is not promised through
buildings, outside the field of view, underwater or at arbitrarily tiny size.

The Mac exhausted writable storage during final validation. A separate
candidate branch was created through the Git Data API while main and Pages
still served v181. After final validation the release source and Pages advanced
separately; the retained local v181 package remains unchanged. Remote CI results are distinct from local
build evidence; no local build receipt is fabricated. Full pytest could not
start with its normal temporary-file capture on this full disk; the three
new shelter Python tests passed with capture disabled. Other Python tests
require ignored original source archives absent from a fresh CI checkout.
