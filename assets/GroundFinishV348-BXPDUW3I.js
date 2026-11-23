import{Yt as e,Z as t,nt as n,v as r}from"./three-engine-De8r6KBv.js";import{t as i}from"./sceneMaterialPrograms-DbTNswxj.js";var a=new WeakSet,o=new WeakMap,s=`groundFinishV348`,c={asphalt:1,paving:2,grass:3},l=new Set([`asphalt`,`paving`,`grass`,`core-drawn`,`core-native`]),u=e=>e.map(e=>{let t=e/255;return Math.round((t<=.04045?t/12.92:((t+.055)/1.055)**2.4)*255)/255}),d=Object.freeze([{colour:Object.freeze(u([109,112,109])),y:3.09,role:1},{colour:Object.freeze(u([124,160,105])),y:3.01,role:3},{colour:Object.freeze(u([201,190,162])),y:3.12,role:4}].map(e=>Object.freeze(e)));function f(e,t){l.has(t)&&(e.userData[s]=t)}function*p(e,t,n,r){if(e.nav.groundY!==3||!e.origin.every(Number.isFinite)||t.length%6||n.length%3||r.length!==e.meshes.length||r.length>16)return null;let i=0;for(let t=0;t<r.length;t++){let n=r[t];if(n.kind!==e.meshes[t].kind||n.indexStart!==i||n.indexCount<0||n.indexCount%3)return null;i+=n.indexCount}if(i!==n.length)return null;let o=e.nav.ground;if(!o.length||o.length>256)return null;let s=0,c=[];for(let e of o){if(s+=e.ring.length+e.holes.reduce((e,t)=>e+t.length,0),s>8192)return null;let t=1/0,n=1/0,r=-1/0,i=-1/0;for(let[a,o]of e.ring)t=Math.min(t,a),n=Math.min(n,o),r=Math.max(r,a),i=Math.max(i,o);c.push([t,n,r,i])}let l=0,u=(e,t,n)=>{let r=!1;for(let i=0,a=e.length-1;i<e.length;a=i++){if(++l>262144)return!1;let o=e[i],s=e[a];o[1]>n!=s[1]>n&&t<(s[0]-o[0])*(n-o[1])/(s[1]-o[1])+o[0]&&(r=!r)}return r},f=(e,t)=>o.some((n,r)=>{let i=c[r];return e>=i[0]&&e<=i[2]&&t>=i[1]&&t<=i[3]&&u(n.ring,e,t)&&!n.holes.some(n=>u(n,e,t))}),p=[0,0,0],m=[!1,!1,!1],h=0;for(let i=0;i<n.length;i+=3){for(i%12288==0&&(yield);h<r.length&&i>=r[h].indexStart+r[h].indexCount;)h++;let a=n[i]*6,o=n[i+1]*6,s=n[i+2]*6;if([a,o,s].some(e=>e<0||e+5>=t.length)||h>=r.length)return null;if(!(a===o||o===s||a===s))for(let n=0;n<d.length;n++){if(m[n])continue;let i=d[n],c=Math.round((i.y-e.origin[1])*100),l=e=>t[e+1]===c&&i.colour.every((n,r)=>t[e+3+r]===Math.round(n*65535)),u=+l(a)+ +l(o)+ +l(s);if(!u)continue;let g=(t[o]-t[a])*(t[s+2]-t[a+2])-(t[s]-t[a])*(t[o+2]-t[a+2]);u!==3||r[h].kind!==`city`||g===0||!f((t[a]+t[o]+t[s])/300,(t[a+2]+t[o+2]+t[s+2])/300)?m[n]=!0:p[n]++}}if(l>262144)return null;let g=d.filter((e,t)=>p[t]>0&&!m[t]);if(!g.length)return null;let _=Object.freeze({selectors:Object.freeze(g),triangles:p.reduce((e,t,n)=>e+(m[n]?0:t),0)});return a.add(_),_}function m(e,t){return a.has(t)?(o.set(e,t),!0):!1}var h=new WeakMap,g=Object.freeze([[1,[12830915,13028293]],[2,[15783611,15585202]],[3,[12179882,12245675,12114089]]].flatMap(([e,t])=>t.map(t=>{let n=new r(t);return Object.freeze({colour:Object.freeze([n.r,n.g,n.b]),y:-999,role:e})}))),_=`varying vec3 vGroundWorldV348;
varying vec3 vGroundPaintV348;
`,v=`
${_}
uniform vec4 uGroundSelectorsV348[8];
uniform float uGroundRolesV348[8];
uniform float uGroundKindV348;
uniform float uGroundNightV348;
float groundHashV348(vec2 p) {
 vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);
}
float groundNoiseV348(vec2 p) {
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(groundHashV348(i),groundHashV348(i+vec2(1.,0.)),f.x),
 mix(groundHashV348(i+vec2(0.,1.)),groundHashV348(i+vec2(1.,1.)),f.x),f.y)-.5;
}
float groundRoleV348() {
 if(uGroundKindV348>0.)return uGroundKindV348;
 for(int i=0;i<8;i++){
  vec4 s=uGroundSelectorsV348[i];
  if(uGroundRolesV348[i]>0.&&max(max(abs(vGroundPaintV348.r-s.r),abs(vGroundPaintV348.g-s.g)),abs(vGroundPaintV348.b-s.b))<.000008&&
   (s.a< -900.||abs(vGroundWorldV348.y-s.a)<.002))return uGroundRolesV348[i];
 }
 return 0.;
}
vec3 groundFinishV348(vec3 paint) {
 float role=groundRoleV348();
 if(role<.5)return paint;
 vec3 dx=dFdx(vGroundWorldV348),dy=dFdy(vGroundWorldV348),n=cross(dx,dy);
 // Only upward-facing surface effect. Existing sidewalls/kerbs retain paint.
 if(abs(n.y)<length(n)*.8)return paint;
 float pixel=max(length(dx.xz),length(dy.xz));
 float nearFade=1.-smoothstep(.035,.22,pixel);
 float broadFade=1.-smoothstep(.25,1.25,pixel);
 float grain=groundNoiseV348(vGroundWorldV348.xz*(role>2.5&&role<3.5?5.:12.));
 float broad=groundNoiseV348(vGroundWorldV348.xz*(role>2.5&&role<3.5?.7:1.6));
 // All perturbations are multiplicative and below 3%; no synthetic slab grid.
 float modulation=1.+.036*grain*nearFade+.018*broad*broadFade;
 if(uGroundNightV348<.5){
  float luma=dot(paint,vec3(.2126,.7152,.0722));
  if(role>1.5&&role<2.5)paint=mix(paint,vec3(luma),.62)*.96;
  else if(role>2.5&&role<3.5)paint=mix(paint,vec3(luma),.18)*.84;
  else if(role<1.5)paint=mix(paint,vec3(luma),.16)*.94;
  // role4 is mapped path of unspecified material: grain only, no recolour.
 }
 return paint*modulation;
}
`;function y(e,t){if(e.includes(`vGroundWorldV348`)||t.includes(`groundFinishV348`))return{vertex:e,fragment:t};if(!e.includes(`#include <project_vertex>`)||!e.includes(`#include <color_vertex>`)||!t.includes(`#include <color_fragment>`))throw Error(`Unsupported ground material shader V348`);return e=_+e.replace(`#include <project_vertex>`,`
vec4 groundPositionV348=vec4(transformed,1.);
#ifdef USE_BATCHING
 groundPositionV348=batchingMatrix*groundPositionV348;
#endif
#ifdef USE_INSTANCING
 groundPositionV348=instanceMatrix*groundPositionV348;
#endif
vGroundWorldV348=(modelMatrix*groundPositionV348).xyz;
#include <project_vertex>`).replace(`#include <color_vertex>`,`#include <color_vertex>
vGroundPaintV348=vec3(1.);
#if defined(USE_COLOR)||defined(USE_COLOR_ALPHA)||defined(USE_INSTANCING_COLOR)||defined(USE_BATCHING_COLOR)
 vGroundPaintV348=vColor.rgb;
#endif`),t=v+t.replace(`#include <color_fragment>`,`#include <color_fragment>
diffuseColor.rgb=groundFinishV348(diffuseColor.rgb);`),{vertex:e,fragment:t}}function b(t,n){if(n.kind===`core-native`||h.has(t)||![`MeshBasicMaterial`,`MeshStandardMaterial`,`MeshLambertMaterial`,`MeshPhongMaterial`,`MeshToonMaterial`].includes(t.type))return!1;let r=t.onBeforeCompile,a=t.customProgramCacheKey,o={spec:n,dead:!1};h.set(t,o);let s=Array.from({length:8},(t,r)=>{let i=n.selectors[r];return i?new e(i.colour[0],i.colour[1],i.colour[2],i.y):new e}),l=Array.from({length:8},(e,t)=>n.selectors[t]?.role??0);return t.onBeforeCompile=function(e,t){if(r.call(this,e,t),o.dead)return;let i=y(e.vertexShader,e.fragmentShader);e.vertexShader=i.vertex,e.fragmentShader=i.fragment,e.uniforms.uGroundSelectorsV348={value:s},e.uniforms.uGroundRolesV348={value:l},e.uniforms.uGroundKindV348={value:n.kind in c?c[n.kind]:0},e.uniforms.uGroundNightV348={value:+n.night}},t.customProgramCacheKey=function(){return a.call(this)+`|semantic-ground-v348`},t.addEventListener(`dispose`,()=>{i(t)||(o.dead=!0)}),t.needsUpdate=!0,!0}function x(e,t){let n=h.get(e);return!!n&&!n.dead&&b(t,n.spec)}function S(e,r=!1){if(r)return 0;let i=0;return e.traverse(e=>{if(!(e instanceof n))return;let r=o.get(e),a=e.userData[s];if(!r&&!l.has(a)||a===`core-native`)return;let c=r?.selectors??(a===`core-drawn`?g:[]),u=new Set;for(let[n,o]of[[e.userData.dayMaterial,!1],[e.userData.nightMaterial,!0],[e.userData.moonlitMaterial,!0],[e.userData.schwellenraumMaterial,!1],[e.material,!1]])for(let e of Array.isArray(n)?n:[n])!(e instanceof t)||u.has(e)||(u.add(e),i+=+b(e,{kind:r?`packet`:a,selectors:c,night:o}))}),i}export{m as a,f as i,p as n,x as r,S as t};