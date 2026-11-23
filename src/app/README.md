# Isometric Berlin viewer

The React and TypeScript app renders Berlin in isometric 3D with Three.js. You can orbit the city, walk at street level and switch among Day, Night, Snowstorm, Minecraft, Schwellenraum and Flooded Berlin.

## Local development

From the repository root, start the Vite development server with Bun.

```bash
cd src/app
bun install
bun run dev
```

Open the local HTTP address printed by Vite. To build the production viewer in `src/app/dist/` and preview it, run these commands from `src/app`.

```bash
bun run build
bun run preview
```

The [project README](../../README.md) links the hosted viewer and complete offline downloads for Windows, macOS and Linux. The [setup guide](../../docs/setup.md) covers the development environment and local launchers.

## Source credits

Keep the required source attribution visible in the viewer. The [source attribution component](src/SourcesDialog.tsx) contains the displayed wording and the [project notice](../../NOTICE.md) lists the full credits and licences.
