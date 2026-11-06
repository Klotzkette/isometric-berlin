/** Built memorial context. Reference photographs stay outside the viewer. */
import {BoxGeometry,CanvasTexture,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,SRGBColorSpace} from "three";
import {createLetteringTexture} from "./drawnLettering";

export const GEORG_ELSER_CONTEXT_V325 = {
  informationNode:"11395350229",
  informationWorldXZ:[740.6443577198079,751.4347634585574] as const,
  secondQuote:"Ich wollte ja auch durch meine Tat ein noch größeres Blutvergießen verhindern.",
  secondAttribution:"Georg Elser im Gestapo-Verhör am 20. November 1939",
  quoteBandSizeM:[10,.75] as const,
  steleSizeM:[.82,2.28,.055] as const,
  dimensionStatus:"Photograph-proportioned display dimensions; inscription-band offsets and stele heading are estimates, not surveyed positions",
  sources:[
    "https://www.openstreetmap.org/node/11395350229",
    "https://www.gedenktafeln-in-berlin.de/gedenktafeln/detail/johann-georg-elser/2571",
    "https://commons.wikimedia.org/wiki/File:Denkzeichen_Georg_Elser_Berlin_12.jpg",
    "https://commons.wikimedia.org/wiki/File:Gedenktafel_An_der_Kolonnade_2_(Mitte)_Georg_Elser2.jpg",
    "https://commons.wikimedia.org/wiki/File:Gedenktafel_An_der_Kolonnade_2_(Mitte)_Georg_Elser3.jpg",
  ],
} as const;

function solid(name:string,size:readonly number[],color:number,position:readonly number[]):Mesh {
  const day=new MeshBasicMaterial({color});
  const night=new MeshStandardMaterial({color,roughness:.78,metalness:.15});
  const mesh=new Mesh(new BoxGeometry(size[0],size[1],size[2]),day);mesh.name=name;
  mesh.position.set(position[0],position[1],position[2]);mesh.userData.dayMaterial=day;mesh.userData.nightMaterial=night;
  return mesh;
}
function inscription(name:string,text:string,width:number,height:number,z:number):Mesh {
  const texture=createLetteringTexture({text:text.toUpperCase(),bandWidthM:width,bandHeightM:height,capHeightM:height*.56,
    fieldColor:"#5e6258",letterColor:"#ddc58b",texelsPerMetre:256});
  const day=new MeshBasicMaterial(texture?{map:texture,side:DoubleSide}:{color:0x5e6258,side:DoubleSide});
  const night=new MeshStandardMaterial(texture?{map:texture,side:DoubleSide,roughness:.78}:{color:0x5e6258,side:DoubleSide});
  night.userData.nightEmissive=0xc9ad77;night.userData.nightEmissiveIntensity=.26;
  const mesh=new Mesh(new PlaneGeometry(width,height),day);mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.set(0,.057,z);
  mesh.userData={lettering:text,dayMaterial:day,nightMaterial:night,fallbackWithoutCanvas:texture===null};return mesh;
}

/** Original factual labels, with abstract archival-image fields rather than
 * copied photographs. The narrow printing column leaves the glass transparent. */
function stelePrint():CanvasTexture|null {
  if(typeof document==="undefined")return null;
  const canvas=document.createElement("canvas");canvas.width=384;canvas.height=1024;
  const ctx=canvas.getContext("2d");if(!ctx)return null;
  ctx.clearRect(0,0,384,1024);ctx.fillStyle="#deded3";ctx.fillRect(72,190,166,765);
  ctx.fillStyle="#9b322d";ctx.font="bold 18px sans-serif";ctx.fillText("GEORG ELSER",80,218);
  ctx.fillStyle="#383d39";ctx.font="14px sans-serif";ctx.fillText("1903–1945",80,242);
  const paragraphs=[
    ["Am 8. November 1939","verübte Georg Elser ein","Attentat auf Adolf Hitler","im Münchner Bürgerbräukeller."],
    ["Er wollte den Krieg","verhindern. Hitler verließ","den Saal vor der Explosion."],
    ["Elser wurde verhaftet und","am 9. April 1945 im","Konzentrationslager Dachau","ermordet."],
    ["Das Denkzeichen von","Ulrich Klages erinnert seit","2011 an seinen Widerstand."],
  ];
  let y=277;
  for(const lines of paragraphs){for(const line of lines){ctx.fillText(line,80,y,150);y+=18;}y+=25;}
  ctx.fillStyle="#9b322d";ctx.font="bold 12px sans-serif";ctx.fillText("RESISTANCE",80,701);
  ctx.fillStyle="#383d39";ctx.font="12px sans-serif";
  ["Georg Elser acted alone","against Hitler in 1939.","He hoped to prevent war.","He was murdered in Dachau","on 9 April 1945.","This memorial opened in 2011."].forEach((line,i)=>ctx.fillText(line,80,726+i*17,150));
  // The built board has five small archival pictures. No historical picture
  // is reproduced: only their restrained monochrome composition is modeled.
  for(let i=0;i<5;i++){const top=260+i*128;ctx.fillStyle=i%2?"#8f938c":"#a4a79e";ctx.fillRect(238,top,73,91);
    ctx.fillStyle="#656c65";ctx.fillRect(244,top+12,55,3);ctx.fillRect(250,top+25,40,41);ctx.fillRect(244,top+75,55,2);}
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;return texture;
}

