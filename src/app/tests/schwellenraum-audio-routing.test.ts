import { describe, expect, test } from "bun:test";

import { UI_COPY } from "../src/localization";

const appSource = await Bun.file(
  new URL("../src/App.tsx", import.meta.url),
).text();

describe("Schwellenraum audio routing", () => {
  test("uses the dedicated procedural layer instead of either standard engine", () => {
    expect(appSource).toContain("new SchwellenraumSoundscape()");
    expect(appSource).toContain(
      'lightingModeRef.current === "schwellenraum"',
    );
    expect(appSource).toContain(
      "schwellenraumSoundscapeRef.current?.setSuspended(false)",
    );
    expect(appSource).toContain(
      "ambientSoundscapeRef.current?.setSuspended(true)",
    );
    expect(appSource).toContain("chiptuneRef.current?.setSuspended(true)");
  });

  test("crossfades on mode entry and restores standard intent on exit", () => {
    expect(appSource).toContain(
      "started ? SCHWELLENRAUM_ENTER_FADE_SECONDS : 0",
    );
    expect(appSource).toContain("fadeToSuspended(fadeSeconds)");
    expect(appSource).toContain("startSchwellenraumAudio(mix, { silent: true })");
    expect(appSource).toContain("schwellenraumSoundscapeRef.current?.stop()");
    expect(appSource).toContain("resumeStandardAudio();");
    expect(appSource).toContain("ambientStartAttemptRef.current += 1;");
    expect(appSource).toContain("chiptuneStartAttemptRef.current += 1;");
    expect(appSource).toContain(
      "attempt !== ambientStartAttemptRef.current ||\n        modeChangedToSchwellenraum",
    );
    expect(appSource).toContain(
      "attempt !== chiptuneStartAttemptRef.current ||\n        modeChangedToSchwellenraum",
    );
    expect(
      appSource.match(/const modeChangedToSchwellenraum =/g),
    ).toHaveLength(2);
  });

  test("routes the two existing toggles to independent quiet buses", () => {
    expect(appSource).toContain(
      "{ ...schwellenraumMixRef.current, room: true }",
    );
    expect(appSource).toContain(
      "{ ...schwellenraumMixRef.current, score: true }",
    );
    expect(appSource).toContain("room: false");
    expect(appSource).toContain("score: false");
    expect(appSource).toContain("soundscape?.currentMix");
  });

  test("keeps first-gesture and visible retries mode-exclusive", () => {
    expect(appSource).toContain(
      'lightingModeRef.current !== "schwellenraum" &&\n        !isMusicMutedByUser()',
    );
    expect(appSource).toContain(
      'lightingModeRef.current !== "schwellenraum" ||\n          (!mix.room && !mix.score)',
    );
    expect(appSource).toContain("registerVisibleAutoplayRetry({");
    expect(appSource).toContain("registerFirstGestureStart({");
  });

  test("keeps the weather preference but renders a completely still mode", () => {
    expect(appSource).toContain(
      'const schwellenraumMode = lightingMode === "schwellenraum"',
    );
    expect(appSource).toContain("disabled={schwellenraumMode}");
    expect(appSource).toContain("copy.schwellenraumWeatherStatic");
    expect(appSource).toContain(
      "const precipitationEnabled = schwellenraumMode\n    ? false",
    );
  });

  test("uses calm mode-specific labels in both interface languages", () => {
    expect(UI_COPY.de.schwellenraumSound).toBe("Schwellenraum-Klang");
    expect(UI_COPY.en.schwellenraumSound).toBe("Schwellenraum sound");
    expect(UI_COPY.de.schwellenraumRoomOn).toContain("Raumrauschen");
    expect(UI_COPY.de.schwellenraumScoreOn).toContain("Schwellenraum");
    expect(UI_COPY.de.schwellenraumWeatherStatic).toContain("still");
    expect(UI_COPY.en.schwellenraumWeatherStatic).toContain("still");
  });
});
