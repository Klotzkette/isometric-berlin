export const COMPACT_LAYOUT_MAX_WIDTH_PX = 1024;
export const COMPACT_LAYOUT_MEDIA_QUERY =
  `(max-width: ${COMPACT_LAYOUT_MAX_WIDTH_PX}px)`;

type ResponsiveEventTarget = {
  addEventListener(type: string, listener: EventListener): void;
  removeEventListener(type: string, listener: EventListener): void;
};

type CompactMediaQuery = ResponsiveEventTarget & {
  readonly matches: boolean;
};

export function compactLayoutForWidth(width: number): boolean {
  return width <= COMPACT_LAYOUT_MAX_WIDTH_PX;
}

/**
 * Compact viewers always start with their direct-manipulation controls
 * visible. A desktop hide preference must not strand a returning phone user
 * without the flight joystick.
 */
export function chromeHiddenForLayout(
  requestedHidden: boolean,
  compact: boolean,
): boolean {
  return compact ? false : requestedHidden;
}

export function shouldPersistChromePreference(compact: boolean): boolean {
  return !compact;
}

/**
 * Keep React chrome aligned with the CSS breakpoint after rotation, browser
 * zoom and iPad Split View changes. visualViewport is an iOS fallback for
 * Safari versions that update the viewport before dispatching media changes.
 */
export function observeCompactLayout(
  mediaQuery: CompactMediaQuery,
  onChange: (compact: boolean) => void,
  visualViewport: ResponsiveEventTarget | null = null,
): () => void {
  const sync = () => onChange(mediaQuery.matches);
  const listener: EventListener = () => sync();
  mediaQuery.addEventListener("change", listener);
  visualViewport?.addEventListener("resize", listener);
  sync();
  return () => {
    mediaQuery.removeEventListener("change", listener);
    visualViewport?.removeEventListener("resize", listener);
  };
}
