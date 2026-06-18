from __future__ import annotations

import importlib.util
import socket
import stat
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
  assert "first_available_port" in serve_script.read_text(encoding="utf-8")

  mac = (tmp_path / "start-mac.command").read_text(encoding="utf-8")
  linux = (tmp_path / "start-linux.sh").read_text(encoding="utf-8")
  windows = (tmp_path / "start-windows.bat").read_text(encoding="utf-8")
  assert "python3 serve-local.py" in mac
  assert "python3 serve-local.py" in linux
  assert "py -3 serve-local.py" in windows
  assert "-m http.server" not in mac
  assert "-m http.server" not in linux
  assert "-m http.server" not in windows


def test_package_readme_mentions_version_and_port_fallback(tmp_path: Path) -> None:
  package_static_site = load_script_module(
    "package_static_site", "scripts/package_static_site.py"
  )

  package_static_site.write_readme(tmp_path)

  readme = (tmp_path / "README.txt").read_text(encoding="utf-8")
  assert package_static_site.PACKAGE_VERSION in readme
  assert "nächsten freien Port" in readme
  assert "next free port" in readme


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
