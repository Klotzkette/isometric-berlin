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

function applySignaturePolicy(signatures: Object3D): void {
  for (const signature of signatures.children) {
    if (FULL_SIGNATURE_ALLOWLIST.has(signature.name)) {
      setWholeTreeVisible(signature);
      continue;
    }
    if (signature.name === AMTSSITZ_ROOT_NAME) {
      setSelectedLeavesVisible(signature, (object) =>
        object.name.startsWith(AMTSSITZ_FLAG_PREFIX),
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
  // Root visibility belongs to the ordinary underside/surface policy. Do not
  // snapshot it: Minecraft may be entered below ground, where the saved value
  // would be false even though a later above-ground Day frame must be true.
  roots.centralDetails.visible = false;
  roots.cityStaffage.visible = false;
  applySignaturePolicy(roots.signatures);
  applyCivicPolicy(roots.civicDetails);
}
