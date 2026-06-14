# Generation

The Berlin pipeline follows the NYC pipeline at a structural level:

1. **Whitebox / textured render** of the 3D scene per isometric
   quadrant (512×512 px), using `pyvista` against the LoD2 mesh.
2. **AI tile generation** — feed each render plus an "infill" mask of
   already-generated neighbors into a fine-tuned `Qwen/Image-Edit`
   model.
3. **Manual QA** in the bounds editor / generation app — fix water
   (Spree), tree consistency in the Tiergarten, hero tiles for
   Reichstag dome and Hauptbahnhof glass roof.

## Model

The NYC project's "omni infill" fine-tune is American architecture —
gridiron streets, tall towers, brownstones. It will not produce
convincing Wilhelminian Altbau, Plattenbau, or the post-1990
government architecture out of the box. Plan for a Berlin-specific
fine-tune:

- ~40–80 hand-curated render → pixel-art reference pairs.
- Train against `Qwen/Image-Edit` (same as NYC) on
  [oxen.ai](https://oxen.ai) or locally.
- Expect ~4 h training, ~10–20 USD compute, per NYC's reported numbers.

## Generation rules

Same 2×2 / 1×2 / 2×1 / 1×1 quadrant adjacency rules as NYC, so seams
between tile quadrants stay clean. See the NYC repo's
[`docs/generation.md`](https://github.com/cannoneyed/isometric-nyc/blob/main/docs/generation.md)
for the diagrams; replicating that logic here is TODO.
