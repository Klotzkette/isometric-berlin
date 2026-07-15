import { describe, expect, test } from "bun:test";

import packageMetadata from "../package.json";
import {
  DOWNLOAD_URL,
  PROJECT_VERSION,
  REPOSITORY_URL,
} from "../src/projectMetadata";

describe("public project metadata", () => {
  test("exposes the complete public repository and stable download URLs", () => {
    expect(REPOSITORY_URL).toBe(
      "https://github.com/Klotzkette/isometric-berlin",
    );
    expect(DOWNLOAD_URL).toBe(
      "https://github.com/Klotzkette/isometric-berlin/releases/latest/download/isometric-berlin-regierungsviertel-local.zip",
    );
  });

  test("derives the visible version from package metadata", () => {
    expect(PROJECT_VERSION).toBe(`v${packageMetadata.version}`);
  });
});
