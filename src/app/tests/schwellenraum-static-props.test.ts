import { describe, expect, test } from "bun:test";
import { Group, Mesh } from "three";

import streetDetails from "../public/mesh/regierungsviertel/street-details.json";
import type { StreetDetailsPayload } from "../src/TrafficSignals";
import { createSchwellenraumMemorialProtectionIndex } from "../src/schwellenraumMemorialProtection";
import {
  SCHWELLENRAUM_STATIC_VIGNETTES,
  createSchwellenraumStaticPropCollision,
  installSchwellenraumStaticProps,
  schwellenraumStaticPropSolidAt,
} from "../src/visual-modes/schwellenraum/staticProps";
import { abstandZumNaechstenSchutzraum } from "../src/visual-modes/schwellenraum/presentation";

const street = streetDetails as unknown as StreetDetailsPayload;
const groundAt = () => 4.2;

describe("Schwellenraum fixed solid props", () => {
  test("installs a restrained but stranger furniture and appliance inventory", () => {
    const root = new Group();
    expect(SCHWELLENRAUM_STATIC_VIGNETTES).toHaveLength(6);
    expect(installSchwellenraumStaticProps(root, groundAt)).toBe(12);
    expect(installSchwellenraumStaticProps(root, groundAt)).toBe(0);
    expect(root.children).toHaveLength(6);
    expect(root.userData.schwellenraumStaticPropCount).toBe(12);

    const kinds = new Set(
      SCHWELLENRAUM_STATIC_VIGNETTES.flatMap((vignette) =>
        vignette.props.map((prop) => prop.kind),
      ),
    );
    expect(kinds).toContain("sofa");
    expect(kinds).toContain("chair");
    expect(kinds).toContain("refrigerator");
    expect(kinds).toContain("washing-machine");
    expect(kinds).toContain("bed");
    expect(kinds).toContain("television");
    expect(kinds).toContain("wardrobe");
    let renderables = 0;
    root.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      renderables += 1;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      expect(materials.every((entry) => entry.map === null)).toBeTrue();
    });
    expect(renderables).toBe(38);
    for (const vignette of root.children) {
      expect(vignette.userData.schwellenraumPraesentation).toBeTrue();
      expect(vignette.userData.schwellenraumStatic).toBeTrue();
      expect(vignette.userData.schutzradiusM).toBeGreaterThan(0);
    }
    for (const vignette of SCHWELLENRAUM_STATIC_VIGNETTES) {
      expect(
        abstandZumNaechstenSchutzraum(vignette.x, vignette.z),
        vignette.id,
      ).toBeGreaterThan(35);
    }
  });

  test("blocks pedestrian and flight bodies at every authored prop", () => {
    const solidAt = createSchwellenraumStaticPropCollision(groundAt);
    for (const vignette of SCHWELLENRAUM_STATIC_VIGNETTES) {
      const cosine = Math.cos(vignette.rotationY);
      const sine = Math.sin(vignette.rotationY);
      for (const prop of vignette.props) {
        const x = vignette.x + cosine * prop.localX + sine * prop.localZ;
        const z = vignette.z - sine * prop.localX + cosine * prop.localZ;
        expect(
          solidAt(x, 4.2 + prop.sizeM[1] / 2, z, 0.1),
          `${vignette.id}/${prop.id}`,
        ).toBeTrue();
      }
    }
    expect(
      schwellenraumStaticPropSolidAt(0, 5, 0, 0.2, groundAt),
    ).toBeFalse();
  });

  test("removes both visible and collision presence from a future protected source site", () => {
    const first = SCHWELLENRAUM_STATIC_VIGNETTES[0];
    const protectedEntry = street.monuments!.find(
      (entry) => entry.schwellenraum_protected,
    )!;
    const protection = createSchwellenraumMemorialProtectionIndex([
      {
        ...protectedEntry,
        osm_id: "future-protected-prop-site",
        osm_key: "node/future-protected-prop-site",
        x_dm: Math.round(first.x * 10),
        z_dm: Math.round(first.z * 10),
      },
    ]);
    const prop = first.props[0];
    const cosine = Math.cos(first.rotationY);
    const sine = Math.sin(first.rotationY);
    const x = first.x + cosine * prop.localX + sine * prop.localZ;
    const z = first.z - sine * prop.localX + cosine * prop.localZ;
    expect(
      schwellenraumStaticPropSolidAt(
        x,
        4.2 + prop.sizeM[1] / 2,
        z,
        0.1,
        groundAt,
        protection,
      ),
    ).toBeFalse();
  });
});
