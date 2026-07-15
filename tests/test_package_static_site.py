from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import socket
import stat
import tarfile
import zipfile
from pathlib import Path
from types import ModuleType

import pytest


def load_script_module(name: str, relative_path: str) -> ModuleType:
  root = Path(__file__).resolve().parents[1]
  module_path = root / relative_path
  spec = importlib.util.spec_from_file_location(name, module_path)
  assert spec is not None
  assert spec.loader is not None
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def load_module_path(name: str, module_path: Path) -> ModuleType:
  spec = importlib.util.spec_from_file_location(name, module_path)
  assert spec is not None
  assert spec.loader is not None
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def test_write_launchers_use_shared_port_fallback_server(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )

  package_static_site.write_launchers(tmp_path)

  serve_script = tmp_path / "serve-local.py"
  assert serve_script.exists()
  assert serve_script.stat().st_mode & stat.S_IXUSR
  serve_text = serve_script.read_text(encoding="utf-8")
  assert "first_available_port(args.host, args.port)" in serve_text
  assert "--host" in serve_text
  assert "--port" in serve_text
  assert "--no-open" in serve_text
  assert "if not args.no_open" in serve_text
  assert 'START_PAGE = "index.html"' in serve_text
  assert "require_package_files(root)" in serve_text
  assert "verify_webgl_scene(root)" in serve_text
  assert "file_sha256(path)" in serve_text
  assert "cache_control_for_path(self.path)" in serve_text
  assert 'protocol_version = "HTTP/1.1"' in serve_text
  assert "daemon_threads = True" in serve_text
  assert "flush=True" in serve_text
  assert "/{START_PAGE}" in serve_text
  assert "BrokenPipeError" in serve_text
  assert "ConnectionResetError" in serve_text
  assert not (tmp_path / "start-mac.command").exists()

  mac_notes = (tmp_path / "start-mac-if-needed.txt").read_text(encoding="utf-8")
  linux = (tmp_path / "start-linux.sh").read_text(encoding="utf-8")
  windows = (tmp_path / "start-windows.bat").read_text(encoding="utf-8")
  assert "Gatekeeper" in mac_notes
  assert "python3 serve-local.py" in mac_notes
  assert "index.html address" in mac_notes
  assert "python3 serve-local.py" in linux
  assert "py -3 serve-local.py" in windows
  assert "-m http.server" not in mac_notes
  assert "-m http.server" not in linux
  assert "-m http.server" not in windows


