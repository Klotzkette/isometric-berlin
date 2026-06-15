"""Local Leaflet-based bounds editor for the Regierungsviertel polygon.

Pipeline step 1 (see ``AGENTS.md`` §5). Analogous to the NYC project's
``create_bounds.py``: a small Flask server that loads
``geo_data/regierungsviertel/bounds.geojson``, shows it on an OSM map
together with the eight required landmarks from ``landmarks.geojson``,
lets the owner drag the polygon vertices, and saves the result back to
the same path.

No networked persistence and no external services beyond OSM raster
tiles. The polygon is always kept as a single, closed, simple polygon
(no holes, no multipolygons).

Run it with::

    uv run python -m isometric_berlin.generation.create_bounds

License of OSM raster tiles: © OpenStreetMap contributors, ODbL 1.0.
"""

from __future__ import annotations

import argparse
import json
import webbrowser
from pathlib import Path
from typing import Any

from flask import Flask, Response, jsonify, request
from shapely.geometry import Polygon, shape

HOST = "127.0.0.1"
PORT = 8765
ATTRIBUTION = "© OpenStreetMap contributors"
STATIC_DIR = Path(__file__).resolve().parent / "static"


def repo_root() -> Path:
  """Return the repository root (four levels up from this file)."""
  return Path(__file__).resolve().parents[3]


def default_bounds_path() -> Path:
  return repo_root() / "geo_data" / "regierungsviertel" / "bounds.geojson"


def default_landmarks_path() -> Path:
  return repo_root() / "geo_data" / "regierungsviertel" / "landmarks.geojson"


def load_geojson(path: Path) -> dict[str, Any]:
  return json.loads(path.read_text(encoding="utf-8"))


def outer_ring(feature_collection: dict[str, Any]) -> list[list[float]]:
  """Return the outer ring (list of ``[lng, lat]``) of the first feature."""
  geometry = feature_collection["features"][0]["geometry"]
  if geometry["type"] != "Polygon":
    raise ValueError(f"Expected a Polygon, got {geometry['type']!r}.")
  return geometry["coordinates"][0]


def bounds_properties(feature_collection: dict[str, Any]) -> dict[str, str]:
  """Return the ``name``/``description``/``source`` to preserve on save."""
  props = feature_collection["features"][0].get("properties", {})
  return {
    "name": props.get("name", "Regierungsviertel MVP bounds"),
    "description": props.get("description", ""),
    "source": props.get("source", ""),
  }


def close_ring(ring: list[list[float]]) -> list[list[float]]:
  """Return ``ring`` with the first coordinate repeated at the end."""
  if len(ring) >= 1 and ring[0] != ring[-1]:
    return [*ring, list(ring[0])]
  return ring


def validate_ring(ring: list[list[float]]) -> list[str]:
  """Validate that ``ring`` describes a single, closed, simple polygon.

  Returns a list of human-readable error strings (empty when valid).
  """
  errors: list[str] = []
  if not isinstance(ring, list) or len(ring) < 4:
    errors.append("Polygon needs at least 4 coordinates (a closed triangle).")
    return errors
  if ring[0] != ring[-1]:
    errors.append("Polygon ring is not closed (first != last coordinate).")
  polygon = Polygon(ring)
  if not polygon.is_valid:
    errors.append("Polygon is invalid (self-intersection or degenerate).")
  elif not polygon.is_simple:
    errors.append("Polygon is not simple (edges cross).")
  return errors


def landmark_report(
  ring: list[list[float]], landmarks: dict[str, Any]
) -> dict[str, bool]:
  """Map each landmark name to whether it lies inside ``ring``."""
  polygon = Polygon(ring)
  report: dict[str, bool] = {}
  for feature in landmarks["features"]:
    name = feature["properties"]["name"]
    report[name] = bool(polygon.covers(shape(feature["geometry"])))
  return report


