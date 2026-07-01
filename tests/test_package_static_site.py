from __future__ import annotations

import importlib.util
import os
import socket
import stat
import zipfile
from pathlib import Path
from types import ModuleType


def load_script_module(name: str, relative_path: str) -> ModuleType:
  root = Path(__file__).resolve().parents[1]
  module_path = root / relative_path
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
  assert "BrokenPipeError" in serve_text
  assert "ConnectionResetError" in serve_text
  assert not (tmp_path / "start-mac.command").exists()

  mac_notes = (tmp_path / "start-mac-if-needed.txt").read_text(encoding="utf-8")
  linux = (tmp_path / "start-linux.sh").read_text(encoding="utf-8")
  windows = (tmp_path / "start-windows.bat").read_text(encoding="utf-8")
  assert "Gatekeeper" in mac_notes
  assert "python3 serve-local.py" in mac_notes
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
  (dzi / "reference_map.png").write_bytes(b"png")
  (dzi / "landmarks.json").write_text(
    '{"image":{"width":10,"height":10},"landmarks":[{"name":"Reichstag","x":5,"y":5}]}',
    encoding="utf-8",
  )

  package_static_site.write_start_here(tmp_path)

  html = (tmp_path / "START-HERE.html").read_text(encoding="utf-8")
  assert 'type="module"' not in html
  assert "overview.png" in html
  assert "reference_map.png" in html
  assert "Reichstag" in html
  assert "__LANDMARK_PAYLOAD__" not in html


def test_package_readme_mentions_version_and_port_fallback(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )

  package_static_site.write_readme(tmp_path)

  readme = (tmp_path / "README.txt").read_text(encoding="utf-8")
  assert package_static_site.PACKAGE_VERSION in readme
  assert "START-HERE.html" in readme
  assert "start-mac.command" in readme
  assert "Gatekeeper" in readme
  assert "nächsten freien Port" in readme
  assert "next free port" in readme
  assert "--no-open --port 8770" in readme


def test_bundled_landmarks_match_public_viewer_landmarks() -> None:
  root = Path(__file__).resolve().parents[1]
  public_landmarks = (
    root / "src/app/public/dzi/regierungsviertel/landmarks.json"
  ).read_bytes()
  bundled_landmarks = (
    root / "src/app/src/data/regierungsviertel-landmarks.json"
  ).read_bytes()

  assert bundled_landmarks == public_landmarks


def test_copy_static_site_skips_duplicate_and_dev_files(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )
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
