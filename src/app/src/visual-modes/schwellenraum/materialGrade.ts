import {
  Color,
  Material,
  type MeshStandardMaterial,
  type Object3D,
  type WebGLRenderer,
} from "three";

import type { VisualMode } from "../../visualMode";

export const SCHWELLENRAUM_MATERIAL_GRADE = {
  saturation: 0.32,
  shadowLift: [0.04, 0.018, 0.055] as const,
  strength: 0.82,
  tint: [0.96, 0.89, 1.02] as const,
} as const;

type PatchableShader = {
  fragmentShader: string;
};

function gradeFragmentShader(source: string): string {
  const { saturation, shadowLift, strength, tint } =
    SCHWELLENRAUM_MATERIAL_GRADE;
  return source.replace(
    "#include <opaque_fragment>",
    `float schwellenraumLuma = dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) );
    vec3 schwellenraumMuted = mix( vec3( schwellenraumLuma ), outgoingLight, ${saturation.toFixed(2)} );
    vec3 schwellenraumTinted = schwellenraumMuted * vec3( ${tint.map((value) => value.toFixed(2)).join(", ")} );
    float schwellenraumShadow = 1.0 - smoothstep( 0.15, 0.72, schwellenraumLuma );
    schwellenraumTinted += vec3( ${shadowLift.map((value) => value.toFixed(3)).join(", ")} ) * schwellenraumShadow;
    outgoingLight = clamp( mix( outgoingLight, schwellenraumTinted, ${strength.toFixed(2)} ), 0.0, 1.0 );
    #include <opaque_fragment>`,
  );
}

/**
 * Build one lazily cached material variant for the atmospheric mode.
 *
 * The grade is part of each existing material shader, so it adds no scene
 * traversal per frame, render target, full-screen pass or draw call. Flat
 * source colours remain flat; only their saturation and temperature change.
 */
export function schwellenraumMaterialFor(
  object: Object3D,
  dayMaterial: Material,
): Material {
  const cached = object.userData.schwellenraumMaterial;
  if (cached instanceof Material) return cached;

  const material = dayMaterial.clone();
  material.name = `${dayMaterial.name || dayMaterial.type} Schwellenraum grade`;
  material.userData.schwellenraumMaterialGrade = true;
  const previousOnBeforeCompile = material.onBeforeCompile.bind(material);
  const previousProgramCacheKey = material.customProgramCacheKey();
  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile(shader, renderer as WebGLRenderer);
    const patchable = shader as unknown as PatchableShader;
    patchable.fragmentShader = gradeFragmentShader(patchable.fragmentShader);
  };
  material.customProgramCacheKey = () =>
    `${previousProgramCacheKey}|schwellenraum-material-grade-v1`;
  material.needsUpdate = true;
  object.userData.schwellenraumMaterial = material;
  return material;
}

/** A matching no-recompile tint for ordinary lit authored materials. */
export function setSchwellenraumStandardMaterialTone(
  material: MeshStandardMaterial,
  mode: VisualMode,
): void {
  if (material.userData.schwellenraumMaterialGrade === true) return;
  const stored = material.userData.schwellenraumDayColor;
  if (mode !== "schwellenraum") {
    if (
      material.userData.schwellenraumToneActive === true &&
      typeof stored === "number"
    ) {
      material.color.setHex(stored);
      material.userData.schwellenraumToneActive = false;
    }
    return;
  }

  const dayColor = typeof stored === "number" ? stored : material.color.getHex();
  material.userData.schwellenraumDayColor = dayColor;
  const source = new Color(dayColor);
  const luma = source.r * 0.2126 + source.g * 0.7152 + source.b * 0.0722;
  const muted = new Color(luma, luma, luma).lerp(
    source,
    SCHWELLENRAUM_MATERIAL_GRADE.saturation,
  );
  muted.multiply(
    new Color().setRGB(...SCHWELLENRAUM_MATERIAL_GRADE.tint),
  );
  const shadowRamp = Math.min(
    1,
    Math.max(0, (luma - 0.15) / (0.72 - 0.15)),
  );
  const shadow = 1 - shadowRamp * shadowRamp * (3 - 2 * shadowRamp);
  muted.add(
    new Color()
      .setRGB(...SCHWELLENRAUM_MATERIAL_GRADE.shadowLift)
      .multiplyScalar(shadow),
  );
  const graded = source.lerp(muted, SCHWELLENRAUM_MATERIAL_GRADE.strength);
  material.color.setRGB(
    Math.min(1, Math.max(0, graded.r)),
    Math.min(1, Math.max(0, graded.g)),
    Math.min(1, Math.max(0, graded.b)),
  );
  material.userData.schwellenraumToneActive = true;
}

export const schwellenraumGradeFragmentShaderForTest = gradeFragmentShader;
