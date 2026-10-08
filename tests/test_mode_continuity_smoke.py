"""Camera seeding must wait for the real App startup focus, without retries."""

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from smoke_mode_continuity import PROBE, wait_ready  # noqa: E402


def test_probe_distinguishes_runtime_ready_from_committed_startup_focus() -> None:
  harness = """
globalThis.window = {};
globalThis.setInterval = () => 0;
let presented = false;
const focus = {current:false}, family = {current:'mobile-drawn-0'};
// A boolean/map pair alone is not sufficient to identify the correct ref.
const refs = [{current:true},{current:new Map()},{current:null},{current:null},
  {current:'unrelated'},focus,{current:new Map()},{current:null},{current:null},family];
let hooks = null;
for (const ref of refs.toReversed()) hooks = {memoizedState:ref,next:hooks};
const app = {__reactFiberTest:{memoizedState:hooks,return:null}};
const vector = {toArray:()=>[1,2,3]};
const runtime = {camera:{position:vector,fov:39,near:.25},scene:{},
  controls:{target:vector},landmarkByName:new Map([['Reichstag',{}]]),
  presentationReady:true,lightingMode:'flood',pedestrian:{enabled:false,requested:false}};
const viewer = {__reactFiberTest:{memoizedState:{memoizedState:{current:runtime}},return:null}};
globalThis.document = {querySelector:selector=>selector==='.app-shell'?app:
  selector==='.three-viewer.is-active'?viewer:presented?viewer:null};
"""
  scenario = """
const states = [window.__readModeContinuity()];
presented = true;
states.push(window.__readModeContinuity());
focus.current = true;
states.push(window.__readModeContinuity());
family.current = 'mobile-voxel-1';
states.push(window.__readModeContinuity());
family.current = 'unknown-future-layout';
states.push(window.__readModeContinuity());
console.log(JSON.stringify(states));
"""
  result = subprocess.run(
    ["bun", "-e", harness + PROBE + scenario],
    text=True,
    capture_output=True,
    check=True,
  )
  states = json.loads(result.stdout)
  assert all(state["ready"] for state in states)
  assert [state["presented"] for state in states] == [False, True, True, True, True]
  assert [state["initialFocusApplied"] for state in states] == [
    False,
    False,
    True,
    True,
    False,
  ]
  assert len({state["runtime"] for state in states}) == 1
  assert all(state["position"] == [1, 2, 3] for state in states)


def test_ready_gate_requires_both_focus_and_presentation_without_reseeding() -> None:
  class HiddenChooser:
    def is_visible(self) -> bool:
      return False

  class Page:
    def __init__(self) -> None:
      self.predicates = []
      self.observations = []
      self.delays = []

    def locator(self, selector: str) -> HiddenChooser:
      assert selector == ".startup-mode-selection"
      return HiddenChooser()

    def wait_for_function(self, expression: str, **_kwargs: object) -> None:
      self.predicates.append(expression)

    def wait_for_timeout(self, milliseconds: int) -> None:
      self.delays.append(milliseconds)

    def evaluate(self, expression: str) -> dict:
      self.observations.append(expression)
      return {
        "mode": "flood",
        "ready": True,
        "initialFocusApplied": True,
        "presented": True,
      }

  page = Page()
  state = wait_ready(page, "flood", 30)
  assert state["initialFocusApplied"]
  assert "r.ready && r.presented && r.initialFocusApplied" in page.predicates[1]
  assert page.delays == [650]  # No increased sleep conceals the ordering bug.
  assert page.observations == ["window.__readModeContinuity()"]
