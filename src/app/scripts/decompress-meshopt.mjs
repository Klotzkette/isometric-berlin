import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dequantize } from "@gltf-transform/functions";
import { MeshoptDecoder } from "meshoptimizer";

const [, , inputPath, outputPath] = Bun.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: bun decompress-meshopt.mjs <input.glb> <output.glb>");
}

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const document = await io.read(inputPath);
await document.transform(dequantize());
for (const extension of document.getRoot().listExtensionsUsed()) {
  if (extension.extensionName === "EXT_meshopt_compression") {
    extension.dispose();
  }
}
await io.write(outputPath, document);