def test_write_start_here_writes_zero_server_html_viewer(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )
  (tmp_path / "index.html").write_text(
    '<script type="module" src="./assets/index.js"></script>',
    encoding="utf-8",
  )
  dzi = tmp_path / "dzi" / "regierungsviertel"
  dzi.mkdir(parents=True)
  (dzi / "overview.png").write_bytes(b"png")
  (dzi / "overview_source.png").write_bytes(b"png")
  (dzi / "reference_map.png").write_bytes(b"png")
  (dzi / "landmarks.json").write_text(
    '{"image":{"width":10,"height":10},"landmarks":[{"name":"Reichstag","x":5,"y":5}]}',
    encoding="utf-8",
  )

  package_static_site.write_start_here(tmp_path)

  html = (tmp_path / "START-HERE.html").read_text(encoding="utf-8")
  assert 'type="module"' not in html
  assert "overview.png" in html
  assert "overview_source.png" in html
  assert "reference_map.png" in html
  assert "Reichstag" in html
  assert "Bundeskanzleramt" in html
  assert "DEFAULT_FOCUS_LANDMARK" in html
  assert "PRIORITY_LANDMARKS" in html
  assert "addLandmarkList" in html
  assert 'className = "marker"' not in html
  assert '<div id="markers">' not in html
  assert "markerRoot" not in html
  assert "focus-ring" in html
  assert "sourceImage" in html
  assert "landmarkScaleX" in html
  assert "landmarkScaleY" in html
  assert "landmark.nx * image.width" in html
  assert "mapImage.style.width" in html
  assert "transform-origin: 0 0" in html
  assert "stagePointToImage" in html
  assert "placeImagePointAt" in html
  assert "preserveStageCenter" in html
  assert "constrainView" in html
  assert "Drehen/Swivel" in html
  assert "rotateBy" in html
  assert "ArrowLeft" in html
  assert "ArrowRight" in html
  assert "ArrowUp" in html
  assert "ArrowDown" in html
  assert "PageDown" in html
  assert "event.shiftKey" in html
  assert "tiltBy" in html
  assert "view-north" in html
  assert "setViewPreset" in html
  assert "compass" in html
  assert "lang-en" in html
  assert "applyLanguage" in html
  assert "https://github.com/Klotzkette/isometric-berlin" in html
  assert "Open public repository" in html
  assert "Öffentliches Repository öffnen" in html
  assert "releases/latest/download/isometric-berlin-regierungsviertel-local.zip" in html
  assert "theme-night" in html
  assert "setTheme" in html
  assert "night-light-overlay" in html
  assert "addNightLights" in html
  assert "night-window" in html
  assert "night-street-lamp" in html
  assert "scene-detail-overlay" in html
  assert "addSceneDetails" in html
  assert "details-toggle" in html
  assert "clouds-toggle" in html
  assert "performance-toggle" in html
  assert "setDetails" in html
  assert "setClouds" in html
  assert "setPerformance" in html
  assert "data-performance" in html
  assert "data-dragging" in html
  assert "detail-cloud" in html
  assert "cloud-shadow" in html
  assert "sunbeam" in html
  assert "detail-glint" in html
  assert "detail-ripple" in html
  assert "detail-tree-cluster" in html
  assert "detail-water-depth" in html
  assert "detail-tunnel-branch" in html
  assert ".tunnel-overlay {" in html
  assert "visibility: hidden;" in html
  assert 'body[data-under="true"] .tunnel-overlay' in html
  assert (
    'document.getElementById("tunnel-focus").addEventListener("click", () =>' in html
  )
  assert "setUnderView(true);" in html
  assert "detail-train-ice" in html
  assert "detail-train-sbahn" in html
  assert "detail-vehicle" in html
  assert "vehicle-light-cone" in html
  assert "tunnelHalfWidth" in html
  assert "rotate(${rotation}) scale(.16)" in html
  assert "rotate(${rotation}) scale(.46)" in html
  assert "rotate(${rotation}) scale(.3)" in html
  assert "addFlag" in html
  assert "detail-boat" in html
  assert "PREFERENCE_STORAGE_KEY" in html
  assert "readPreferences" in html
  assert "savePreferences" in html
  assert "localStorage" in html
  assert "readStartParams" in html
  assert "paramFlag" in html
  assert "paramChoice" in html
  assert "applyQualityImage" in html
  assert "imageFallbackAttempted" in html
  assert 'mapImage.addEventListener("error"' in html
  assert "savedLandmarkName" in html
  assert "restoreInitialView" in html
  assert "initialViewState" in html
  assert "resetView" in html
  assert "refitPreservingView" in html
  assert "setTimeout(refitPreservingView, 80)" in html
  assert "event.metaKey" in html
  assert "event.ctrlKey" in html
  assert "event.altKey" in html
  assert "targetTag" in html
  assert "viewport-fit=cover" in html
  assert "100dvh" in html
  assert "@media (pointer: coarse)" in html
  assert "min-height: 44px" in html
  assert "activePointers" in html
  assert "pinchGesture" in html
  assert 'pointerType === "touch"' in html
  assert "startPinchGesture" in html
  assert "updatePinchGesture" in html
  assert "pointerAngle" in html
  assert "startRotation" in html
  assert "resumeSingleTouchDrag" in html
  assert "!activePointers.has(event.pointerId)" in html
  assert 'window.location.protocol !== "file:"' in html
  assert "serverRequired" in html
  assert "__LANDMARK_PAYLOAD__" not in html


