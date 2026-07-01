/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Optional base URL for the DZI pyramid (e.g. a Cloudflare R2 bucket
   * holding `dzi/regierungsviertel/`). When set, the viewer loads the DZI
   * tiles and reference map from here instead of the bundled `public/` copy.
   * Landmark navigation is bundled into the app so downloaded `file://`
   * packages do not need JSON fetches. See docs/perplexity-hosting.md.
   */
  readonly VITE_DZI_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
