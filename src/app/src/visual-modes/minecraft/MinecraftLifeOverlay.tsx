import { useEffect, useRef, useSyncExternalStore } from "react";

import { MinecraftLifecycleController } from "./lifecycle";
import type { SpawnCategory } from "./spawns";
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

/**
 * Renders whatever the single Minecraft lifecycle controller says exists.
 * Outside Minecraft mode (phase "hidden") this renders nothing at all —
 * no wrapper node, no sprites, no timers.
 */
export function MinecraftLifeOverlay({
  active,
  resetToken,
  zoomBucket,
}: MinecraftLifeOverlayProps) {
  const controllerRef = useRef<MinecraftLifecycleController | null>(null);
  controllerRef.current ??= new MinecraftLifecycleController();
  const controller = controllerRef.current;

  useEffect(() => () => controller.dispose(), [controller]);

  useEffect(() => {
    controller.setEnvironment({
      dayOfWeek: new Date().getDay(),
      devicePixelRatio: window.devicePixelRatio,
      zoomBucket,
    });
  }, [controller, zoomBucket]);

  const seenResetTokenRef = useRef(resetToken);
  useEffect(() => {
    if (seenResetTokenRef.current === resetToken) {
      return;
    }
    seenResetTokenRef.current = resetToken;
    controller.resetSchedule();
  }, [controller, resetToken]);

  useEffect(() => {
    controller.setMode(active ? "minecraft" : "day");
  }, [active, controller]);

  const state = useSyncExternalStore(controller.subscribe, controller.getState);

  if (state.phase === "hidden") {
    return null;
  }

  const locale = document.documentElement.lang.startsWith("en") ? "en" : "de";
  return (
    <div
      className={`minecraft-life minecraft-life--${state.phase}`}
      aria-hidden="true"
    >
      {state.spawns.map((spawn) => (
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
      {state.announcedCategory ? (
        <div className="minecraft-toast">
          {SPAWN_MESSAGES[locale][state.announcedCategory]}
        </div>
      ) : null}
    </div>
  );
}
