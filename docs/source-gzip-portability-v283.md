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
