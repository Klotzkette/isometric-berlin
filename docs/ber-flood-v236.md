# BER flood coverage — v236

The final airport addition extends beyond the older regional flood mask, notably
at the terminal forecourt, four station entrances, parking structures and cargo
buildings. The existing flood asset now covers precisely the union of the
released v1.0.135 flood extent and the final v236 airport footprint. No other
area is added, and every previously flooded area remains covered.

The final airport manifest SHA-256 is
`5e8ef4aa5ccdae2ae3f82f23be92c6fb16051d0b9121ff9aabbb71a1137030ba`.
The runtime receipt records this hash; source rings and holes are retained.
Polygon normalization handles centimetre-rounded metadata before the union.
The added area is 1,459,526.236 m², solely within that airport footprint.

The same lazy, cancellable flood loader and shared 64 m swell cells remain in
use. There is no extra scene root or second overlapping water layer. The final
asset is 883,772 compressed bytes and 2,830,948 decoded bytes, an increase of
220,700 decoded bytes. Existing limits of 1,000,000 compressed and 3,000,000
decoded bytes in the coverage checks remain unchanged. Border triangles retain
the existing 96 m edge limit and water height.

Validation: `test_ber_flood_v236.py` compares the actual final footprint to the
released predecessor and rejects missing old coverage or additions outside BER.
The existing binary coverage test verifies receipt hashes, mesh area, finite
coordinates, cell ownership and maximum triangle edges against the final extent.
