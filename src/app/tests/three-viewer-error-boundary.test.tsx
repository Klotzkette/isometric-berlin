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
    detail: "The page may have changed.",
    message: "The 3D view could not be loaded.",
    reloadLabel: "Reload page",
    onReload: () => undefined,
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
    expect(markup).not.toContain("2D");
    expect(stylesSource).toMatch(
      /\.three-viewer-error\s*\{[\s\S]*?z-index:\s*30;/,
    );
    expect(stylesSource).toMatch(
      /\.mobile-sheet\s*\{[\s\S]*?z-index:\s*26;/,
    );
  });

  test("retries the isometric view without offering a different renderer", () => {
    let reloads = 0;
    const fallback = ThreeViewerLoadErrorFallback({
      ...boundaryProps(),
      onReload: () => { reloads += 1; },
    });
    const buttons = elementsIn(fallback).filter(
      (element) => element.type === "button",
    );
    expect(buttons).toHaveLength(1);
    (buttons[0]?.props as { onClick: () => void }).onClick();
    expect(reloads).toBe(1);
  });
});
