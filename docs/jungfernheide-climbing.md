# Waldhochseilgarten Jungfernheide

The climbing park uses the full mapped outline of OpenStreetMap way
`69547558`, a finite 34,776 m² addition to the previously represented ground.
Three retained path lines, ways `25738376`, `125744018` and `125744020`, are
clipped to that outline. The main path uses its tagged 3 m width. The other
paths use an estimated 1.5 m width. The retained footprint of Kassenhaus
way `431222877` supplies the plan of the kiosk. Its 3.5 m height is an
estimate. The stage uses the same flat Y=3 display ground as the neighbouring
outer city and records no survey of individual elevations.

The [operator's plan and description](https://waldhochseilgarten-jungfernheide.de/kletterwald/)
distinguish the small and large sectors and describe Robinia wood, suspended
walks and ziplines at 3 to 17 m. The model represents five short course
sequences with suspended slats, tree platforms and cables. The operator's
schematic is the reference for their arrangement. Individual trunks,
platform positions, joinery and exact route geometry are display estimates.
The surrounding illustrative woodland is confined to the mapped site,
clear of the paths and kiosk. The plan image is reference material.

The two packets use the existing city streaming format and contain complete
ground, path and kiosk navigation. The source outline and three path courses
come from the retained Berlin OpenStreetMap extract of 29 September 2026,
© OpenStreetMap contributors under ODbL 1.0. Minecraft geometry is generated
independently on world axes. The same geometry serves pointer and touch.

Reproduce the two payloads and the manifest fragment with
`uv run python -m scripts.build_jungfernheide_climbing <output-directory>`.
Verification compared the complete generated payloads, checked that the
new area does not overlap preceding ground, checked all Native triangle
normals for world-axis alignment, and ray-tested the visible path and kiosk
roof through the normal renderer in both modes.