def build_feature_collection(
  ring: list[list[float]], name: str, description: str, source: str
) -> dict[str, Any]:
  """Build a GeoJSON FeatureCollection for the bounds polygon."""
  return {
    "type": "FeatureCollection",
    "name": "regierungsviertel_bounds",
    "crs": {
      "type": "name",
      "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
    },
    "features": [
      {
        "type": "Feature",
        "properties": {
          "name": name,
          "description": description,
          "source": source,
        },
        "geometry": {"type": "Polygon", "coordinates": [close_ring(ring)]},
      }
    ],
  }


def save_bounds(
  path: Path, ring: list[list[float]], name: str, description: str, source: str
) -> None:
  """Write the bounds polygon back to ``path`` as a FeatureCollection."""
  collection = build_feature_collection(ring, name, description, source)
  path.write_text(
    json.dumps(collection, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
  )


def create_app(bounds_path: Path, landmarks_path: Path) -> Flask:
  """Create the Flask app serving the bounds editor."""
  app = Flask(__name__, static_folder=STATIC_DIR, static_url_path="/static")

  @app.get("/")
  def index() -> Response:
    return Response(_PAGE, mimetype="text/html")

  @app.get("/api/bounds")
  def get_bounds() -> Response:
    return jsonify(load_geojson(bounds_path))

  @app.get("/api/landmarks")
  def get_landmarks() -> Response:
    return jsonify(load_geojson(landmarks_path))

  @app.post("/api/bounds")
  def post_bounds() -> tuple[Response, int] | Response:
    payload = request.get_json(force=True, silent=True) or {}
    geometry = payload.get("geometry", payload)
    if not isinstance(geometry, dict) or geometry.get("type") != "Polygon":
      return jsonify({"ok": False, "errors": ["Geometry must be a Polygon."]}), 400
    rings = geometry.get("coordinates") or []
    if len(rings) != 1:
      return jsonify(
        {"ok": False, "errors": ["Polygon must have exactly one ring (no holes)."]}
      ), 400
    try:
      ring = close_ring([[float(x), float(y)] for x, y in rings[0]])
    except (TypeError, ValueError):
      return jsonify({"ok": False, "errors": ["Coordinates must be numbers."]}), 400
    errors = validate_ring(ring)
    if errors:
      return jsonify({"ok": False, "errors": errors}), 400
    report = landmark_report(ring, load_geojson(landmarks_path))
    if not all(report.values()):
      outside = ", ".join(name for name, inside in report.items() if not inside)
      return jsonify(
        {
          "ok": False,
          "errors": [f"Bounds must include all landmarks: {outside}"],
          "landmarks_inside": report,
          "all_inside": False,
        }
      ), 400
    props = bounds_properties(load_geojson(bounds_path))
    save_bounds(bounds_path, ring, props["name"], props["description"], props["source"])
    return jsonify(
      {
        "ok": True,
        "landmarks_inside": report,
        "all_inside": all(report.values()),
      }
    )

  return app


def main() -> None:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--bounds", type=Path, default=default_bounds_path())
  parser.add_argument("--landmarks", type=Path, default=default_landmarks_path())
  parser.add_argument("--host", default=HOST)
  parser.add_argument("--port", type=int, default=PORT)
  parser.add_argument(
    "--no-browser",
    action="store_true",
    help="Do not open a browser tab automatically.",
  )
  args = parser.parse_args()

  app = create_app(args.bounds, args.landmarks)
  url = f"http://{args.host}:{args.port}/"
  if not args.no_browser:
    try:
      webbrowser.open(url)
    except Exception:
      pass
  print(f"Bounds editor running at {url} (Ctrl+C to stop)")
  app.run(host=args.host, port=args.port, debug=False)


_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Regierungsviertel bounds editor</title>
  <link rel="stylesheet" href="/static/leaflet/leaflet.css" />
  <link rel="stylesheet" href="/static/leaflet-draw/leaflet.draw.css" />
  <style>
    html, body { margin: 0; height: 100%; }
    #map { position: absolute; inset: 0; }
    #panel {
      position: absolute; z-index: 1000; top: 10px; right: 10px;
      background: #fff; padding: 10px 12px; border-radius: 6px;
      box-shadow: 0 1px 4px rgba(0, 0, 0, .3); max-width: 300px;
      font: 13px/1.45 system-ui, sans-serif;
    }
    #panel h1 { font-size: 14px; margin: 0 0 6px; }
    #panel button { font-size: 13px; padding: 6px 10px; cursor: pointer; }
    #status { margin-top: 8px; }
    .lm-ok { color: #137333; }
    .lm-bad { color: #c5221f; font-weight: 600; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="panel">
    <h1>Regierungsviertel bounds</h1>
    <div>Drag the vertices to refine the polygon, then save.</div>
    <p><button id="save">Save bounds.geojson</button></p>
    <div id="status"></div>
  </div>
  <script src="/static/leaflet/leaflet.js"></script>
  <script src="/static/leaflet-draw/leaflet.draw.js"></script>
  <script>
    const map = L.map("map");
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);

    let polygonLayer = null;
    let landmarks = [];

    function pointInRing(lng, lat, ring) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0], yi = ring[i][1];
        const xj = ring[j][0], yj = ring[j][1];
        const hit = yi > lat !== yj > lat &&
          lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
        if (hit) inside = !inside;
      }
      return inside;
    }

    function currentRing() {
      return polygonLayer.getLatLngs()[0].map((p) => [p.lng, p.lat]);
    }

    function renderReport(report) {
      let all = true;
      let rows = "";
      for (const [name, inside] of Object.entries(report)) {
        if (!inside) all = false;
        const cls = inside ? "lm-ok" : "lm-bad";
        rows += `<div class="${cls}">${inside ? "\\u2713" : "\\u2717"} ${name}</div>`;
      }
      const head = all
        ? '<div class="lm-ok">All landmarks inside.</div>'
        : '<div class="lm-bad">Some landmarks are OUTSIDE the polygon.</div>';
      document.getElementById("status").innerHTML = head + rows;
    }

    function refreshStatus() {
      const ring = currentRing();
      const report = {};
      for (const lm of landmarks) report[lm.name] = pointInRing(lm.lng, lm.lat, ring);
      renderReport(report);
    }

    async function init() {
      const bounds = await (await fetch("api/bounds")).json();
      const lm = await (await fetch("api/landmarks")).json();
      landmarks = lm.features.map((f) => ({
        name: f.properties.name,
        lng: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
      }));
      for (const m of landmarks) {
        L.marker([m.lat, m.lng]).addTo(map).bindTooltip(m.name);
      }
      const ring = bounds.features[0].geometry.coordinates[0];
      const latlngs = ring.slice(0, -1).map((c) => [c[1], c[0]]);
      polygonLayer = L.polygon(latlngs, {
        color: "#1a73e8",
        weight: 2,
        fillOpacity: 0.08,
      }).addTo(map);
      map.fitBounds(polygonLayer.getBounds().pad(0.2));
      polygonLayer.editing.enable();
      polygonLayer.on("edit", refreshStatus);
      refreshStatus();
    }

    document.getElementById("save").addEventListener("click", async () => {
      const res = await fetch("api/bounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(polygonLayer.toGeoJSON()),
      });
      const data = await res.json();
      if (data.ok) {
        document.getElementById("status").innerHTML =
          '<div class="lm-ok">Saved bounds.geojson.</div>';
        renderReport(data.landmarks_inside);
      } else {
        document.getElementById("status").innerHTML =
          '<div class="lm-bad">Not saved:</div>' +
          (data.errors || []).map((e) => `<div class="lm-bad">- ${e}</div>`).join("");
      }
    });

    init();
  </script>
</body>
</html>
"""


if __name__ == "__main__":
  main()
