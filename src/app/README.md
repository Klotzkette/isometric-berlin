# Isometric Berlin viewer

React + TypeScript + Vite + OpenSeadragon, managed with `bun`.

## Dev

```bash
bun install
bun run dev
```

The app reads the committed DZI pyramid under
`public/dzi/regierungsviertel/`. It is a static OpenSeadragon viewer
with landmark focus buttons, labeled map pins, a north-up default view,
a navigator, north/east/south/west orientation presets, 90° rotation,
horizontal mirroring, and a vertical 2D flip composed from rotation plus
mirror. The viewer also includes a top-down OSM/LoD2 reference map
overlay with north arrow and scale for placement checks. The committed
DZI uses the deterministic local pixel-art pass; it does not need a
backend, AI model, or Google key at runtime.

## Required attribution overlay

```
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0)
```

Must be visible in the viewer chrome at all times.
