import { isVisualMode, type VisualMode } from "./visualMode";
import type { Language } from "./localization";

/** An explicit valid link is already a choice; ordinary visits keep the chooser. */
export function directStartupMode(search: string): VisualMode | null {
  const requested = new URLSearchParams(search).get("theme");
  return isVisualMode(requested) ? requested : null;
}

/** Keep the deployment path, but don't share unrelated query or camera state. */
export function modeLinkFor(baseUrl: string, mode: VisualMode, language: Language): string {
  const url = new URL(baseUrl);
  url.search = "";
  url.hash = "";
  url.searchParams.set("theme", mode);
  url.searchParams.set("lang", language);
  return url.href;
}
