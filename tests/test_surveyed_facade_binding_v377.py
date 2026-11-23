from scripts.build_surveyed_facades_v377 import compile_catalog


def face(a, b, *, owner="owner", family="drawn", tile="one", low=2, high=20):
    return {"family": family, "tile": tile, "owner": owner, "a": a, "b": b,
            "normal": [0, 1], "low": low, "high": high}


def test_photo_frontage_clips_both_tiles_and_excludes_parallel_back_and_blind_walls():
    band = {"kind": "window", "x": [0.08, 0.94], "y": [0.2, 0.85], "columns": 12, "rows": 4}
    record = {"azimuth": 180, "tolerance": 12, "profile": 0, "a": [3, 0], "b": [15, 0],
              "low": 4, "high": 16}
    blank = {**record, "profile": 1, "a": [3, 18], "b": [15, 18]}
    survey = {"targets": [{"id": "large", "segments": [
        face([0, 0], [8, 0]), face([18, 0], [8, 0], tile="two", high=10),
        face([0, 12], [18, 12]), face([0, 18], [18, 18]),
        face([4, .5], [18, .5], family="minecraft"),
    ]}]}
    result = compile_catalog(survey, {"targets": {"large": {"fronts": [record, blank]}}, "profiles": [[band], []]})
    assert set(result["tiles"]) == {"drawn:one", "drawn:two", "minecraft:one"}
    full = result["tiles"]["drawn:one"][0]["faces"]
    assert len(full) == 1
    first = full[0]
    second = result["tiles"]["drawn:two"][0]["faces"][0]
    assert first[:6] == [3, 0, 8, 0, 4, 16]
    assert second[:6] == [8, 0, 15, 0, 4, 10]
    assert first[7] == second[6]
    assert first[6] == 0 and second[7] == 1
    assert second[8:10] == [0, .5]
    block = result["tiles"]["minecraft:one"][0]["faces"][0]
    assert block[0:4] == [4, .5, 15, .5]


def test_normal_angle_wraparound_and_mirrored_reference_keep_the_observed_windows_on_their_side():
    segment = face([-4, 0], [4, 0])
    segment["normal"] = [0, -1]
    band = {"kind": "entrance", "x": [.05, .3], "y": [.1, .4], "columns": 1, "rows": 1}
    survey = {"targets": [{"id": "block", "segments": [segment]}]}
    evidence = {"profiles": [[band]], "targets": {"block": {"fronts": [{
        "azimuth": 356, "tolerance": 6, "profile": 0, "a": [-4, 0], "b": [4, 0], "low": 2, "high": 20
    }]}}}
    result = compile_catalog(survey, evidence)
    row = result["tiles"]["drawn:one"][0]["faces"][0]
    assert row[:4] == [4, 0, -4, 0]
    assert result["profiles"][row[-1]][0]["x"] == [.7, .95]


def test_stepped_native_front_accepts_the_nearest_cardinal_axis_only_with_local_photo_support():
    diagonal = {"azimuth": 45, "tolerance": 4, "profile": 0,
                "a": [8, 8], "b": [0, 0], "low": 3, "high": 9}
    window = {"kind": "window", "x": [0, 1], "y": [0, 1], "columns": 3, "rows": 2}
    close = face([4, 4], [2, 4], family="minecraft", low=3, high=9)
    close["normal"] = [0, -1]
    distant = {**close, "a": [4, 19], "b": [2, 19]}
    back = {**close, "normal": [0, 1]}
    evidence = {"profiles": [[window]], "targets": {"house": {"fronts": [diagonal]}}}
    rank = {"targets": [{"id": "house", "segments": [close, distant, back]}]}
    compiled = compile_catalog(rank, evidence)
    rows = compiled["tiles"]["minecraft:one"][0]["faces"]
    assert len(rows) == 1 and rows[0][:4] == [4, 4, 2, 4]
    del diagonal["a"], diagonal["b"]
    assert compile_catalog(rank, evidence)["tiles"] == {}