export function createGeorgElserContextV325(anchor:{worldM:readonly number[];rotationY:number}):Group {
  const root=new Group();root.name="Georg Elser built pavement and information context v325";
  root.userData={sourceUrls:[...GEORG_ELSER_CONTEXT_V325.sources],photographicPixelsBundled:false,
    builtQuoteBandsTotal:2,dimensionStatus:GEORG_ELSER_CONTEXT_V325.dimensionStatus,collisionRole:"thin visual fittings; unchanged original walking surface"};
  const band=new Group();band.name="Georg Elser second built pavement quotation";band.position.set(-.65,0,3.65);
  const [width,depth]=GEORG_ELSER_CONTEXT_V325.quoteBandSizeM;
  band.add(solid("Second quotation granite edge",[width,.025,depth],0x797b72,[0,.0125,0]));
  band.add(solid("Second quotation glass field",[width-.09,.018,depth-.09],0x5e6258,[0,.035,0]));
  band.add(inscription("Georg Elser second pavement inscription quote",GEORG_ELSER_CONTEXT_V325.secondQuote,width-.22,.29,-.10));
  const attribution=inscription("Georg Elser second pavement inscription attribution",GEORG_ELSER_CONTEXT_V325.secondAttribution,4.8,.135,.18);
  attribution.position.x=(width-4.8)/2-.18;band.add(attribution);root.add(band);

  const board=new Group();board.name="Georg Elser source-mapped information stele v325";
  const dx=GEORG_ELSER_CONTEXT_V325.informationWorldXZ[0]-anchor.worldM[0],dz=GEORG_ELSER_CONTEXT_V325.informationWorldXZ[1]-anchor.worldM[1];
  const c=Math.cos(anchor.rotationY),s=Math.sin(anchor.rotationY);
  board.position.set(c*dx-s*dz,0,s*dx+c*dz);board.rotation.y=.28-anchor.rotationY;
  board.userData={osmNodeId:GEORG_ELSER_CONTEXT_V325.informationNode,positionStatus:"original current OSM information-board point",headingStatus:"photographic display estimate"};
  const [w,h,t]=GEORG_ELSER_CONTEXT_V325.steleSizeM;
  for(const side of[-1,1])board.add(solid("Information stele narrow steel upright",[.045,h,t],0x30342e,[side*(w-.045)/2,h/2,0]));
  board.add(solid("Information stele steel top",[w,.045,t],0x30342e,[0,h-.0225,0]));
  board.add(solid("Information stele lower glass edge",[w-.09,.025,t],0x30342e,[0,.04,0]));
  const glassDay=new MeshBasicMaterial({color:0xb8c3b9,transparent:true,opacity:.14,side:DoubleSide,depthWrite:false});
  const glassNight=new MeshStandardMaterial({color:0xb8c3b9,transparent:true,opacity:.14,side:DoubleSide,roughness:.28,depthWrite:false});
  const glass=new Mesh(new PlaneGeometry(w-.09,h-.10),glassDay);glass.name="Information stele transparent glass";glass.position.y=h/2;
  glass.userData={dayMaterial:glassDay,nightMaterial:glassNight};board.add(glass);
  const texture=stelePrint(),day=new MeshBasicMaterial(texture?{map:texture,transparent:true,side:DoubleSide,depthWrite:false}:{color:0xdeded3,side:DoubleSide});
  const night=new MeshStandardMaterial(texture?{map:texture,transparent:true,side:DoubleSide,depthWrite:false}:{color:0xdeded3,side:DoubleSide});
  const print=new Mesh(new PlaneGeometry(w-.09,h-.10),day);print.name="Information stele printed history column";print.position.set(0,h/2,.008);
  print.userData={dayMaterial:day,nightMaterial:night,photographicPixelsBundled:false};board.add(print);root.add(board);
  return root;
}
