# Generations

Each `MAP_ID` lives under `generations/<map-id>/quadrants.db`
(SQLite). The schema mirrors the upstream NYC project — one row per
quadrant with the rendered source PNG and the AI-generated pixel-art
tile, plus flags for water/star/flag/reference and notes.

For the MVP, the only map is `regierungsviertel`.
