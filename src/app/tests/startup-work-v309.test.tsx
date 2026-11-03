import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { StartupPresentation } from "../src/StartupPresentation";
import { startupWorkPresentationV309 } from "../src/startupWorkV309";

test("known work shows the real current-stage count, never elapsed-time progress", () => {
  expect(startupWorkPresentationV309({ phase: "buildings", completed: 210, total: 420 }, "de")).toEqual({
    label: "Gebäude aufbauen", counter: "210 / 420", percentage: 50,
  });
  expect(startupWorkPresentationV309({ phase: "architecture", completed: 5, total: 4 }, "en")).toEqual({
    label: "Adding architecture", counter: "4 / 4", percentage: 100,
  });
});

test("unknown totals stay visibly indeterminate until real completion", () => {
  const work = startupWorkPresentationV309({ phase: "details", completed: 271 }, "de");
  expect(work.percentage).toBeUndefined();
  expect(work.counter).toBe("271");
  const html = renderToStaticMarkup(<StartupPresentation label="City" detail={work.label} counter={work.counter} percentage={83} showBackdrop indeterminate />);
  expect(html).toContain("Stadtdetails vorbereiten");
  expect(html).toContain("is-indeterminate");
  expect(html).not.toContain("83%");
  expect(html).not.toContain('width:83%');
});

test("a completed data phase cannot remove the required-world curtain", () => {
  expect(renderToStaticMarkup(<StartupPresentation label="City" counter="5 / 5" percentage={100} showBackdrop />)).toContain("three-startup-curtain");
  expect(renderToStaticMarkup(<StartupPresentation label="City" percentage={100} showBackdrop={false} />)).toBe("");
  expect(startupWorkPresentationV309({ phase: "sources", completed: Number.NaN, total: Number.POSITIVE_INFINITY }, "en").percentage).toBeUndefined();
});