def test_generated_server_rejects_corrupt_webgl_asset(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site_server_integrity", "scripts/package_static_site.py"
  )
  package_static_site.write_launchers(tmp_path)
  mesh_root = tmp_path / "mesh" / "regierungsviertel"
  mesh_root.mkdir(parents=True)
  model = b"valid-glb"
  (mesh_root / "tile.glb").write_bytes(model)
  entry = {
    "file": "tile.glb",
    "bytes": len(model),
    "sha256": hashlib.sha256(model).hexdigest(),
  }
  (mesh_root / "scene.json").write_text(
    json.dumps(
      {
        "base_tiles": [entry],
        "surface_detail_tiles": [entry],
        "hero_details": [],
      }
    ),
    encoding="utf-8",
  )
  server = load_module_path("generated_local_server", tmp_path / "serve-local.py")

  server.verify_webgl_scene(tmp_path)
  (mesh_root / "tile.glb").write_bytes(b"corrupt")

  with pytest.raises(SystemExit, match="3D model size mismatch"):
    server.verify_webgl_scene(tmp_path)


def test_generated_server_cache_policy_covers_100_requests(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site_server_cache", "scripts/package_static_site.py"
  )
  package_static_site.write_launchers(tmp_path)
  server = load_module_path("generated_cache_server", tmp_path / "serve-local.py")

  for index in range(100):
    suffix = ".glb" if index % 2 == 0 else ".html"
    policy = server.cache_control_for_path(f"/asset-{index}{suffix}?v=1")
    expected = "public, max-age=31536000, immutable" if suffix == ".glb" else "no-cache"
    assert policy == expected
  assert server.QuietHandler.extensions_map[".glb"] == "model/gltf-binary"
  assert server.QuietHandler.protocol_version == "HTTP/1.1"
  assert server.ReusableTCPServer.daemon_threads is True


def test_repo_server_uses_static_asset_cache_without_stale_html() -> None:
  serve_local_viewer = load_script_module(
    "serve_local_viewer_cache", "scripts/serve_local_viewer.py"
  )

  assert (
    serve_local_viewer.cache_control_for_path("/mesh/tile.glb?hash=abc")
    == "public, max-age=0, must-revalidate"
  )
  assert serve_local_viewer.cache_control_for_path("/index.html") == "no-cache"
  assert serve_local_viewer.cache_control_for_path("/scene.json") == "no-cache"
  assert serve_local_viewer.QuietHandler.extensions_map[".glb"] == ("model/gltf-binary")
  assert serve_local_viewer.ReusableTCPServer.daemon_threads is True


def test_package_readme_mentions_version_and_port_fallback(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )

  package_static_site.write_readme(tmp_path)

  readme = (tmp_path / "README.txt").read_text(encoding="utf-8")
  assert package_static_site.PACKAGE_VERSION in readme
  assert "START-HERE.html" in readme
  assert "2D-Kompatibilitätsansicht" in readme
  assert "Echtes 3D" in readme
  assert "40 x 23,5 m Kuppel" in readme
  assert "321-m-Glasdach" in readme
  assert "62,5 x 11 x 26 m" in readme
  assert "start-mac.command" in readme
  assert "Gatekeeper" in readme
  assert "nächsten freien Port" in readme
  assert "next free port" in readme
  assert "Tag-/Nachtmodus" in readme
  assert "German/English" in readme
  assert "localStorage" in readme
  assert "focused landmark" in readme
  assert "Touchscreen" in readme
  assert "two fingers pinch-zoom" in readme
  assert "--no-open --port 8770" in readme


def test_write_package_manifest_records_version_hashes_and_attribution(
  tmp_path: Path,
) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )
  dzi = tmp_path / "dzi" / "regierungsviertel"
  dzi.mkdir(parents=True)
  files = {
    "START-HERE.html": b"<html></html>",
    "dzi/regierungsviertel/overview_source.png": b"source",
    "dzi/regierungsviertel/overview.png": b"pixel",
    "dzi/regierungsviertel/regierungsviertel.dzi": b"dzi",
    "dzi/regierungsviertel/reference_map.png": b"reference",
    "dzi/regierungsviertel/landmarks.json": b"{}",
    "dzi/regierungsviertel/tiergartentunnel.json": b'{"routes":[]}',
    "dzi/regierungsviertel/wikimedia_attribution.json": b"{}",
    "mesh/regierungsviertel/scene.json": b'{"schema_version":1}',
  }
  for relative, data in files.items():
    path = tmp_path / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

  package_static_site.write_package_manifest(tmp_path)

  manifest = json.loads(
    (tmp_path / "package-manifest.json").read_text(encoding="utf-8")
  )
  assert manifest["package_version"] == package_static_site.PACKAGE_VERSION
  assert manifest["start_page_mode"] == "2d-compatibility-fallback"
  assert manifest["full_3d_start_page"] == "index.html"
  assert manifest["preferred_image"] == "dzi/regierungsviertel/overview_source.png"
  assert manifest["uses_google_content"] is False
  assert "OpenStreetMap contributors" in manifest["required_attribution"]
  assert manifest["assets"]["detail_image"]["bytes"] == len(b"source")
  assert len(manifest["assets"]["detail_image"]["sha256"]) == 64


