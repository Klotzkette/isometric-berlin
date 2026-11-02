# Finite lossless packet encoding, v195

Ninety-six existing surrounding-city gzip files use a smaller wire encoding. They save 5,203,540 bytes. The entire decompressed byte stream, including source JSON whitespace, is identical to the published v194 source. Geometry, colours, windows, roofs, navigation and all quality and allocation limits remain unchanged.

The finite set excludes the previous v193 and v194 encoding sets and every packet used by the new Friedrichshain, Rixdorf and Neukölln landmark transactions. It changes exactly the compressed files and their manifest byte counts and SHA256 values. The complete manifest complement is proved against immutable Git commit `8ab885c894768234d2198b56366fc1ba638c6f84`.

`geo_data/regierungsviertel/lossless-packets-v195.json` records each original and new wire length/hash, decoded length/hash and saving. `src/app/losslessSurroundingV195Sources.json` keeps the original source pins. Both are independently pinned in `scripts/integrate_lossless_v195.py`. Historical source readers recover exact original Git bytes only after complete wire and decoded-byte proofs. Unknown encodings, changed sources, foreign paths and altered manifest complements fail closed. Older v193/v194 controls retain their original fingerprints.

The existing browser gzip path and serial tile lifetime remain. There is no new codec, runtime cache, timer, descriptor, reduced source or lower touch quality.
