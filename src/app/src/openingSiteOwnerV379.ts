/** A packet can contain several adjacent sites. A shared link should wait for
 * the selected landmark's district or its own named mesh when available. */
export function openingSiteOwnerV379(name: string, x: number, z: number): {
  required: string[]; meshName?: string;
} {
  if (name === "Schloss Tegel") {
    return {required:["tegel-landscape-schloss--13_-17"], meshName:"Vermessene Landschaft v378 · schloss"};
  }
  if (name === "Hermannplatz in Neukölln") {
    return {required:["ring182-6_7","ring182-7_6","ring182-6_6"],
      meshName:"Hermannplatz setts, survey mosaics and Neukölln traffic islands"};
  }
  if (name.startsWith("Charlottenburger Tor") || name === "Kandelaber an der Charlottenburger Brücke") {
    return {required:["charlottenburger-tor-v379"],meshName:"Charlottenburger Tor – Kolonnaden, Kandelaber und Charlottenburger Brücke"};
  }
  const tile=Math.floor(x/512) + "_" + Math.floor(z/512);
  if (name.startsWith("Zoo Berlin · ")) {
    const meshName=name.includes("Flusspferdhaus") ? "Zoo Berlin · vermessene gläserne Doppelkuppel" : "Zoo Berlin · Häuser, Gebirgstierfelsen und Garten";
    return {required:["zoo-west379-"+tile],meshName};
  }
  if (name.includes("im Tierpark") && x>10000 && x<11500 && z>1100 && z<2600) {
    // The verified animal-house roofs and walls share the existing district
    // draw call. The two landscape-only tours have a distinct resident mesh.
    const meshName=name.startsWith("Giraffenpfad") ? "Tierpark Friedrichsfelde · Giraffenpfad und Holzstege"
      : name.startsWith("Himalaya-") ? "Tierpark Friedrichsfelde · Geländerelief der Tieranlagen" : undefined;
    return {required:["outer187-"+tile],meshName};
  }
  return {required:[]};
}
