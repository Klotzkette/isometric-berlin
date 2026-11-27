import{f as e,rt as t}from"./three-engine-Cd6JWAKn.js";var n=[[-418,-896,10,-419],[-42,-80,383,155],[-221,-82,42,109]];function r(t,r){let i=new Float64Array(t.length),a=0;for(let[e,r]of t.entries()){if(r.length<2)continue;let t=0,o=1/0,s=1/0,c=-1/0,l=-1/0;for(let e=0;e<r.length;e++){let[n,i]=r[e];e&&(t+=Math.hypot(n-r[e-1][0],i-r[e-1][1])),o=Math.min(n,o),s=Math.min(i,s),c=Math.max(n,c),l=Math.max(i,l)}n.some(([e,t,n,r])=>o<=n&&c>=e&&s<=r&&l>=t)||(i[e]=t,a=Math.max(a,t))}let o=Math.max(1/64,Math.ceil(a)/65534),s=new Uint16Array(r*4),c=0;for(let[e,n]of t.entries()){let t=i[e];if(!t){c+=4*n.length;continue}let r=Math.max(1,Math.round(t))/t,a=0;for(let e=0;e<n.length;e++)e&&(a+=Math.hypot(n[e][0]-n[e-1][0],n[e][1]-n[e-1][1])),s.fill(1+Math.round(a*r/o),c,c+4),c+=4}return{attribute:new e(s,1),scale:o}}var i=new WeakMap;function a(e,n){let r=e.userData.kerbStoneScale,a=e.userData.kerbBoxProfile===!0;if(!a&&typeof r!=`number`)return;let o=e.userData.dayMaterial;if(!(o instanceof t))return;let s=i.get(o);if(!s&&n===`day`){let e={value:1},t=o.onBeforeCompile,n=o.customProgramCacheKey();o.onBeforeCompile=(n,i)=>{t.call(o,n,i),n.uniforms.kerbStoneEnabled=e,a||(n.uniforms.kerbStoneScale={value:r});let s=a?``:`attribute float kerbStation;
uniform float kerbStoneScale;
`,c=a?`vKerbProfile = vec3(-1.0, position.z + 0.5, position.y + 0.5);`:`
int corner = gl_VertexID % 4;
vKerbProfile = vec3(kerbStation > 0.0 ? (kerbStation - 1.0) * kerbStoneScale : -1.0,
  float(corner % 2), float(corner / 2));`;n.vertexShader=s+`varying vec3 vKerbProfile;
`+n.vertexShader.replace(`#include <begin_vertex>`,`#include <begin_vertex>
`+c),n.fragmentShader=`uniform float kerbStoneEnabled;
varying vec3 vKerbProfile;
`+n.fragmentShader.replace(`#include <opaque_fragment>`,`
if (kerbStoneEnabled > 0.0) {
  float course = vKerbProfile.x;
  vec2 pixel = fwidth(vKerbProfile.yz);
  float detail = 1.0 - smoothstep(0.18, 0.85, max(pixel.x, pixel.y));
  float lip = smoothstep(0.89, 1.0, abs(vKerbProfile.y * 2.0 - 1.0)) * smoothstep(0.89, 1.0, vKerbProfile.z);
  float heel = 1.0 - smoothstep(0.0, 0.72, vKerbProfile.z);
  float stone = 0.0;
  float halfPixel = max(0.0001, fwidth(course) * 0.5);
  if (course >= 0.0) {
    // Pixel coverage of a narrow joint. Subpixel seams lose contrast as
    // the observer rises, instead of turning into a shimmering dotted line.
    float phase = fract(course + 0.5) - 0.5;
    float covered = max(0.0, min(phase + halfPixel, 0.006) - max(phase - halfPixel, -0.006));
    float tone = fract(floor(course) * 0.618034) - 0.5;
    stone = (tone * 0.085 - 0.48 * covered / (2.0 * halfPixel)) * (1.0 - smoothstep(0.08, 0.38, halfPixel));
  }
  outgoingLight *= 1.0 + detail * (stone + 0.10 * lip - 0.17 * heel);
}
#include <opaque_fragment>`)},o.customProgramCacheKey=()=>n+(a?`|kerb-stone-box`:`|kerb-stone-course`),o.needsUpdate=!0,i.set(o,e),s=e}s&&(s.value=+(n===`day`))}export{a as n,r as t};