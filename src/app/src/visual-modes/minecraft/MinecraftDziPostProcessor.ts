import { CRISPNESS_PROFILES } from "../../crispnessProfile";
import postprocessFragment from "./postprocess.frag?raw";
import shimmerFragment from "./shimmer.frag?raw";
import { createPaletteLutData } from "./palette";
import { voxelBaseCell, voxelCellForScale, voxelGridOffset } from "./voxelGrid";

/**
 * Returns the on-screen position, in CSS pixels relative to the viewer
 * host, of a fixed map-content point, plus the current map zoom relative
 * to the furthest-out zoom (`scale`, 1 at min zoom). The post-processor
 * turns the position into the world-anchored voxel grid offset and uses
 * the scale to size blocks in world units, so blocks stay glued to the map
 * while the user pans AND zooms (requirement #6).
 */
export type ContentAnchorReader = () => {
  x: number;
  y: number;
  scale?: number;
} | null;

const CANVAS_VERTEX_SHADER = `
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("WebGL shader allocation failed");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) ?? "unknown shader error";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext): WebGLProgram {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, CANVAS_VERTEX_SHADER);
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    postprocessFragment.replace("/*__SHIMMER__*/", shimmerFragment),
  );
  const program = gl.createProgram();
  if (!program) {
    throw new Error("WebGL program allocation failed");
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) ?? "unknown link error";
    gl.deleteProgram(program);
    throw new Error(message);
  }
  return program;
}

function texture(
  gl: WebGLRenderingContext,
  unit: number,
  width?: number,
  height?: number,
  data?: Uint8Array,
): WebGLTexture {
  const result = gl.createTexture();
  if (!result) {
    throw new Error("WebGL texture allocation failed");
  }
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, result);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (width && height && data) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      data,
    );
  }
  return result;
}

export class MinecraftDziPostProcessor {
  private readonly canvas = document.createElement("canvas");
  private readonly gl: WebGLRenderingContext;
  private readonly host: HTMLElement;
  private readonly lutTexture: WebGLTexture;
  private readonly program: WebGLProgram;
  private readonly resizeObserver: ResizeObserver;
  private readonly sourceTexture: WebGLTexture;
  private readonly readAnchor: ContentAnchorReader | null;
  private ditherStrength = 0;
  private frame = 0;
  private lastDrawnAt = Number.NEGATIVE_INFINITY;
  private stopped = false;

  constructor(host: HTMLElement, readAnchor?: ContentAnchorReader) {
    this.host = host;
    this.readAnchor = readAnchor ?? null;
    this.canvas.className = "minecraft-dzi-filter";
    const gl = this.canvas.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error("WebGL post-processing is unavailable");
    }
    this.gl = gl;
    this.program = createProgram(gl);
    gl.useProgram(this.program);

    const buffer = gl.createBuffer();
    if (!buffer) {
      throw new Error("WebGL buffer allocation failed");
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const position = gl.getAttribLocation(this.program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    this.sourceTexture = texture(gl, 0);
    this.lutTexture = texture(gl, 1, 256, 16, createPaletteLutData());
    gl.uniform1i(gl.getUniformLocation(this.program, "tDiffuse"), 0);
    gl.uniform1i(gl.getUniformLocation(this.program, "paletteLut"), 1);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    const canvasLayer = host.querySelector<HTMLElement>(".openseadragon-canvas");
    const sourceCanvas = canvasLayer?.querySelector<HTMLCanvasElement>(
      "canvas:not(.minecraft-dzi-filter)",
    );
    if (canvasLayer && sourceCanvas) {
      canvasLayer.insertBefore(this.canvas, sourceCanvas.nextSibling);
    } else {
      host.append(this.canvas);
    }
    this.resize();
    this.frame = window.requestAnimationFrame(this.draw);
  }

  static attach(
    host: HTMLElement,
    readAnchor?: ContentAnchorReader,
  ): MinecraftDziPostProcessor | null {
    try {
      return new MinecraftDziPostProcessor(host, readAnchor);
    } catch {
      host.classList.add("minecraft-dzi-fallback");
      return null;
    }
  }

  /**
   * Ordered dithering is off by default (hard palette snap). The app
   * raises this to 1 only at the deepest zoom, where dithering avoids
   * banding on large flat block faces.
   */
  setDitherStrength(value: number): void {
    this.ditherStrength = Math.min(1, Math.max(0, value));
  }

  dispose(): void {
    this.host.classList.remove("minecraft-dzi-fallback");
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    window.cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.canvas.remove();
    this.gl.deleteTexture(this.sourceTexture);
    this.gl.deleteTexture(this.lutTexture);
    this.gl.deleteProgram(this.program);
  }

  private readonly draw = (timestamp: number): void => {
    if (this.stopped) {
      return;
    }
    this.frame = window.requestAnimationFrame(this.draw);
    if (timestamp - this.lastDrawnAt < 1000 / 30) {
      return;
    }
    const source = this.host.querySelector<HTMLCanvasElement>(
      ".openseadragon-canvas canvas:not(.minecraft-dzi-filter)",
    );
    if (!source || source.width < 1 || source.height < 1) {
      return;
    }
    const gl = this.gl;
    try {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.sourceTexture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        source,
      );
    } catch {
      this.dispose();
      this.host.classList.add("minecraft-dzi-fallback");
      return;
    }
    gl.useProgram(this.program);
    gl.uniform2f(
      gl.getUniformLocation(this.program, "resolution"),
      this.canvas.width,
      this.canvas.height,
    );
    const anchor = this.readAnchor?.() ?? null;
    const base = voxelBaseCell(this.host.clientWidth < 769);
    // Grow the block with the zoom so it stays a fixed world size: this is
    // what keeps blocks locked to the geometry under zoom, not just pan.
    const blockSize = voxelCellForScale(base, anchor?.scale ?? 1);
    gl.uniform1f(gl.getUniformLocation(this.program, "pixelScale"), blockSize);
    const [offsetX, offsetY] = this.gridOffset(anchor, blockSize);
    gl.uniform2f(
      gl.getUniformLocation(this.program, "gridOffset"),
      offsetX,
      offsetY,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "ditherStrength"),
      this.ditherStrength,
    );
    gl.uniform1f(
      gl.getUniformLocation(this.program, "edgeMix"),
      CRISPNESS_PROFILES.minecraft.edgeStrength,
    );
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.lastDrawnAt = timestamp;
  };

  private gridOffset(
    anchor: { x: number; y: number } | null,
    blockSize: number,
  ): readonly [number, number] {
    if (!anchor) {
      return [0, 0];
    }
    const width = this.host.clientWidth || this.canvas.width;
    const height = this.host.clientHeight || this.canvas.height;
    const ratioX = this.canvas.width / Math.max(1, width);
    const ratioY = this.canvas.height / Math.max(1, height);
    // The shader samples the upload-flipped source, so its y origin is at
    // the bottom of the canvas while OpenSeadragon reports y downward from
    // the top — flip it here so a vertical pan shifts the grid the right way.
    const pixelX = anchor.x * ratioX;
    const pixelY = this.canvas.height - anchor.y * ratioY;
    return voxelGridOffset(pixelX, pixelY, blockSize);
  }

  private resize(): void {
    const { width, height } = this.host.getBoundingClientRect();
    if (width < 1 || height < 1) {
      return;
    }
    const resolutionCap = 1600 / Math.max(width, height);
    const ratio = Math.min(window.devicePixelRatio, 1.5, resolutionCap);
    this.canvas.width = Math.max(1, Math.round(width * ratio));
    this.canvas.height = Math.max(1, Math.round(height * ratio));
  }
}
