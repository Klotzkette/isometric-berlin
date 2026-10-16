import { expect } from "bun:test";
import { Group, type Object3D } from "three";

/** The sole v221 addition; never omit a historic gallery child from an audit. */
export function nationalgalerieSculpturesV221(root: Object3D, native = false): Group {
  const galleryName = native ? "Nationalgalerie native open pavilion v183" : "Nationalgalerie open steel and glass pavilion v183";
  const name = "Nationalgalerie terrace sculptures v221" + (native ? " native" : "");
  const galleries: Object3D[] = [], additions: Object3D[] = [];
  root.traverse(object => {
    if (object.name === galleryName) galleries.push(object);
    if (object.name.startsWith("Nationalgalerie terrace sculptures v221") || object.userData.nationalgalerieSculpturesV221)
      additions.push(object);
  });
  expect(galleries).toHaveLength(1);
  expect(additions).toHaveLength(1);
  const addition = additions[0];
  expect(addition).toBeInstanceOf(Group);
  expect(addition.name).toBe(name);
  expect(addition.userData.nationalgalerieSculpturesV221).toBe(true);
  expect(addition.parent).toBe(galleries[0]);
  expect(galleries[0].children.filter(child => child === addition)).toHaveLength(1);
  return addition as Group;
}

/** Restore this exact object at its original index, including after a failed assertion. */
export function detachNationalgalerieSculpturesV221(root: Object3D, native = false): () => void {
  const addition = nationalgalerieSculpturesV221(root, native);
  const gallery = addition.parent!, index = gallery.children.indexOf(addition);
  gallery.remove(addition);
  return () => {
    gallery.add(addition);
    gallery.children.splice(gallery.children.indexOf(addition), 1);
    gallery.children.splice(index, 0, addition);
  };
}
