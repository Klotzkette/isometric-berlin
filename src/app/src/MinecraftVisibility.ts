import type { Object3D } from "three";

/** Scene roots whose smooth presentation must be filtered by voxel mode. */
export type MinecraftVisibilityRoots = {
  centralDetails: Object3D;
  cityStaffage: Object3D;
  civicDetails: Object3D;
  signatures: Object3D;
};

const FULL_SIGNATURE_ALLOWLIST = new Set([
  "drawn bridge structures",
  "Spreebogenpark landscape window",
  "Tilla-Durieux-Park lawn sculpture",
]);

const ANIMATED_STATE_FLAG_SIGNATURES = new Set([
  "Metre-scale Federal Chancellery recognition model",
  "Metre-scale Reichstag recognition model",
]);

const AMTSSITZ_ROOT_NAME = "Amtssitz am Spreebogen";
const AMTSSITZ_FLAG_PREFIX = "Amtssitz presidential standard";
const REFINEMENT_ROOT_NAME = "Open-data city recognition refinements";
const TIERGARTEN_REFINEMENT_NAME =
  "Tiergarten bridge and memorial fine details";
const SWISS_FLAG_PREFIX = "Swiss Embassy animated";
const SWISS_FLAGPOLE_NAME = "Swiss Embassy flagpole";
const UNITY_FLAGPOLE_NAME = "Flag of Unity 28.5 m galvanized-steel pole";
const UNITY_STRIPE_NAMES = new Set(
  [1, 2, 3].map((index) => `Flag of Unity animated German stripe ${index}`),
);
const BERLINER_ENSEMBLE_MINECRAFT_SMOOTH_BRANCH_NAME =
  "Für Helene Weigel current memorial";

// Minecraft visibility is deliberately reversible. In particular, night-only
// fixtures may be false before voxel mode and true after a later Night relight;
// restoring the exact pre-filter value before that relight lets the ordinary
// lighting policy remain the sole owner of those differences.
const savedVisibility = new WeakMap<Object3D, boolean>();

function setOwnedVisibility(object: Object3D, visible: boolean): void {
  if (!savedVisibility.has(object)) {
    savedVisibility.set(object, object.visible);
  }
  object.visible = visible;
}

function restoreTree(root: Object3D): void {
  root.traverse((object) => {
    const previous = savedVisibility.get(object);
    if (previous === undefined) return;
    object.visible = previous;
    savedVisibility.delete(object);
  });
}

function setWholeTreeVisible(root: Object3D): void {
  root.traverse((object) => setOwnedVisibility(object, true));
}

/** Keep an allowed signature tree except authored smooth voxel replacements. */
function setMinecraftCompatibleTreeVisible(root: Object3D): void {
  if (root.userData.keepInMinecraft === false) {
    setOwnedVisibility(root, false);
    return;
  }
  setOwnedVisibility(root, true);
  for (const child of root.children) {
    setMinecraftCompatibleTreeVisible(child);
  }
}

/**
 * Keep exactly the named leaves and the containers required to reach them.
 * Every sibling branch is hidden at its highest possible node.
 */
function setSelectedLeavesVisible(
  root: Object3D,
  keep: (object: Object3D) => boolean,
): boolean {
  if (keep(root)) {
    setWholeTreeVisible(root);
    return true;
  }
  let hasVisibleLeaf = false;
  for (const child of root.children) {
    hasVisibleLeaf = setSelectedLeavesVisible(child, keep) || hasVisibleLeaf;
  }
  setOwnedVisibility(root, hasVisibleLeaf);
  return hasVisibleLeaf;
}

/**
 * Keep one authored public-art branch without forcing its mode-owned children
 * (snow-only caps and distance-faded portrait dots) back on.
 */
function setSelectedBranchVisible(root: Object3D, branchName: string): boolean {
  if (root.name === branchName) {
    setOwnedVisibility(root, true);
    return true;
  }
  let hasVisibleBranch = false;
  for (const child of root.children) {
    hasVisibleBranch =
      setSelectedBranchVisible(child, branchName) || hasVisibleBranch;
  }
  setOwnedVisibility(root, hasVisibleBranch);
  return hasVisibleBranch;
}

function applySignaturePolicy(signatures: Object3D): void {
  for (const signature of signatures.children) {
    if (FULL_SIGNATURE_ALLOWLIST.has(signature.name)) {
      setMinecraftCompatibleTreeVisible(signature);
      continue;
    }
    if (signature.name === AMTSSITZ_ROOT_NAME) {
      setSelectedLeavesVisible(signature, (object) =>
        object.name.startsWith(AMTSSITZ_FLAG_PREFIX),
      );
      continue;
    }
    if (ANIMATED_STATE_FLAG_SIGNATURES.has(signature.name)) {
      setSelectedLeavesVisible(signature, (object) =>
        Boolean(
          object.userData.windFlag ||
            object.userData.windFlagInstances,
        ),
      );
      continue;
    }
    if (signature.name === REFINEMENT_ROOT_NAME) {
      setSelectedLeavesVisible(
        signature,
        (object) => object.name === TIERGARTEN_REFINEMENT_NAME,
      );
      continue;
    }
    setOwnedVisibility(signature, false);
  }
}

function isMinecraftCivicFlagPart(object: Object3D): boolean {
  return (
    object.name === SWISS_FLAGPOLE_NAME ||
    object.name.startsWith(SWISS_FLAG_PREFIX) ||
    object.name === UNITY_FLAGPOLE_NAME ||
    UNITY_STRIPE_NAMES.has(object.name)
  );
}

function applyCivicPolicy(civicDetails: Object3D): void {
  // Do not change the root: the ordinary underside policy still owns it.
  // Selecting by leaf name rather than by today's two container names also
  // keeps a future harmless wrapper group from making a flag disappear.
  for (const civicBranch of civicDetails.children) {
    setSelectedLeavesVisible(civicBranch, isMinecraftCivicFlagPart);
  }
}

/** Restore every visibility value previously owned by the voxel filter. */
export function restoreMinecraftVisibility(
  roots: MinecraftVisibilityRoots,
): void {
  restoreTree(roots.centralDetails);
  restoreTree(roots.signatures);
  restoreTree(roots.civicDetails);
}

/**
 * Hide smooth architecture once the real voxel world is active. The rule is
 * intentionally narrower than the Minecraft material fallback: measured
 * bridges, terrain sculpture and the four permitted animated flags remain.
 */
export function applyMinecraftVisibility(
  roots: MinecraftVisibilityRoots,
  voxelMode: boolean,
): void {
  if (!voxelMode) {
    restoreMinecraftVisibility(roots);
    return;
  }
  // Root visibility starts with the ordinary underside/surface policy. The
  // selective branch pass may expose only the non-voxel Weigel work above
  // ground; the captured value is released before the next mode establishes
  // its baseline.
  const centralBaselineVisible = roots.centralDetails.visible;
  setSelectedBranchVisible(
    roots.centralDetails,
    BERLINER_ENSEMBLE_MINECRAFT_SMOOTH_BRANCH_NAME,
  );
  if (!centralBaselineVisible) roots.centralDetails.visible = false;
  roots.cityStaffage.visible = false;
  applySignaturePolicy(roots.signatures);
  applyCivicPolicy(roots.civicDetails);
}
