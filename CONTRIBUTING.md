# Contributing to Isometric Berlin

This is currently a private, single-author scaffold. External
contributions are not solicited yet, but the workflow below mirrors
the upstream NYC project so it's ready when the repo opens up.

## Development setup

This project uses [`uv`](https://docs.astral.sh/uv/) for Python
dependency management.

```bash
# Install dependencies
uv sync

# Run tests
uv run pytest

# Format code
uv run ruff format .

# Lint code
uv run ruff check .
```

## Environment variables

Copy `.env.example` to `.env` and fill in the relevant keys:

```bash
cp .env.example .env
```

For the Berlin MVP, no Google Maps / Google Tiles keys are required —
all geometry comes from open Berlin data and OpenStreetMap.

## Code style

- Python ≥ 3.12, type hints on all public function signatures.
- Use absolute imports inside the `isometric_berlin` package.
- All config lives in `pyproject.toml`.
- Never edit `uv.lock` manually — run `uv lock` or `uv sync`.

## Submitting changes

1. Ensure `uv run pytest`, `uv run ruff format .`, and
   `uv run ruff check .` are clean.
2. Commit with a clear message; one logical change per commit.
3. Open a PR against `main`.

## Geodata hygiene

- Do not commit raw multi-GB LoD2 dumps or large OSM extracts to git.
  Use `geo_data/regierungsviertel/` only for derived, clipped,
  small-footprint artifacts (GeoJSON, small GeoPackage, etc.).
- Large binary artifacts belong on object storage (Cloudflare R2 /
  S3-compatible), not in git.
