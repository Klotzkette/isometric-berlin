# Berlin places: gastronomy, sport, industry and memorials

This pass reconciles public directories with the physical city already present
in the viewer. It is a finite visual improvement, not a claim that every listed
place has a newly surveyed exterior or interior.

- [Gastronomy](gastronomy-v352.md): 108 explicit inventory outcomes, including all
  44 Berlin entries returned by Burger King's directory (with closed/projected
  entries kept distinct). Ten places receive visible work: six Burger King,
  two Einstein Kaffee, Konnopke and Starbucks Albrechtstraße. Five previously
  absent restaurant bodies follow supported mapped outlines and terrain.
- [Sport and leisure](sports-leisure-v352.md): all 67 BBB directory entries and
  seven official ice-site identities have documented outcomes. There are 26
  new features in ten existing hosts: 18 basin contours, four football fields
  with open goal frames, two outdoor ice surfaces and two climbing stelae.
- [Civic and industrial places](civic-places-v352.md): three complete official
  building families, comprising 56 parts, add Siemens Schaltwerk and two Gillette
  factory sections. The touching Gillette families share one bounded host;
  Native has no duplicate exterior faces at their boundary and retains the
  complete collision-height union. Current agency addresses and unresolved
  DRV/greenhouse discrepancies are recorded separately.
- [Wall places](wall-places-v352.md): 196 Foundation directory records remain
  distinct from surviving physical walls. Peter Fechter's mapped steel column
  is added on actual resident ground. Unsupported outer memorial anchors remain
  explicit gaps, and the existing detailed Wall sites are retained.

Every existing source descriptor and ground footprint remains an exact prefix
of the complete manifest. There are seven new hosts, for a total of 3,087
descriptors and 6,174 Drawn/Native packets. Existing production geometry,
navigation and materials were checked independently in both mode families.
Six visual modes, the 93-stop tour, mobile detail and the existing live/startup/
Worker limits remain unchanged.

The complete public tree contains 6,933 files and **998,599,869 bytes**, which is
935,389 bytes smaller than v1.0.231 despite the additions. A finite
[lossless recompression](public-lossless-v352.md) of 48 existing packets saves
2,180,970 bytes with byte-identical decoded contents. All assets remain served
from the viewer's own origin. The full offline package is 1,231,550,791 bytes;
its measured allowance is 1,175 MiB. No runtime geometry reduction funds this
storage saving.

## Validation and known limits

The final focused frontend suite passes 52 tests, the new Python site checks
pass 18 tests, and package/release checks pass 101 tests. TypeScript and the
production build pass. All newly authored Python files pass Ruff.

The repository-wide historical suite is not clean: an attempted run recorded
359 passes, 14 failures and 14 setup errors before it was stopped during an
unrelated large geometry check to keep local build memory/disk bounded. A BER
lineage failure was independently reproduced with the exact v1.0.231 manifest:
its older normalizer still expects 2,203 descriptors, while the already released
manifest contains 3,080. The failing code and all 244 files read in that replay
are unchanged. These old expectations were not weakened to obtain a green run.
The global formatting check also reports 31 unchanged older files; its three
lint findings concern the pre-existing V334 bus/rail builders.

The separately documented [existing northern refinement guard issue](known-rendering-issues-v351.md)
remains unresolved. Successful targeted checks are not a claim that every old
city test or every deferred runtime refinement is error-free.
