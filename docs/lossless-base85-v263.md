# Finite lossless source encoding — v263

The two previous live asset graphs remain retained for already-open clients.
The v263 static tree initially exceeded the hosting limit by 1,776,087 bytes.
No current or retained asset, geometric detail, native model, cache policy or
runtime budget is removed to fit that limit.

Exactly 196 JSON module paths from the already changed `OuterThinOutlines`,
`RequiredSiteEnvelopesV209` and `SurroundingCityGeometry` main chunks are frozen
in `src/app/losslessBase85SourcesV263.ts`. Only fields already admitted to the
existing lossless gzip transform change their string alphabet from base64 to
Z85. The original base64 length still controls the compression admission test,
so the field selection, eager/strong/weak identity, setters and lazy decoding
contracts stay identical. Unlisted modules and the old shared gzip decoder are
unchanged. No source JSON values or source files are rewritten.

Four gzip bytes become five printable ASCII characters. A single leading digit
records zero padding of the last word. The alphabet excludes quotes, backslash
and backtick, so JavaScript escaping does not undo the saving. The new decoder
rejects invalid lengths, padding, alphabet characters, noncanonical oversized
words and nonzero padding bytes. It inflates the exact gzip bytes with the same
existing inflater and JSON parser, retiring temporary byte buffers in `finally`.
It needs no intermediate `atob` binary string.

Before the final bundle, replacing the actual gzip strings in those three
changed chunks saves **2,134,718 bytes**, plus savings in their existing worker
copies. The release preflight measures the final asset graph and small new codec
overhead. A local bounded timing check on the three largest sample fields
measured 1.5–4.3 ms for byte decoding of 0.72–1.77 MB compressed payloads; this is
not a mobile-device timing claim.

Tests cover every word remainder, 65,535/65,536/65,537-byte boundaries, malformed
strings, exact JSON negative zero/nonfinite parsed values/Unicode/own `__proto__`,
real retained venue strings and measured roof packets, eager root arrays,
strong/weak cache identity, ownership-transfer setters and frozen objects.
Existing lossless tests inject the decoder actually named in each transformed
module, as the production module loader does.
