# Pergamonmuseum: reversible altar reveal (v1.0.104)

Click or tap the museum to reveal a white procedural reading of the Berlin
reconstruction of the Pergamon Altar. Click again to restore the complete
exterior. There are only 36 thin principal-mass contour segments while open.
The neighbouring Neues Museum, Alte Nationalgalerie, James-Simon-Galerie and
Pergamon Panorama remain independent.

## Evidence and limits

- [Staatliche Museen zu Berlin / Antikensammlung: 3D model](https://www.smb.museum/museen-einrichtungen/antikensammlung/sammeln-forschen/3d-modell-des-pergamonaltars/)
  documents the reconstructed hall and 113 m Gigantomachy frieze. The
  [museum's original viewer](https://3d.smb.museum/pergamonaltar/) describes the
  20 m western stair. No scan geometry or museum photographs are bundled.
- [Metropolitan Museum of Art, *Pergamon and the Hellenistic Kingdoms of the Ancient World*](https://resources.metmuseum.org/resources/metpublications/pdf/Pergamon_and_the_Hellenistic_Kingdoms_of_the_Ancient_World.pdf),
  “The Pergamon Altar: Architecture, Sculpture, and Meaning”, explains that
  Berlin reconstructs the west side, not the complete ancient square.
- Visual proportions: [Lestat / Jan Mehlich, *Berlin – Pergamonmuseum – Altar 02*, 2007](https://commons.wikimedia.org/wiki/File:Berlin_-_Pergamonmuseum_-_Altar_02.jpg),
  [CC BY-SA 2.5](https://creativecommons.org/licenses/by-sa/2.5/). External
  reference only; credit is packaged in `wikimedia_attribution.json`.
- 35.64 m is the commonly published ancient frontage width; the 18.4 m
  reconstructed-front display depth, 28 step subdivisions, 42 column positions,
  moulding sizes, statue poses and height placement are explicit visual
  estimates. This is not the museum's measured conservation model. The 62
  high-relief figures suggest articulated bodies and drapery; they do not claim
  exact individual mythological scenes or sculptural reproductions.
- The altar is centred in the retained central hall owner
  `DEBE3DKEaAKJ8HLe`, NG frame u=-50.5/v=-75.9, presentation floor y=4.2,
  facing the west courtyard. The sparse ghost lines outline three principal
  bounding masses derived from retained source vertices, not every roof facet.

## Geometry preservation and runtime

All exterior Float32 triangle positions, normals, colours and instanced
matrix/colour rows are identical to v1.0.103 in all four drawn/native and
pointer/touch profiles. Only batching changes: Pergamon's exact owners form a
separately visible child. The fixture `pergamon-exterior-v203.json` was captured
before this split; sorted content hashes verify exact preservation independently
of grouping. Drawn calls increase from 3 to 6, native from 1 to 2; shared primitive
geometry avoids duplicate buffers. No source inventory, packet or resident budget
changes. Closing the reveal restores the original geometry.

The altar module is fetched only on first opening. Its four instanced batches
contain 6,050 instances and 494,468 bytes of geometry/instance data. All devices
and modes use the same white exhibit detail. Opening fades in over 420 ms;
reduced-motion users get the final state immediately. Subsequent toggles reuse
this bounded model. Disposal cancels an unfinished import and releases owned
resources. The reveal boolean lives above the mobile drawn/native remount and
is restored without retaining a second city.

A tap must be a primary press under 600 ms with no more than 7 px travel.
Multitouch, drags, cancellations and duplicate window/canvas events do not toggle.
Museum double-clicks/taps are consumed by the exhibit, not by zoom/jump. Picking
uses small retained source sheets, avoiding a raycast that would decompress the
entire city. The other two triad museums occlude this bounded semantic picker;
this is not GPU pixel-perfect selection of arbitrary foreground street objects.

In Flooded Berlin a reversible shader cutaway is restricted to the altar's
small display volume, for all three water heights. It follows viewing rays so
oblique views at 21 m do not crop the altar through parallax. The city's water geometry
and all other buildings are retained. No additional render target, texture,
particle system or animation loop is introduced.

## Validation

- 35 final focused Bun checks: exact exterior preservation, all source parts,
  architectural contracts, isolated visibility, pointer gesture rejection,
  bounded altar geometry, restore, native-owner replacement, late-import
  cancellation and mobile runtime restoration.
- Full Python suite: 1,150 passed, 4 skipped; Ruff formatting/lint and the
  production TypeScript/Vite build pass.
- Final Chrome and WebKit checks retain 100% of sampled bright altar pixels
  at 21 m flood height, compared with Day at the same camera pose.
- Real mouse clicks in Chrome desktop and real touch taps in WebKit's iPhone 13
  browser profile pass all six modes, 3/6/21 m water and restoration; the initial page does not
  download the altar module. These browser profiles do not test physical iPhone
  RAM limits or establish a universal no-crash guarantee.
- Release readiness and extracted local HTTP launcher smoke pass for v1.0.104.
  An independent SHA-256 comparison matches all 4,082 distribution files,
  including 276 assets, against the final local package.
