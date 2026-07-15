import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder } from "meshoptimizer";

const [, , inputPath, outputPath] = Bun.argv;
if (!inputPath || !outputPath) {
  throw new Error("Usage: bun compress-meshopt.mjs <input.glb> <output.glb>");
}

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
const document = await io.read(inputPath);
await document.transform(
  meshopt({
    encoder: MeshoptEncoder,
    level: "high",
    quantizeColor: 8,
    quantizeNormal: 8,
    quantizePosition: 16,
  }),
);
await io.write(outputPath, document);
