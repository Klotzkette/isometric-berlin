# Late Minecraft material provenance

The existing Minecraft material provider now exposes additive private admission
and inheritance APIs. Gradient pixels, shader parameters, toon caching and the
existing set/restore/release rendering behaviour remain unchanged.

- `hasMinecraftMaterialProvenance(mesh, sourceMaterial, candidate)` requires the
  real state created by the provider, its privately recorded original for that
  mesh, the actual factory-created toon or direct material, and an active real
  presentation binding. A genuine Schwellenraum original is attributable to its
  original day material through that factory's separate private provenance.
- `minecraftOriginalMaterialFor(mesh)` returns the current valid private original
  backlink, or null. This covers native ground meshes that have no public
  day/night slots.
- `copyMinecraftMaterialPresentation(sourceMesh, targetMesh)` applies the real
  active source state to the target's own original/current material through the
  existing provider. It preserves target-specific colour and vertex-paint
  settings; it never assigns the source's material to the target.
- `releaseCopiedMinecraftMaterialPresentation(targetMesh)` releases a detached
  copied target from the state's strong original maps, including after restore
  or binding invalidation. It uses the existing scoped release pipeline and
  leaves the shared gradient and other meshes intact. Release a copied target
  explicitly before inheriting a different state.

Public userData labels, manually populated public maps, arbitrary cached clones,
another state's generated toon and foreign original identities cannot authorize
a binding. Original/toon material disposal, gradient/state disposal, restore and
release revoke the corresponding proof. Copy provenance remains separately
available for cleanup after ordinary presentation restoration. No new material
variant or new per-frame traversal is introduced.

Focused tests cover real toon inheritance with distinct target paint, genuine
grade sources, direct Basic-material bindings, private original backlinks,
forged public labels/maps/clones, foreign states, resource/state disposal,
restore/re-enable/release and detached-target cleanup. The existing Minecraft
visual-mode tests retain their original rendering assertions.
