# Web viewer

React + TypeScript + Vite + OpenSeadragon, managed with `bun`.
Identical structure to the NYC viewer; only the title strings,
default DZI path, and attribution overlay change.

Required attribution overlay in the viewer chrome. The viewer ships the
required minimum (OSM + Geoportal Berlin) **plus** the Wikimedia visual-
reference clause, because the bundled tiles use Wikimedia references
(see `NOTICE.md`). This is the exact string in `src/app/src/App.tsx`
(`ATTRIBUTION`); keep the two in sync, and never drop the leading
OSM + Geoportal Berlin minimum:

```
© OpenStreetMap contributors · 3D building models: Geoportal Berlin (dl-de/zero-2-0) · Visual references: Wikimedia Commons/Wikipedia
```

When Google Photorealistic 3D Tiles are enabled (opt-in), additionally
show the Google attribution required by the Google Maps Platform Terms.

## Keyboard shortcuts & help

The viewer has a built-in help panel (the keyboard button in the top
toolbar, or press `?`) listing the shortcuts: `←`/`→` previous/next
landmark, `Space` start/pause the tour, `+`/`=`/`−` zoom, `Home`/`0`
overview, `L` copy a view link, `Esc` close overlays.

## Shareable view links

The link button in the top toolbar copies the current landmark,
orientation, and mirror state into the URL hash. Opening that URL restores
the same landmark focus and view orientation, which makes local QA notes
and screenshot handoff easier without needing server-side routes.

## Remote DZI hosting

By default the viewer loads the DZI pyramid, `landmarks.json`, and the
reference map from the bundled `public/dzi/regierungsviertel/`. Set
`VITE_DZI_BASE_URL` at build time to load them from a remote host (e.g.
a Cloudflare R2 bucket) instead — see
[`perplexity-hosting.md`](perplexity-hosting.md).
