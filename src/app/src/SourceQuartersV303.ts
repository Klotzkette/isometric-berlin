/** Main-thread recipe injection. The worker never imports these construction data. */
import east from "./data/friedrichshainV303.json";
import village from "./data/rixdorfV304.json";
import landmarks from "./data/neukoellnLandmarksV305Packets.json";
import type {SurroundingOwnershipOptions} from "./SurroundingCityGeometry";
export const SOURCE_QUARTERS_V303=[
  {source:east,kind:"friedrichshain-v303"},
  {source:village,kind:"rixdorf-v304"},
  {source:landmarks,kind:"neukoelln-landmarks-v305",requiredReplacement:true},
] as unknown as NonNullable<SurroundingOwnershipOptions["sourceQuarterSourcesV303"]>;
