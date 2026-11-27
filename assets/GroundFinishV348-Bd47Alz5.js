import{Q as e,Zt as t,rt as n,y as r}from"./three-engine-D9ORUF_F.js";import{t as i}from"./sceneMaterialPrograms-DXw2ddpO.js";var a=new WeakSet([e.prototype.onBeforeCompile]);function o(e,t){a.has(e)&&a.add(t)}function s(e){return a.has(e.onBeforeCompile)}var c=new WeakSet,l=new WeakMap,u=`groundFinishV348`,d={asphalt:1,paving:2,grass:3},f=new Set([`asphalt`,`paving`,`grass`,`core-drawn`,`core-native`]),p=e=>e.map(e=>{let t=e/255;return Math.round((t<=.04045?t/12.92:((t+.055)/1.055)**2.4)*255)/255}),m=Object.freeze([{colour:Object.freeze(p([109,112,109])),y:3.09,role:1},{colour:Object.freeze(p([124,160,105])),y:3.01,role:3},{colour:Object.freeze(p([201,190,162])),y:3.12,role:4}].map(e=>Object.freeze(e)));function h(e,t){f.has(t)&&(e.userData[u]=t)}function*g(e,t,n,r){if(e.nav.groundY!==3||!e.origin.every(Number.isFinite)||t.length%6||n.length%3||r.length!==e.meshes.length||r.length>16)return null;let i=0;for(let t=0;t<r.length;t++){let n=r[t];if(n.kind!==e.meshes[t].kind||n.indexStart!==i||n.indexCount<0||n.indexCount%3)return null;i+=n.indexCount}if(i!==n.length)return null;let a=e.nav.ground;if(!a.length||a.length>256)return null;let o=0,s=[];for(let e of a){if(o+=e.ring.length+e.holes.reduce((e,t)=>e+t.length,0),o>8192)return null;let t=1/0,n=1/0,r=-1/0,i=-1/0;for(let[a,o]of e.ring)t=Math.min(t,a),n=Math.min(n,o),r=Math.max(r,a),i=Math.max(i,o);s.push([t,n,r,i])}let l=0,u=(e,t,n)=>{let r=!1;for(let i=0,a=e.length-1;i<e.length;a=i++){if(++l>262144)return!1;let o=e[i],s=e[a];o[1]>n!=s[1]>n&&t<(s[0]-o[0])*(n-o[1])/(s[1]-o[1])+o[0]&&(r=!r)}return r},d=(e,t)=>a.some((n,r)=>{let i=s[r];return e>=i[0]&&e<=i[2]&&t>=i[1]&&t<=i[3]&&u(n.ring,e,t)&&!n.holes.some(n=>u(n,e,t))}),f=[0,0,0],p=[!1,!1,!1],h=0;for(let i=0;i<n.length;i+=3){for(i%12288==0&&(yield);h<r.length&&i>=r[h].indexStart+r[h].indexCount;)h++;let a=n[i]*6,o=n[i+1]*6,s=n[i+2]*6;if([a,o,s].some(e=>e<0||e+5>=t.length)||h>=r.length)return null;if(!(a===o||o===s||a===s))for(let n=0;n<m.length;n++){if(p[n])continue;let i=m[n],c=Math.round((i.y-e.origin[1])*100),l=e=>t[e+1]===c&&i.colour.every((n,r)=>t[e+3+r]===Math.round(n*65535)),u=+l(a)+ +l(o)+ +l(s);if(!u)continue;let g=(t[o]-t[a])*(t[s+2]-t[a+2])-(t[s]-t[a])*(t[o+2]-t[a+2]);u!==3||r[h].kind!==`city`||g===0||!d((t[a]+t[o]+t[s])/300,(t[a+2]+t[o+2]+t[s+2])/300)?p[n]=!0:f[n]++}}if(l>262144)return null;let g=m.filter((e,t)=>f[t]>0&&!p[t]);if(!g.length)return null;let _=Object.freeze({selectors:Object.freeze(g),triangles:f.reduce((e,t,n)=>e+(p[n]?0:t),0)});return c.add(_),_}function _(e,t){return c.has(t)?(l.set(e,t),!0):!1}var v=new WeakMap,y=Object.freeze([[1,[12830915,13028293]],[2,[15783611,15585202]],[3,[12179882,12245675,12114089]]].flatMap(([e,t])=>t.map(t=>{let n=new r(t);return Object.freeze({colour:Object.freeze([n.r,n.g,n.b]),y:-999,role:e})}))),b=`varying vec3 vGroundWorldV348;
varying vec3 vGroundPaintV348;
`,x=`
${b}
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
`;function S(e,t){if(e.includes(`vGroundWorldV348`)||t.includes(`groundFinishV348`))return{vertex:e,fragment:t};if(!e.includes(`#include <project_vertex>`)||!e.includes(`#include <color_vertex>`)||!t.includes(`#include <color_fragment>`))throw Error(`Unsupported ground material shader V348`);return e=b+e.replace(`#include <project_vertex>`,`
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
#endif`),t=x+t.replace(`#include <color_fragment>`,`#include <color_fragment>
diffuseColor.rgb=groundFinishV348(diffuseColor.rgb);`),{vertex:e,fragment:t}}function C(e,n){if(n.kind===`core-native`||v.has(e)||![`MeshBasicMaterial`,`MeshStandardMaterial`,`MeshLambertMaterial`,`MeshPhongMaterial`,`MeshToonMaterial`].includes(e.type))return!1;let r=e.onBeforeCompile,a=e.customProgramCacheKey,s={spec:n,dead:!1};v.set(e,s);let c=Array.from({length:8},(e,r)=>{let i=n.selectors[r];return i?new t(i.colour[0],i.colour[1],i.colour[2],i.y):new t}),l=Array.from({length:8},(e,t)=>n.selectors[t]?.role??0);return e.onBeforeCompile=function(e,t){if(r.call(this,e,t),s.dead)return;let i=S(e.vertexShader,e.fragmentShader);e.vertexShader=i.vertex,e.fragmentShader=i.fragment,e.uniforms.uGroundSelectorsV348={value:c},e.uniforms.uGroundRolesV348={value:l},e.uniforms.uGroundKindV348={value:n.kind in d?d[n.kind]:0},e.uniforms.uGroundNightV348={value:+n.night}},o(r,e.onBeforeCompile),e.customProgramCacheKey=function(){return a.call(this)+`|semantic-ground-v348`},e.addEventListener(`dispose`,()=>{i(e)||(s.dead=!0)}),e.needsUpdate=!0,!0}function w(e,t){let n=v.get(e);return!!n&&!n.dead&&C(t,n.spec)}function T(t,r=!1){if(r)return 0;let i=0;return t.traverse(t=>{if(!(t instanceof n))return;let r=l.get(t),a=t.userData[u];if(!r&&!f.has(a)||a===`core-native`)return;let o=r?.selectors??(a===`core-drawn`?y:[]),s=new Set;for(let[n,c]of[[t.userData.dayMaterial,!1],[t.userData.nightMaterial,!0],[t.userData.moonlitMaterial,!0],[t.userData.schwellenraumMaterial,!1],[t.material,!1]])for(let t of Array.isArray(n)?n:[n])!(t instanceof e)||s.has(t)||(s.add(t),i+=+C(t,{kind:r?`packet`:a,selectors:o,night:c}))}),i}export{_ as a,h as i,g as n,s as o,w as r,o as s,T as t};