"""Losslessly divide resident core geometry into bounded JavaScript modules.

This changes neither triangle positions/colours nor ink segments. Mode-specific
entry modules allow Minecraft's source to remain unparsed until requested.
"""

from __future__ import annotations

import argparse
import base64
import json
from pathlib import Path

import numpy as np
from alt_mitte_v169_packets import empty_packet, fits, raw_packet
from build_surrounding_outlines import ROOT

DATA = ROOT / "src/app/src/data"
MAX_MODULE_BYTES = 3 * 1024 * 1024


def publish_navigation(source_folder: Path) -> dict:
  """Split complete records, preserving all coordinates and their exact order."""
  source = json.loads((source_folder / "altMitteV169Navigation.json").read_bytes())
  folder = DATA / "altMitteV169Navigation"
  folder.mkdir(exist_ok=True)
  imports, fields, files = [], [], []
  total_bytes = 0
  for field, records in source.items():
    names, current, current_bytes = [], [], 3

    def flush() -> None:
      nonlocal current, current_bytes, total_bytes
      index = len(files)
      name = f"packet-{index:03}.json"
      raw = b"[" + b",".join(current) + b"]\n"
      assert len(raw) < MAX_MODULE_BYTES
      (folder / name).write_bytes(raw)
      total_bytes += len(raw)
      imports.append(f'import p{index} from "./{folder.name}/{name}";')
      names.append(f"p{index}")
      files.append({"field": field, "file": f"{folder.name}/{name}"})
      current, current_bytes = [], 3

    for record in records:
      raw = json.dumps(record, ensure_ascii=False, separators=(",", ":")).encode()
      if current and current_bytes + len(raw) + 1 >= 2 * 1024 * 1024:
        flush()
      current.append(raw)
      current_bytes += len(raw) + 1
    if current:
      flush()
    fields.append(f"{field}:[{','.join('...' + name for name in names)}]")
  (DATA / "altMitteV169Navigation.json").write_text(
    json.dumps(
      {"schemaVersion": 1, "fields": list(source), "chunkFiles": files},
      separators=(",", ":"),
    )
    + "\n"
  )
  (DATA / "altMitteV169NavigationData.ts").write_text(
    "\n".join(
      [*imports, f"export default /*#__PURE__*/ (() => ({{{','.join(fields)}}}))();"]
    )
    + "\n"
  )
  return {"packets": len(files), "bytes": total_bytes}


def split_mesh(mesh: dict, indices_per_piece: int = 90_000) -> list[dict]:
  """Reindex complete triangles only; never round a source coordinate twice."""
  positions = np.frombuffer(base64.b64decode(mesh["positions"]), dtype="<u2").reshape(
    -1, 3
  )
  colors = np.frombuffer(base64.b64decode(mesh["colors"]), dtype="u1").reshape(-1, 3)
  indices = np.frombuffer(base64.b64decode(mesh["indices"]), dtype="<u4")
  assert indices_per_piece % 3 == 0
  result = []
  for start in range(0, len(indices), indices_per_piece):
    referenced, local = np.unique(
      indices[start : start + indices_per_piece], return_inverse=True
    )
    result.append(
      {
        **mesh,
        "positions": base64.b64encode(
          positions[referenced].astype("<u2").tobytes()
        ).decode(),
        "colors": base64.b64encode(colors[referenced].tobytes()).decode(),
        "indices": base64.b64encode(local.astype("<u4").tobytes()).decode(),
      }
    )
  return result


def split_source(source: dict, mode: str) -> list[dict]:
  """Each source packet stays in its original centimetre coordinate frame."""
  result = []
  for chunk in source[mode + "Chunks"]:
    packet = chunk["packet"]
    x, origin_y, z = packet["origin"]
    bounds = (x, z, x + 512, z + 512)
    pieces = [m for mesh in packet["meshes"] for m in split_mesh(mesh)]
    for i, mesh in enumerate(pieces):
      value = empty_packet(f"{chunk['id']}-piece-{i}", bounds, origin_y)
      value["meshes"] = [mesh]
      assert fits(value) and len(raw_packet(value)) < MAX_MODULE_BYTES
      result.append({"id": value["id"], "packet": value})
    if packet.get("lines", {}).get("positions"):
      positions = base64.b64decode(packet["lines"]["positions"])
      colors = base64.b64decode(packet["lines"].get("colors", ""))
      for i, start in enumerate(range(0, len(positions), 1_440_000)):
        value = empty_packet(f"{chunk['id']}-ink-{i}", bounds, origin_y)
        value["lines"] = {
          "positions": base64.b64encode(positions[start : start + 1_440_000]).decode()
        }
        if colors:
          value["lines"]["colors"] = base64.b64encode(
            colors[start // 2 : (start + 1_440_000) // 2]
          ).decode()
        assert fits(value) and len(raw_packet(value)) < MAX_MODULE_BYTES
        result.append({"id": value["id"], "packet": value})
  return result


def publish(source_folder: Path) -> dict:
  """Keep compact source manifests plus explicit mode-specific import graphs."""
  report = {}
  for label, mode in (("Drawn", "drawn"), ("Native", "minecraft")):
    filename = f"altMitte{label}V169Source.json"
    source = json.loads((source_folder / filename).read_bytes())
    chunks = split_source(source, mode)
    folder = DATA / f"altMitteV169{label}"
    folder.mkdir(exist_ok=True)
    imports, entries, files = [], [], []
    for index, chunk in enumerate(chunks):
      name = f"packet-{index:03}.json"
      content = raw_packet(chunk["packet"])
      (folder / name).write_bytes(content)
      imports.append(f'import p{index} from "./{folder.name}/{name}";')
      entries.append(f"{{id:{json.dumps(chunk['id'])},packet:p{index}}}")
      files.append({"id": chunk["id"], "file": f"{folder.name}/{name}"})
    metadata = {
      "schemaVersion": 1,
      "sourceParents": source["sourceParents"],
      "drawnChunks": [],
      "minecraftChunks": [],
      "chunkFiles": files,
      "mode": mode,
    }
    (DATA / filename).write_text(json.dumps(metadata, separators=(",", ":")) + "\n")
    code = [
      f'import manifest from "./{filename}";',
      *imports,
      f"export default {{...manifest, {mode}Chunks:[{','.join(entries)}]}};",
    ]
    (DATA / f"altMitte{label}V169Data.ts").write_text("\n".join(code) + "\n")
    report[mode] = {
      "packets": len(chunks),
      "bytes": sum(
        (folder / f"packet-{i:03}.json").stat().st_size for i in range(len(chunks))
      ),
      "originalBytes": len(raw_packet(source)),
    }
  report["navigation"] = publish_navigation(source_folder)
  return report


if __name__ == "__main__":
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("source_folder", type=Path)
  print(publish(parser.parse_args().source_folder))
