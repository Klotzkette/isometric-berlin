import {
  forwardRef,
  type CSSProperties,
  type ReactElement,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

import type { PedestrianPose } from "./ThreeViewer";
import type { Language } from "./localization";
import {
  miniMapCardinalRotationDegrees,
  miniMapHeadingRotationDegrees,
  worldToReferenceMapPoint,
} from "./pedestrianMiniMapProjection";
import { normalizeRotation, rotationDistance } from "./viewerGestures";

export type PedestrianMiniMapOrientation = {
  degrees: number;
  label: string;
  short: string;
};

type PedestrianMiniMapProps = {
  imageUrl: string;
  initialPose?: PedestrianPose | null;
  language: Language;
  northUpRotation: number;
  onOrientationChange: (degrees: number) => void;
  orientationDegrees: number;
  orientations: PedestrianMiniMapOrientation[];
};

export type PedestrianMiniMapHandle = {
  setPose: (pose: PedestrianPose | null) => void;
};

const MAP_ZOOM = 3.62;
const MAX_CANVAS_DEVICE_PIXEL_RATIO = 1.5;

function orientationGlyph(short: string, language: Language): string {
  return language === "en" && short === "O" ? "E" : short;
}

function headingLabel(headingDegrees: number, language: Language): string {
  const normalized = normalizeRotation(headingDegrees);
  const directions =
    language === "de"
      ? ["N", "NO", "O", "SO", "S", "SW", "W", "NW"]
      : ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(normalized / 45) % directions.length;
  return `${directions[index]} ${Math.round(normalized)}°`;
}

export const PedestrianMiniMap = forwardRef<
  PedestrianMiniMapHandle,
  PedestrianMiniMapProps
>(function PedestrianMiniMap(
  {
    imageUrl,
    initialPose = null,
    language,
    northUpRotation,
    onOrientationChange,
    orientationDegrees,
    orientations,
  },
  ref,
): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const [pose, setPose] = useState<PedestrianPose | null>(initialPose);

  useImperativeHandle(ref, () => ({ setPose }), []);

  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    const markReady = () => {
      if (cancelled) return;
      imageRef.current = image;
      setImageReady(true);
    };
    image.onload = markReady;
    image.src = imageUrl;
    if (image.complete && image.naturalWidth > 0) {
      markReady();
    }
    return () => {
      cancelled = true;
      imageRef.current = null;
      setImageReady(false);
    };
  }, [imageUrl]);

  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const width = canvas.clientWidth || 244;
    const height = canvas.clientHeight || 146;
    const pixelRatio = Math.min(
      window.devicePixelRatio || 1,
      MAX_CANVAS_DEVICE_PIXEL_RATIO,
    );
    const pixelWidth = Math.max(1, Math.round(width * pixelRatio));
    const pixelHeight = Math.max(1, Math.round(height * pixelRatio));
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) return;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#e8e2d3";
    context.fillRect(0, 0, width, height);
    const image = imageRef.current;
    if (!pose || !imageReady || !image || image.naturalWidth <= 0) {
      return;
    }
    const imagePoint = worldToReferenceMapPoint(pose.x, pose.z);
    const mapRotation = miniMapCardinalRotationDegrees(
      orientationDegrees,
      northUpRotation,
    );
    context.save();
    context.translate(width / 2, height / 2);
    context.rotate((mapRotation * Math.PI) / 180);
    context.scale(MAP_ZOOM, MAP_ZOOM);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "medium";
    context.drawImage(image, -imagePoint.x, -imagePoint.y);
    context.restore();
  }, [imageReady, northUpRotation, orientationDegrees, pose]);

  useEffect(() => {
    drawMap();
  }, [drawMap]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(() => drawMap());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawMap]);

  const headingRotation =
    pose === null
      ? 0
      : miniMapHeadingRotationDegrees(
          pose.headingDegrees,
          orientationDegrees,
          northUpRotation,
        );
  const headingStyle = {
    "--heading-rotation": `${headingRotation}deg`,
  } as CSSProperties;
  const label =
    pose === null
      ? language === "de"
        ? "Kartenausschnitt im Fußgängermodus wird vorbereitet"
        : "Preparing pedestrian minimap"
      : language === "de"
        ? `Kartenausschnitt im Fußgängermodus, Blick ${headingLabel(
            pose.headingDegrees,
            language,
          )}`
        : `Pedestrian minimap, facing ${headingLabel(
            pose.headingDegrees,
            language,
          )}`;

  return (
    <aside className="pedestrian-minimap" aria-label={label}>
      <div className="pedestrian-minimap__viewport" aria-hidden="true">
        <canvas className="pedestrian-minimap__canvas" ref={canvasRef} />
        {pose ? (
          <span
            className="pedestrian-minimap__heading"
            style={headingStyle}
          />
        ) : null}
        <span className="pedestrian-minimap__crosshair" />
      </div>
      <div className="pedestrian-minimap__chrome">
        <strong>
          {pose
            ? headingLabel(pose.headingDegrees, language)
            : language === "de"
              ? "Karte"
              : "Map"}
        </strong>
        {pose?.insideTunnel ? (
          <span>{language === "de" ? "Tunnel" : "Tunnel"}</span>
        ) : null}
      </div>
      <div
        className="pedestrian-minimap__orientation"
        role="group"
        aria-label={language === "de" ? "Kartenrichtung" : "Map direction"}
      >
        {orientations.map((orientation) => (
          <button
            key={orientation.short}
            type="button"
            aria-label={orientation.label}
            aria-pressed={
              rotationDistance(
                normalizeRotation(orientationDegrees),
                normalizeRotation(orientation.degrees),
              ) < 0.01
            }
            title={orientation.label}
            onClick={() => onOrientationChange(orientation.degrees)}
          >
            {orientationGlyph(orientation.short, language)}
          </button>
        ))}
      </div>
    </aside>
  );
});
