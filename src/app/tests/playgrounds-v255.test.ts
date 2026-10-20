import { describe, expect, test } from "bun:test";
import { Group } from "three";
import source from "../src/data/playgroundsV255.json";
import { annotatePlaygroundPacketV255, playgroundSiteV255 } from "../src/playgroundsV255";

describe("finite playground packet metadata", () => {
  test("all official ranks and explicit named exceptions have independent packet owners", () => {
    expect(source.sites.filter(s => s.rank !== null).map(s => s.rank)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 1),
    );
    expect(source.sites.filter(s => s.rank === null)).toHaveLength(7);
    expect(new Set(Object.values(source.packetSites)).size).toBe(27);
    for (const [id, siteId] of Object.entries(source.packetSites)) {
      expect(playgroundSiteV255(id)?.id).toBe(siteId);
    }
  });
  test("annotation does not allocate geometry or touch unrelated packets", () => {
    const root = new Group();
    root.userData.existing = "retained";
    annotatePlaygroundPacketV255(root, "unrelated");
    expect(root.userData).toEqual({ existing: "retained" });
    const id = Object.keys(source.packetSites)[0];
    annotatePlaygroundPacketV255(root, id);
    expect(root.children).toHaveLength(0);
    expect(root.userData.existing).toBe("retained");
    expect(root.userData.playgroundV255.fullStaticDetailOnTouch).toBe(true);
    expect(root.userData.playgroundV255.unsurveyedFittingDimensions).toBe(true);
    expect(root.userData.playgroundV255.areaMeaning).toContain("not net");
  });
});
