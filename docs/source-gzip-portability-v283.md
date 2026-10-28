# Portable source gzip metadata — v283

The first Linux-built v1.0.182 candidate was not published. The complete Pages
tree, including the two preceding live asset closures, exceeded the unchanged
1 GiB ceiling even after its two extra Three.js helper exports were removed.

The remaining cause was the gzip operating-system metadata byte. Bun on macOS
produces byte 9 = 19, whereas the Linux build produced 3. For example, the entire
334,423-byte alt-mitte-v169-navigation-packet-000 module differed by exactly one
base64 character. Its 949-byte dependent codec then changed only its import URL.
That dependency propagated renamed assets through otherwise unchanged city data.

The build-only lossless JSON plugin now fixes only the standard gzipSync output
OS marker to the established v181 value 0x13. This is a compatibility marker for
the encoded source format, not evidence about the current build host. All other
header bytes, deflate payload, CRC and input-size footer stay untouched. The
compressed length and original admission calculation are unchanged.

Prepared Zopfli bytes remain untouched, as do exact-number serialization,
base64/base85 codecs, field classifications, eager and named identity, strong
and weak cache ownership, runtime decoders, geometry and source files. No runtime
import or new allocation is added. Existing and new regressions check the
emitted bytes, decoded values and prepared/admission behavior on CI.

## Final release verification

The Linux build at `b4d19da3e9a4aa187b849acffeddb834c8ef263e`, Actions run 40677648990,
passed all 33 lossless/portability tests, including the three new gzip-header
regressions, as well as 46 focused model/horizon tests and the complete build.

The final 4,752-file package occupies 935,302,812 bytes. Of those files, 4,737
(900,481,428 bytes) are byte-identical to v181. The complete Pages tree, retaining
every older asset, occupies 1,056,661,631 bytes across 4,790 files: 17,080,193 bytes
below the unchanged 1 GiB limit. No old asset pruning or budget increase occurred.

The publication adds only 15 new blobs totaling 34,821,384 bytes. Three additional
tree entries restore canonical executable modes for existing launcher/server
blobs. `three-engine-BfgqnBwf.js` remains byte-identical to v181.
Both final archives were completely SHA256-verified and all ZIP members checked
before publication; exact hashes are in [the release review](release-v1.0.182-review.md).
