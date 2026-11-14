"""Geometric conservation of the final-run road occlusion correction."""
import base64
import gzip
import json
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import Polygon, box, shape
from shapely.ops import unary_union

from scripts.build_road_ground_v343 import visible_overlap

ROOT = Path(__file__).resolve().parents[1]


def load():
    runtime = json.loads((ROOT / "src/app/src/data/roadGroundV343.json").read_text())
    evidence = json.loads(gzip.decompress((ROOT / "geo_data/regierungsviertel/road-ground-v343-evidence.json.gz").read_bytes()))
    source = json.loads(gzip.decompress((ROOT / "geo_data/regierungsviertel/road-ground-v343-source.json.gz").read_bytes()))
    return runtime, evidence, source


def test_correction_uses_actual_triangle_plane_not_nearest_height():
    triangle = Polygon([(0,0),(10,0),(0,10)])
    result = visible_overlap(triangle, [1,0,0], 3, box(-1,-1,11,11))
    assert result.symmetric_difference(triangle.intersection(box(0,0,3,10))).area < 1e-12
    assert visible_overlap(triangle, [0,0,4], 3, triangle).is_empty
    # A former 5 mm deadband left a wide green wedge at the Kanzleramt
    # junction: actual source faces were only 1–4 mm below the old land.
    assert visible_overlap(triangle, [0,0,5.099], 5.1, triangle).equals(triangle)
    assert visible_overlap(triangle, [0,0,5.101], 5.1, triangle).is_empty


def test_every_audited_run_is_a_captured_final_host_and_has_real_street_receipts():
    runtime, evidence, source = load()
    hosts = {tuple(row) for row in source["records"]}
    assert len(evidence["records"]) == runtime["counts"]["runs"] == len(hosts)
    assert runtime["counts"]["byClassM2"]["plazaBrick"] > 900
    assert runtime["counts"]["removedAreaM2"] > 28000
    assert all(tuple(row["finalRun"]) in hosts and row["roadTriangles"] for row in evidence["records"])
    assert any(owner.startswith("mitteSurveyV343:") for row in evidence["records"] for owner,_ in row["roadTriangles"])


def test_every_original_outside_land_complement_is_preserved():
    runtime, evidence, _ = load()
    records = np.frombuffer(base64.b64decode(runtime["cells_u32"]),dtype="<u4").reshape(-1,6)
    spans = np.frombuffer(base64.b64decode(runtime["spans_u32"]),dtype="<u4")
    tops = np.frombuffer(base64.b64decode(runtime["tops_f32"]),dtype="<f4")
    points = np.frombuffer(base64.b64decode(runtime["triangles_f32"]),dtype="<f4").reshape(-1,2)
    mx,mz = runtime["grid"]["min_x_idx"],runtime["grid"]["min_z_idx"]
    for row in evidence["records"]:
        removed = shape(json.loads(row["removed"]))
        for i in range(row["firstRecord"], row["firstRecord"]+row["recordCount"]):
            x,z,start,count,_,_ = [int(v) for v in records[i]]
            host = box((mx+x)*4,(mz+z)*4,(mx+x+int(spans[i]))*4,(mz+z+1)*4)
            triangles = points[start:start+count].reshape(-1,3,2)
            retained = unary_union(shapely.polygons(triangles)) if count else Polygon()
            expected = host.difference(removed)
            # Float32 storage introduces <0.5 mm boundary rounding at core limits.
            assert retained.symmetric_difference(expected).area < max(.025, expected.length*.0006)
            assert abs(float(tops[i])-row["finalRun"][4]) < .000002
            assert retained.difference(host.buffer(.001)).area < .000001


def test_complete_plaza_ownership_is_exact_and_distinct_from_proven_road_occlusion():
    runtime,evidence,_ = load()
    plaza=json.loads((ROOT/"src/app/src/data/kulturforumPlazaV343.json").read_text())
    footprint=shape(plaza["footprint"])
    assert runtime["plazaSourceSha256"] == plaza["sourceSha256"]
    records=np.frombuffer(base64.b64decode(runtime["cells_u32"]),dtype="<u4").reshape(-1,6)
    spans=np.frombuffer(base64.b64decode(runtime["spans_u32"]),dtype="<u4")
    expected_records=[]
    total=0.0
    for row in evidence["records"]:
        x0,z0,x1,z1,_,_=row["finalRun"]
        overlap=footprint.intersection(box(x0,z0,x1,z1))
        assert abs(overlap.area-row["plazaOwnershipAreaM2"]) < 1e-7
        total+=overlap.area
        assert overlap.difference(shape(json.loads(row["removed"]))).area < 1e-7
        for i in range(row["firstRecord"],row["firstRecord"]+row["recordCount"]):
            x,z,*_=records[i]
            host=box((int(x)+runtime["grid"]["min_x_idx"])*4,
                     (int(z)+runtime["grid"]["min_z_idx"])*4,
                     (int(x)+int(spans[i])+runtime["grid"]["min_x_idx"])*4,
                     (int(z)+1+runtime["grid"]["min_z_idx"])*4)
            if host.intersection(footprint).area > 1e-7:
                expected_records.append(i)
    assert expected_records == runtime["plazaRecords"]
    assert abs(total-runtime["counts"]["plazaOwnedOriginalGroundM2"]) < 1e-7
    assert runtime["counts"]["plazaAdditionalOwnershipM2"] <= total
    assert abs(footprint.area-runtime["counts"]["plazaFootprintAreaM2"]) < 1e-7


def test_source_inputs_are_retained_and_runtime_is_bounded():
    import hashlib
    runtime,evidence,_ = load()
    for path,digest in evidence["inputSha256"].items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == digest
    assert runtime["counts"]["unindexedVertices"] < 440000
    # Finite v343 descriptor, including the final approved complete plaza owner;
    # this does not change any live geometry, decode or residency limit.
    assert (ROOT/"src/app/src/data/roadGroundV343.json").stat().st_size < 2000000