def test_bundled_landmarks_match_public_viewer_landmarks() -> None:
  root = Path(__file__).resolve().parents[1]
  public_landmarks = (
    root / "src/app/public/dzi/regierungsviertel/landmarks.json"
  ).read_bytes()
  bundled_landmarks = (
    root / "src/app/src/data/regierungsviertel-landmarks.json"
  ).read_bytes()

  assert bundled_landmarks == public_landmarks


def test_copy_static_site_skips_duplicate_and_dev_files(
  tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )

  def fail_fast_copy(*_args: object, **_kwargs: object) -> None:
    raise AssertionError("copy_static_site must not use macOS fcopyfile fast paths")

  monkeypatch.setattr(package_static_site.shutil, "copy2", fail_fast_copy)
  monkeypatch.setattr(package_static_site.shutil, "copyfile", fail_fast_copy)

  source = tmp_path / "dist"
  source.mkdir()
  (source / "index.html").write_text("<html></html>", encoding="utf-8")
  (source / "index 2.html").write_text("duplicate", encoding="utf-8")
  (source / ".DS_Store").write_text("metadata", encoding="utf-8")
  duplicate_dir = source / "dzi 2"
  duplicate_dir.mkdir()
  (duplicate_dir / "tile.jpg").write_text("duplicate tile", encoding="utf-8")
  assets = source / "assets"
  assets.mkdir()
  (assets / "index.js").write_text("console.log('ok')", encoding="utf-8")
  (assets / "index.js.map").write_text("{}", encoding="utf-8")

  target = tmp_path / "package"
  package_static_site.copy_static_site(source, target)

  assert (target / "index.html").exists()
  assert (target / "assets" / "index.js").exists()
  assert not (target / "index 2.html").exists()
  assert not (target / ".DS_Store").exists()
  assert not (target / "dzi 2").exists()
  assert not (target / "assets" / "index.js.map").exists()


def test_copy_static_site_does_not_follow_symlinks(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site_symlink", "scripts/package_static_site.py"
  )
  source = tmp_path / "dist"
  source.mkdir()
  outside = tmp_path / "outside.txt"
  outside.write_text("must not be packaged", encoding="utf-8")
  (source / "linked.txt").symlink_to(outside)
  (source / "index.html").write_text("<html></html>", encoding="utf-8")

  target = tmp_path / "package"
  package_static_site.copy_static_site(source, target)

  assert (target / "index.html").exists()
  assert not (target / "linked.txt").exists()


def test_ensure_dzi_tiles_copied_repairs_missing_package_level(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site_dzi_repair", "scripts/package_static_site.py"
  )
  source = tmp_path / "dist"
  tile = (
    source / "dzi" / "regierungsviertel" / "regierungsviertel_files" / "8" / "0_0.jpg"
  )
  tile.parent.mkdir(parents=True)
  tile.write_bytes(b"tile-level-8")

  target = tmp_path / "package"
  target.mkdir()
  repaired = (
    target / "dzi" / "regierungsviertel" / "regierungsviertel_files" / "8" / "0_0.jpg"
  )

  package_static_site.ensure_dzi_tiles_copied(source, target)

  assert repaired.read_bytes() == b"tile-level-8"


