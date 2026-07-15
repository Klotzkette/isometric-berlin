import { useEffect, useMemo, useRef, useState } from "react";

import {
  type SpawnCategory,
  SPAWN_SCHEDULE,
  buildSpawnPlan,
} from "./spawns";
import { minecraftSpriteDataUri } from "./sprites";

type MinecraftLifeOverlayProps = {
  active: boolean;
  resetToken: number;
  zoomBucket: number;
};

const SPAWN_MESSAGES: Record<"de" | "en", Record<SpawnCategory, string>> = {
  de: {
    animal: "Kleine Tiere erscheinen am Tiergartenrand …",
    boat: "Boote gleiten über die Spree …",
    field: "Blockfelder wachsen am äußeren Tiergarten …",
    npc: "Winzige Berliner beleben die Wege …",
    tent: "Marktzelte erscheinen an den Vorplätzen …",
    village: "Ein kleines Dorf erscheint am Tiergarten …",
  },
  en: {
    animal: "Tiny animals appear along the Tiergarten edge …",
    boat: "Boats begin to drift along the Spree …",
    field: "Block fields grow along the outer Tiergarten …",
    npc: "Tiny Berliners begin walking the paths …",
    tent: "Market tents appear near the forecourts …",
    village: "A small village appears near the Tiergarten …",
  },
};

export function MinecraftLifeOverlay({
  active,
  resetToken,
  zoomBucket,
}: MinecraftLifeOverlayProps) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const [averageFrameMs, setAverageFrameMs] = useState(16.7);
  const [toast, setToast] = useState("");
  const announcedRef = useRef(new Set<SpawnCategory>());

  useEffect(() => {
    announcedRef.current.clear();
    setElapsedMs(0);
    setToast("");
    if (!active) {
      return;
    }
    const startedAt = performance.now();
    const timer = window.setInterval(
      () => setElapsedMs(performance.now() - startedAt),
      500,
    );
    return () => window.clearInterval(timer);
  }, [active, resetToken]);

  useEffect(() => {
    if (!active) {
      return;
    }
    let frame = 0;
    let last = performance.now();
    const samples: number[] = [];
    const profile = (timestamp: number) => {
      samples.push(timestamp - last);
      last = timestamp;
      if (samples.length >= 60) {
        setAverageFrameMs(
          samples.reduce((sum, sample) => sum + sample, 0) / samples.length,
        );
        samples.length = 0;
      }
      frame = window.requestAnimationFrame(profile);
    };
    frame = window.requestAnimationFrame(profile);
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  const plan = useMemo(
    () =>
      active
        ? buildSpawnPlan({
            averageFrameMs,
            dayOfWeek: new Date().getDay(),
            devicePixelRatio: window.devicePixelRatio,
            elapsedMs,
            zoomBucket,
          })
        : [],
    [active, averageFrameMs, elapsedMs, zoomBucket],
  );

  useEffect(() => {
    const visible = new Set(plan.map((spawn) => spawn.category));
    const next = ([
      "village",
      "tent",
      "field",
      "npc",
      "animal",
      "boat",
    ] as SpawnCategory[]).find(
      (category) =>
        visible.has(category) && !announcedRef.current.has(category),
    );
    if (!next) {
      return;
    }
    announcedRef.current.add(next);
    const locale = document.documentElement.lang.startsWith("en") ? "en" : "de";
    setToast(SPAWN_MESSAGES[locale][next]);
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [plan]);

  return (
    <div className="minecraft-life" aria-hidden="true">
      {plan.map((spawn) => (
        <img
          key={spawn.id}
          className={`minecraft-sprite minecraft-sprite--${spawn.category}`}
          src={minecraftSpriteDataUri(spawn.category, spawn.variant)}
          alt=""
          style={{
            animationDelay: `${spawn.delayMs}ms`,
            left: `${spawn.x}%`,
            top: `${spawn.y}%`,
            transform: `scale(${spawn.scale})`,
          }}
        />
      ))}
      {toast ? <div className="minecraft-toast">{toast}</div> : null}
      <span className="minecraft-dwell" data-elapsed={elapsedMs} data-schedule={SPAWN_SCHEDULE.boat} />
    </div>
  );
}
