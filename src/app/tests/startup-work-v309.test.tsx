import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StartupPresentation } from "../src/StartupPresentation";
import { startupWorkPresentationV309 } from "../src/startupWorkV309";

test("the bar keeps its completed portion when a new stage starts", () => {
  for (const native of [false, true]) {
    const built = startupWorkPresentationV309({ phase: "buildings", completed: 420, total: 420, native }, "de");
    const next = startupWorkPresentationV309({ phase: native ? "architecture" : "geometry", completed: 0, native }, "de");
    expect(next.percentage).toBe(built.percentage);
    expect(next.indeterminate).toBeTrue();
  }
});

test("unknown totals keep the filled track and show activity without a work counter", () => {
  const work = startupWorkPresentationV309({ phase: "details", completed: 3000 }, "de");
  const html = renderToStaticMarkup(<StartupPresentation label="City" detail={work.label} percentage={work.percentage} showBackdrop indeterminate={work.indeterminate} />);
  expect(html).toContain("Stadtdetails vorbereiten");
  expect(html).toContain('role="progressbar"');
  expect(html).toContain(`width:${work.percentage}%`);
  expect(html).toContain(`left:${work.percentage}%`);
  expect(html).not.toContain("3000");
  expect(html).not.toContain("aria-valuenow");
});

test("a completed data phase cannot remove the required-world curtain", () => {
  expect(renderToStaticMarkup(<StartupPresentation label="City" percentage={100} showBackdrop />)).toContain("three-startup-curtain");
  expect(renderToStaticMarkup(<StartupPresentation label="City" percentage={100} showBackdrop={false} />)).toBe("");
  expect(startupWorkPresentationV309({ phase: "sources", completed: Number.NaN, total: Number.POSITIVE_INFINITY }, "en").indeterminate).toBeTrue();
  expect(startupWorkPresentationV309({ phase: "presentation", completed: 1, total: 1 }, "en").percentage).toBe(99);
});
