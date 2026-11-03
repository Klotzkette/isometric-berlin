import { expect, test } from "bun:test";
import { Group, MeshBasicMaterial } from "three";
import { hasSchwellenraumMaterialProvenance, schwellenraumMaterialFor } from "../src/visual-modes/schwellenraum/materialGrade";

test("real cached atmospheric variants retain private provenance without changing public cache behaviour", () => {
  const object = new Group(), day = new MeshBasicMaterial({ color: 0x81776b });
  const grade = schwellenraumMaterialFor(object, day);
  expect(schwellenraumMaterialFor(object, day)).toBe(grade);
  expect(hasSchwellenraumMaterialProvenance(object, day, grade)).toBeTrue();
  const clone = grade.clone(), foreignDay = day.clone();
  expect(hasSchwellenraumMaterialProvenance(object, day, clone)).toBeFalse();
  expect(hasSchwellenraumMaterialProvenance(object, foreignDay, grade)).toBeFalse();
  const forged = new Group(); forged.userData.schwellenraumMaterial = grade;
  expect(schwellenraumMaterialFor(forged, day)).toBe(grade);
  expect(hasSchwellenraumMaterialProvenance(forged, day, grade)).toBeFalse();
  grade.dispose(); expect(hasSchwellenraumMaterialProvenance(object, day, grade)).toBeFalse();
  day.dispose(); clone.dispose(); foreignDay.dispose();
});

test("disposing the real day owner invalidates its late material receipt", () => {
  const object = new Group(), day = new MeshBasicMaterial(), grade = schwellenraumMaterialFor(object, day);
  day.dispose(); expect(hasSchwellenraumMaterialProvenance(object, day, grade)).toBeFalse(); grade.dispose();
});
