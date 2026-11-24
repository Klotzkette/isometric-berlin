import { DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { createMeasuredPlaceGeometry, type SurveyMeshPacket } from "./measuredPlaceGeometryV381";
import { freezeStaticSceneTransforms } from "./staticSceneTransforms";

export function platzModelGroupV383(name: string, native: boolean, packets: ReadonlyArray<SurveyMeshPacket>): Group {
  const root = new Group();
  root.name = name;
  const night = new MeshStandardMaterial({ vertexColors: true, side: DoubleSide, roughness: 0.95, flatShading: true });
  const day = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  for (const packet of packets) {
    const mesh = new Mesh(createMeasuredPlaceGeometry(packet), day);
    mesh.name = name;
    mesh.position.fromArray(packet.origin);
    mesh.scale.setScalar(0.01);
    mesh.userData = { dayMaterial: day, nightMaterial: night, keepInMinecraft: native, nativeMinecraft: native };
    root.add(mesh);
  }
  root.userData = { nativeMinecraft: native, keepInMinecraft: native };
  return freezeStaticSceneTransforms(root);
}