def test_package_static_site_repairs_dzi_levels_from_public_source(
  tmp_path: Path,
) -> None:
  package_static_site = load_script_module(
    "package_static_site_public_dzi_repair", "scripts/package_static_site.py"
  )
  root = tmp_path / "repo"
  dist_dzi = root / "src" / "app" / "dist" / "dzi" / "regierungsviertel"
  public_dzi = root / "src" / "app" / "public" / "dzi" / "regierungsviertel"
  dist_dzi.mkdir(parents=True)
  public_dzi.mkdir(parents=True)
  (root / "src" / "app" / "dist" / "index.html").write_text(
    "<html></html>", encoding="utf-8"
  )
  (root / "src" / "app" / "dist" / "favicon.svg").write_text(
    "<svg></svg>", encoding="utf-8"
  )
  for filename, data in {
    "overview.png": b"overview",
    "overview_source.png": b"source",
    "reference_map.png": b"reference",
    "regierungsviertel.dzi": b"dzi",
    "tiergartentunnel.json": b'{"routes":[]}',
    "wikimedia_attribution.json": b"{}",
  }.items():
    (dist_dzi / filename).write_bytes(data)
  (dist_dzi / "landmarks.json").write_text(
    '{"image":{"width":10,"height":10},"landmarks":[]}', encoding="utf-8"
  )
  scene = root / "src" / "app" / "dist" / "mesh" / "regierungsviertel" / "scene.json"
  scene.parent.mkdir(parents=True)
  scene.write_text('{"schema_version":1}', encoding="utf-8")
  missing_from_dist = public_dzi / "regierungsviertel_files" / "0" / "0_0.jpg"
  missing_from_dist.parent.mkdir(parents=True)
  missing_from_dist.write_bytes(b"low-level-tile")

  package_dir, _, _ = package_static_site.package_static_site(root, tmp_path / "out")

  repaired = (
    package_dir
    / "dzi"
    / "regierungsviertel"
    / "regierungsviertel_files"
    / "0"
    / "0_0.jpg"
  )
  assert repaired.read_bytes() == b"low-level-tile"


def test_zip_package_skips_stale_duplicate_files(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )
  package_dir = tmp_path / package_static_site.PACKAGE_NAME
  package_dir.mkdir()
  (package_dir / "index.html").write_text("<html></html>", encoding="utf-8")
  (package_dir / "index 2.html").write_text("duplicate", encoding="utf-8")
  (package_dir / "README.txt").write_text("readme", encoding="utf-8")
  (package_dir / "README 2.txt").write_text("duplicate", encoding="utf-8")
  (package_dir / ".DS_Store").write_text("metadata", encoding="utf-8")
  duplicate_dir = package_dir / "dzi 2"
  duplicate_dir.mkdir()
  (duplicate_dir / "tile.jpg").write_text("duplicate tile", encoding="utf-8")

  zip_path = tmp_path / "package.zip"
  package_static_site.zip_package(package_dir, zip_path)

  with zipfile.ZipFile(zip_path) as archive:
    names = set(archive.namelist())

  assert f"{package_static_site.PACKAGE_NAME}/index.html" in names
  assert f"{package_static_site.PACKAGE_NAME}/README.txt" in names
  assert f"{package_static_site.PACKAGE_NAME}/index 2.html" not in names
  assert f"{package_static_site.PACKAGE_NAME}/README 2.txt" not in names
  assert f"{package_static_site.PACKAGE_NAME}/.DS_Store" not in names
  assert f"{package_static_site.PACKAGE_NAME}/dzi 2/tile.jpg" not in names


def test_remove_unwanted_package_paths_deletes_stale_duplicates(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )
  package_dir = tmp_path / package_static_site.PACKAGE_NAME
  package_dir.mkdir()
  (package_dir / "README.txt").write_text("readme", encoding="utf-8")
  (package_dir / "README 2.txt").write_text("duplicate", encoding="utf-8")
  duplicate_dir = package_dir / "assets 2"
  duplicate_dir.mkdir()
  (duplicate_dir / "index.js").write_text("duplicate asset", encoding="utf-8")
  hidden_dir = package_dir / ".metadata"
  hidden_dir.mkdir()
  (hidden_dir / "state").write_text("hidden", encoding="utf-8")

  package_static_site.remove_unwanted_package_paths(package_dir)

  assert (package_dir / "README.txt").exists()
  assert not (package_dir / "README 2.txt").exists()
  assert not duplicate_dir.exists()
  assert not hidden_dir.exists()


