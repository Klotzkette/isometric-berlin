import { describe, expect, test } from "bun:test";
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  ThreeViewerErrorBoundary,
  ThreeViewerLoadErrorFallback,
} from "../src/ThreeViewerErrorBoundary";

const stylesSource = await Bun.file(
  new URL("../src/styles.css", import.meta.url),
).text();

function elementsIn(node: ReactNode): ReactElement[] {
  if (Array.isArray(node)) {
    return node.flatMap(elementsIn);
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) {
    return [];
  }
  return [node, ...elementsIn(node.props.children)];
}

function boundaryProps() {
  return {
    active: true,
    detail: "The page may have changed.",
    mapLabel: "Open 2D map",
    message: "The 3D view could not be loaded.",
    reloadLabel: "Reload page",
    onReload: () => undefined,
    onUseMap: () => undefined,
  };
}

describe("ThreeViewerErrorBoundary", () => {
  test("keeps successful children untouched and enters failure state", () => {
    const child = <span>3D ready</span>;
    const boundary = new ThreeViewerErrorBoundary({
      ...boundaryProps(),
      children: child,
    });

    expect(boundary.render()).toBe(child);
    expect(ThreeViewerErrorBoundary.getDerivedStateFromError()).toEqual({
      failed: true,
    });
  });

  test("renders an accessible, localized recovery panel", () => {
    const markup = renderToStaticMarkup(
      <ThreeViewerLoadErrorFallback {...boundaryProps()} />,
    );

    expect(markup).toContain('role="alert"');
    expect(markup).toContain("The 3D view could not be loaded.");
    expect(markup).toContain(">Reload page</button>");
    expect(markup).toContain(">Open 2D map</button>");
    expect(stylesSource).toMatch(
      /\.three-viewer-error\s*\{[\s\S]*?z-index:\s*30;/,
    );
    expect(stylesSource).toMatch(
      /\.mobile-sheet\s*\{[\s\S]*?z-index:\s*26;/,
    );
  });

  test("keeps an inactive warm-viewer failure out of the tab order", () => {
    const fallback = ThreeViewerLoadErrorFallback({
      ...boundaryProps(),
      active: false,
    });
    const markup = renderToStaticMarkup(fallback);
    const buttons = elementsIn(fallback).filter(
      (element) => element.type === "button",
    );

    expect(markup).toContain('aria-hidden="true"');
    expect(markup).not.toContain('role="alert"');
    expect(buttons).toHaveLength(0);
  });

  test("wires reload retry and the safe 2D fallback as separate actions", () => {
    let reloads = 0;
    let mapFallbacks = 0;
    const fallback = ThreeViewerLoadErrorFallback({
      ...boundaryProps(),
      onReload: () => {
        reloads += 1;
      },
      onUseMap: () => {
        mapFallbacks += 1;
      },
    });
    const buttons = elementsIn(fallback).filter(
      (element) => element.type === "button",
    );

    expect(buttons).toHaveLength(2);
    (buttons[0]?.props as { onClick: () => void }).onClick();
    (buttons[1]?.props as { onClick: () => void }).onClick();

    expect(reloads).toBe(1);
    expect(mapFallbacks).toBe(1);
  });
});
