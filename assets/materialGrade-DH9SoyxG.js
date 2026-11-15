import{X as e,tt as t,v as n}from"./three-engine-CNKo5lvV.js";import{t as r}from"./sceneMaterialPrograms-CI5JYYXe.js";import{r as i}from"./GroundFinishV348-BeHxNa-n.js";var a=Object.freeze({owner:`Hauptbahnhof Washingtonplatz DB pylon`,source:`https://www.sbp.de/projekt/berlin-hauptbahnhof-abluftkamin/`,photo:`https://www.sbp.de/app/uploads/2021/12/2156_1268_a_MAX.jpg`,blockWidthM:8.2/30,blockHeightM:.315,geometryStatus:`photo-informed estimated glass-block module; existing official-height owner retained`}),o=`hbfVentFinishV349`,s=`washingtonplatz-frosted-glass-blocks`,c=new WeakMap;function l(e){e.name===a.owner&&(e.userData[o]=s)}var u=`varying vec3 vHbfVentLocalV349;
`,d=`
${u}
vec3 hbfVentFinishV349(vec3 paint) {
 vec3 dx=dFdx(vHbfVentLocalV349),dy=dFdy(vHbfVentLocalV349);
 vec3 n=cross(dx,dy);
 // Only the broad infill faces; original narrow edges keep their finish.
 if(abs(n.z)<length(n)*.9)return paint;
 vec2 p=(vHbfVentLocalV349.xy+vec2(4.1,30.))/vec2(.2733333333,.315);
 vec2 fw=fwidth(p);
 float fade=1.-smoothstep(.22,.8,max(fw.x,fw.y));
 vec2 cell=floor(p),f=fract(p),edge=min(f,1.-f);
 vec2 aa=max(fw*.75,vec2(.0001));
 vec2 joint=1.-smoothstep(vec2(.025)-aa,vec2(.025)+aa,edge);
 float mortar=max(joint.x,joint.y);
 // Quiet individual block tone and a shallow optical rim, no displacement.
 float seed=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453)-.5;
 float lens=smoothstep(.035,.18,min(edge.x,edge.y));
 float tone=1.+fade*(seed*.035+(lens-.55)*.025+mortar*.085);
 float luma=dot(paint,vec3(.2126,.7152,.0722));
 return mix(paint,vec3(luma),mortar*.12*fade)*tone;
}
`;function f(e,t){if(e.includes(`vHbfVentLocalV349`)||t.includes(`hbfVentFinishV349`))return{vertex:e,fragment:t};if(!e.includes(`#include <project_vertex>`)||!t.includes(`#include <color_fragment>`))throw Error(`Unsupported Washingtonplatz infill shader V349`);return e=u+e.replace(`#include <project_vertex>`,`vHbfVentLocalV349=transformed;
#include <project_vertex>`),t=d+t.replace(`#include <color_fragment>`,`#include <color_fragment>
diffuseColor.rgb=hbfVentFinishV349(diffuseColor.rgb);`),{vertex:e,fragment:t}}function p(e){if(c.has(e)||![`MeshBasicMaterial`,`MeshStandardMaterial`,`MeshLambertMaterial`,`MeshPhongMaterial`,`MeshToonMaterial`].includes(e.type))return!1;let t=e.onBeforeCompile,n=e.customProgramCacheKey(),i={dead:!1};return c.set(e,i),e.onBeforeCompile=function(e,n){if(t.call(this,e,n),i.dead)return;let r=f(e.vertexShader,e.fragmentShader);e.vertexShader=r.vertex,e.fragmentShader=r.fragment},e.customProgramCacheKey=()=>n+`|hbf-vent-finish-v349`,e.addEventListener(`dispose`,()=>{r(e)||(i.dead=!0)}),e.needsUpdate=!0,!0}function m(e,t){let n=c.get(e);return!!n&&!n.dead&&p(t)}function h(n,r=!1){if(r)return 0;let i=0;return n.traverse(n=>{if(!(n instanceof t)||n.name!==a.owner||n.userData[o]!==s)return;let r=new Set;for(let t of[n.userData.dayMaterial,n.userData.nightMaterial,n.userData.moonlitMaterial,n.userData.schwellenraumMaterial,n.material])for(let n of Array.isArray(t)?t:[t])!(n instanceof e)||r.has(n)||(r.add(n),i+=+p(n))}),i}var g=new WeakMap;function _(e,t){g.set(e,t)}function v(e){g.delete(e)}function y(e,t){let n=g.get(e);n&&(t.clippingPlanes=n.planes,t.clipIntersection=n.intersection,t.clipShadows=n.shadows)}var b={saturation:.38,highlightTint:[1.08,1.015,.955],shadowLift:[.018,.025,.043],strength:.72,tint:[.93,.97,1.04]},x=new WeakMap;function S(e,t,n){let r=x.get(e);return!!r&&!r.disposed&&r.day===t&&r.grade===n}function C(e){let{saturation:t,highlightTint:n,shadowLift:r,strength:i,tint:a}=b;return e.replace(`#include <opaque_fragment>`,`float schwellenraumLuma = dot( outgoingLight, vec3( 0.2126, 0.7152, 0.0722 ) );
    vec3 schwellenraumMuted = mix( vec3( schwellenraumLuma ), outgoingLight, ${t.toFixed(2)} );
    float schwellenraumHighlight = smoothstep( 0.30, 0.85, schwellenraumLuma );
    vec3 schwellenraumTemperature = mix( vec3( ${a.map(e=>e.toFixed(3)).join(`, `)} ), vec3( ${n.map(e=>e.toFixed(3)).join(`, `)} ), schwellenraumHighlight );
    vec3 schwellenraumTinted = schwellenraumMuted * schwellenraumTemperature;
    float schwellenraumShadow = 1.0 - smoothstep( 0.15, 0.72, schwellenraumLuma );
    schwellenraumTinted += vec3( ${r.map(e=>e.toFixed(3)).join(`, `)} ) * schwellenraumShadow;
    outgoingLight = clamp( mix( outgoingLight, schwellenraumTinted, ${i.toFixed(2)} ), 0.0, 1.0 );
    #include <opaque_fragment>`)}function w(e){let t=e.clone();y(e,t),i(e,t),m(e,t),t.name=`${e.name||e.type} Schwellenraum grade`,t.userData.schwellenraumMaterialGrade=!0;let n=t.onBeforeCompile.bind(t),r=t.customProgramCacheKey();return t.onBeforeCompile=(e,t)=>{n(e,t);let r=e;r.fragmentShader=C(r.fragmentShader)},t.customProgramCacheKey=()=>`${r}|schwellenraum-material-grade-v3`,t.needsUpdate=!0,t}function T(t,n){let i=t.userData.schwellenraumMaterial;if(i instanceof e)return i;let a=w(n),o={day:n,grade:a,disposed:!1};return n.addEventListener(`dispose`,()=>{r(n)||(o.disposed=!0)}),a.addEventListener(`dispose`,()=>{r(a)||(o.disposed=!0)}),x.set(t,o),t.userData.schwellenraumMaterial=a,a}function E(t,n,r){let i=t.userData.groundOverlayDayV329;return i instanceof e?[n,r===`night`?t.userData.groundOverlayNightV329:r===`schwellenraum`?t.userData.groundOverlaySchwellenraumV329??=w(i):i]:n}function D(e,t){if(e.userData.schwellenraumMaterialGrade===!0)return;let r=e.userData.schwellenraumDayColor;if(t!==`schwellenraum`){e.userData.schwellenraumToneActive===!0&&typeof r==`number`&&(e.color.setHex(r),e.userData.schwellenraumToneActive=!1);return}let i=typeof r==`number`?r:e.color.getHex();e.userData.schwellenraumDayColor=i;let a=new n(i),o=a.r*.2126+a.g*.7152+a.b*.0722,s=new n(o,o,o).lerp(a,b.saturation),c=Math.min(1,Math.max(0,(o-.3)/.55)),l=c*c*(3-2*c),u=new n().setRGB(...b.tint).lerp(new n().setRGB(...b.highlightTint),l);s.multiply(u);let d=Math.min(1,Math.max(0,(o-.15)/.57)),f=1-d*d*(3-2*d);s.add(new n().setRGB(...b.shadowLift).multiplyScalar(f));let p=a.lerp(s,b.strength);e.color.setRGB(Math.min(1,Math.max(0,p.r)),Math.min(1,Math.max(0,p.g)),Math.min(1,Math.max(0,p.b))),e.userData.schwellenraumToneActive=!0}export{_ as a,l as c,D as i,S as n,v as o,T as r,h as s,E as t};