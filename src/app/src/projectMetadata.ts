import packageMetadata from "../package.json";

export const PROJECT_VERSION = `v${packageMetadata.version}`;
export const REPOSITORY_URL = "https://github.com/Klotzkette/isometric-berlin";
export const DOWNLOAD_URL =
  `${REPOSITORY_URL}/releases/latest/download/` +
  "isometric-berlin-regierungsviertel-local.zip";
