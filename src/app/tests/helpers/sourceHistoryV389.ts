import { readSourceHistoryLayer } from "./sourceHistoryLayer";

export const sourceHistoryV389 = readSourceHistoryLayer(
  "v389", "eb573901a91187c1704b7033e76d408ac6c8e64f",
  new URL("../fixtures/source-history-v389.json", import.meta.url),
  "35c2e32b212aca2b249ef712261de56ad27c434be784c1e81861cc5c98e67208",
);
