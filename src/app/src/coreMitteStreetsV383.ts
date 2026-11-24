import {Group, type Material} from "three";
import {attachWorldSpaceDetail} from "./attachWorldSpaceDetail";
import {createSurveySurfaceV380, type PrenzlauerStreetPacketV380} from "./prenzlauerStreetsV380";
import type {SurroundingChunkGeometry} from "./SurroundingCityGeometry";

/** Ground-only material. Long joints follow the Friedrichstadt grid. The palace
 * forecourt rotates with the palace façade. Unbound sand has a filtered grain. */
function mittePavingFinish(material: Material) {
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `
      #include <common>
      attribute float jointSize;
      varying vec3 mittePaving;
    `).replace("#include <begin_vertex>", `
      #include <begin_vertex>
      mittePaving = vec3(position.xz, jointSize);
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `
      #include <common>
      varying vec3 mittePaving;
      float mitteGrain(vec2 cell) {
        vec3 p = fract(vec3(cell.xyx) * .1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
    `).replace("#include <color_fragment>", `
      #include <color_fragment>
      float finish = mittePaving.z;
      if (finish > .97) {
        vec2 g = mittePaving.xy / .11;
        vec2 f = fract(g);
        f = f*f*(3.-2.*f);
        float grain = mix(mix(mitteGrain(floor(g)),mitteGrain(floor(g)+vec2(1.,0.)),f.x),
            mix(mitteGrain(floor(g)+vec2(0.,1.)),mitteGrain(floor(g)+vec2(1.)),f.x),f.y);
        float fade = 1.-smoothstep(.25,1.,max(fwidth(g.x),fwidth(g.y)));
        diffuseColor.rgb *= 1.+(grain-.5)*.12*fade;
      } else if (finish>.02) {
        bool palace = abs(finish-.91)<.01;
        mat2 grid = palace ? mat2(.812,.584,-.584,.812) : mat2(.9966,.0825,-.0825,.9966);
        float stone = palace ? .23 : finish;
        vec2 q = grid*mittePaving.xy / vec2(stone,stone*(stone>.30?.68:.82));
        vec2 width = max(fwidth(q), vec2(.003));
        q.x += mod(floor(q.y),2.)*.5;
        vec2 edge = .5-abs(fract(q)-.5);
        vec2 inside = smoothstep(vec2(.018)-width*.5,vec2(.023)+width*.5,edge);
        float joint = (1.-min(inside.x,inside.y))*(1.-smoothstep(.15,.85,max(width.x,width.y)));
        diffuseColor.rgb *= 1.-.19*joint;
      }
    `);
  };
  material.customProgramCacheKey = () => "mitte-survey-stone-and-gravel-v383";
}

export function createCoreMitteStreetsV383(packet: PrenzlauerStreetPacketV380, native: boolean) {
  const root = new Group();
  root.name = "Vermessene Straßen und Platzränder der historischen Mitte";
  root.userData = {coreMitteStreetsV383: true, nativeMinecraft: native, keepInMinecraft: native};
  const mesh = createSurveySurfaceV380(packet, "Fahrbahnen, abgesenkte Borde und Gehwegbeläge");
  mittePavingFinish(mesh.userData.dayMaterial);
  mittePavingFinish(mesh.userData.nightMaterial);
  root.add(mesh);
  return root;
}

export async function attachCoreMitteStreetsV383(entry: SurroundingChunkGeometry, id: string, native: boolean, signal?: AbortSignal) {
  signal?.throwIfAborted();
  const tile = id.slice("mitte383-street-".length);
  const {default: data} = await import(`./data/coreMitteStreetsV383/${tile}.json`) as {default: PrenzlauerStreetPacketV380};
  signal?.throwIfAborted();
  attachWorldSpaceDetail(entry, createCoreMitteStreetsV383(data, native));
}
