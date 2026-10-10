import type { Group } from "three";
import { createPrisonsMemorialsEnvelopesV209 } from "./PrisonsMemorialsV209";
import { createVolksbuehneEnvelopeV209 } from "./VolksbuehneEnvelopeV209";
import { createHelmholtzEnvelopesV209 } from "./KiezFacadesV209";
import { cutOrankeseePresentationV209 } from "./orankeseePresentationV209";

/** Attach each complete owner before yielding, so the city's transaction owns
 * and disposes every allocated model even when loading is interrupted. */
export function* addRequiredSiteEnvelopesV209Steps(root: Group, native = false): Generator<void> {
  cutOrankeseePresentationV209(root, native);
  yield;
  root.add(createVolksbuehneEnvelopeV209(native));
  yield;
  root.add(createHelmholtzEnvelopesV209(native));
  yield;
  root.add(createPrisonsMemorialsEnvelopesV209(native));
  yield;
}