def test_zip_package_preserves_executable_launcher_modes(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )
  package_dir = tmp_path / package_static_site.PACKAGE_NAME
  package_dir.mkdir()
  package_static_site.write_launchers(package_dir)

  zip_path = tmp_path / "package.zip"
  package_static_site.zip_package(package_dir, zip_path)

  with zipfile.ZipFile(zip_path) as archive:
    modes = {
      info.filename: (info.external_attr >> 16) & 0o777 for info in archive.infolist()
    }
    timestamps = {info.filename: info.date_time for info in archive.infolist()}

  prefix = package_static_site.PACKAGE_NAME
  assert modes[f"{prefix}/serve-local.py"] & stat.S_IXUSR
  assert f"{prefix}/start-mac.command" not in modes
  assert not modes[f"{prefix}/start-mac-if-needed.txt"] & stat.S_IXUSR
  assert modes[f"{prefix}/start-linux.sh"] & stat.S_IXUSR
  assert not modes[f"{prefix}/start-windows.bat"] & stat.S_IXUSR
  assert set(timestamps.values()) == {package_static_site.ZIP_TIMESTAMP}


def test_zip_package_is_deterministic(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )
  package_dir = tmp_path / package_static_site.PACKAGE_NAME
  package_dir.mkdir()
  readme = package_dir / "README.txt"
  readme.write_text("readme", encoding="utf-8")
  script = package_dir / "start-linux.sh"
  script.write_text("#!/bin/sh\n", encoding="utf-8")
  script.chmod(script.stat().st_mode | stat.S_IXUSR)

  zip_a = tmp_path / "a.zip"
  zip_b = tmp_path / "b.zip"

  package_static_site.zip_package(package_dir, zip_a)
  os.utime(readme, (1_700_000_000, 1_700_000_000))
  os.utime(script, (1_800_000_000, 1_800_000_000))
  package_static_site.zip_package(package_dir, zip_b)

  assert zip_a.read_bytes() == zip_b.read_bytes()


def test_static_tarball_is_deterministic_and_link_free(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site_tar", "scripts/package_static_site.py"
  )
  source = tmp_path / "dist"
  source.mkdir()
  (source / "index.html").write_text("<html></html>", encoding="utf-8")
  assets = source / "assets"
  assets.mkdir()
  script = assets / "index.js"
  script.write_text("console.log('ok')", encoding="utf-8")
  (assets / "index.js.map").write_text("{}", encoding="utf-8")

  tar_a = tmp_path / "a.tar.gz"
  tar_b = tmp_path / "b.tar.gz"
  package_static_site.tar_static_site(source, tar_a)
  os.utime(script, (1_800_000_000, 1_800_000_000))
  package_static_site.tar_static_site(source, tar_b)

  assert tar_a.read_bytes() == tar_b.read_bytes()
  with tarfile.open(tar_a, "r:gz") as archive:
    members = archive.getmembers()
  assert {member.name for member in members} == {
    "assets/index.js",
    "index.html",
  }
  assert all(member.isfile() for member in members)
  assert {member.mtime for member in members} == {package_static_site.ARCHIVE_MTIME}


def test_local_viewer_server_skips_busy_port() -> None:
  serve_local_viewer = load_script_module(
    "serve_local_viewer", "scripts/serve_local_viewer.py"
  )

  with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as occupied:
    occupied.bind(("127.0.0.1", 0))
    occupied.listen()
    busy_port = occupied.getsockname()[1]

    port = serve_local_viewer.first_available_port("127.0.0.1", busy_port)

  assert port != busy_port
  assert port > busy_port


def test_repo_local_viewer_suppresses_aborted_browser_requests() -> None:
  root = Path(__file__).resolve().parents[1]
  server_script = (root / "scripts" / "serve_local_viewer.py").read_text(
    encoding="utf-8"
  )

  assert "BrokenPipeError" in server_script
  assert "ConnectionResetError" in server_script
