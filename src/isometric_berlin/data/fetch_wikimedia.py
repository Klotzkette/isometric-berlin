"""Fetch Wikimedia Commons visual references for hero landmarks.

The output is intentionally a small visual-reference layer, not a raw
photo dump: thumbnails, attribution metadata, dominant colours, and an
atlas for manual QA / future texture work.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import textwrap
import unicodedata
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
COMMONS_FILE_URL = "https://commons.wikimedia.org/wiki/"
USER_AGENT = "isometric-berlin/0.1 (+https://github.com/Klotzkette/isometric-berlin)"
LANDMARK_QUERIES: dict[str, list[str]] = {
  "reichstag": [
    "Reichstagsgebäude Berlin exterior",
    "Reichstag dome exterior Berlin",
  ],
  "bundeskanzleramt": [
    "Bundeskanzleramt Berlin south side",
    "Bundeskanzleramt Berlin exterior",
    "Berlin Bundeskanzleramt Spreebogen exterior",
  ],
  "paul_loebe_haus": [
    "Paul-Löbe-Haus Berlin exterior",
    "Paul Loebe Haus Bundestag Berlin",
    "Paul-Löbe-Haus Spree Berlin",
  ],
  "marie_elisabeth_lueders_haus": [
    "Marie-Elisabeth-Lüders-Haus Berlin exterior",
    "Marie Elisabeth Lueders Haus Berlin Spree",
    "Marie-Elisabeth-Lüders-Haus Bundestag Berlin",
  ],
  "hauptbahnhof": [
    "Berlin Hauptbahnhof Washingtonplatz facade",
    "Berlin Hauptbahnhof glass facade",
    "Berlin Hauptbahnhof east facade",
    "Berlin Hauptbahnhof glass roof exterior",
  ],
  "humboldthafen": [
    "Humboldthafen Berlin Hauptbahnhof",
    "Berlin Humboldthafen",
  ],
  "rahel_hirsch_strasse": [
    "Rahel-Hirsch-Straße Berlin Hauptbahnhof",
    "Rahel Hirsch Strasse Berlin",
  ],
  "gustav_heinemann_bruecke": [
    "Gustav-Heinemann-Brücke Berlin",
    "Gustav Heinemann Bridge Berlin",
  ],
  "hugo_preuss_bruecke": [
    "Hugo-Preuß-Brücke Berlin",
    "Hugo Preuss Bridge Berlin",
  ],
  "moltkebruecke": [
    "Moltkebrücke Berlin",
    "Moltkebruecke Berlin",
  ],
  "hkw": [
    "Haus der Kulturen der Welt Berlin exterior",
    "Kongresshalle Berlin Haus der Kulturen der Welt",
  ],
  "brandenburger_tor": [
    "Brandenburger Tor Berlin Pariser Platz",
  ],
  "pariser_platz": [
    "Pariser Platz Berlin Brandenburger Tor",
    "Berlin Pariser Platz Brandenburger Tor",
  ],
  "max_liebermann_haus": [
    "Max-Liebermann-Haus Berlin Pariser Platz",
    "MaxLiebermannHaus Berlin",
    "Max-Liebermann-Haus und Palais am Pariser Platz",
  ],
  "us_embassy": [
    "United States Embassy Berlin Pariser Platz",
    "Amerikanische Botschaft Berlin Pariser Platz",
  ],
  "holocaust_memorial": [
    "Denkmal für die ermordeten Juden Europas Berlin",
    "Memorial to the Murdered Jews of Europe Berlin",
  ],
  "memorial_homosexuals": [
    "Denkmal für die im Nationalsozialismus verfolgten Homosexuellen Berlin",
    "Memorial to Homosexuals Persecuted Under Nazism Berlin",
  ],
  "sinti_roma_memorial": [
    "Denkmal für die im Nationalsozialismus ermordeten Sinti und Roma Europas",
    "Sinti und Roma Denkmal Berlin Tiergarten",
  ],
  "beethoven_haydn_mozart_memorial": [
    "Beethoven-Haydn-Mozart-Denkmal Berlin Tiergarten",
    "Beethoven Haydn Mozart Memorial Berlin",
  ],
  "goethe_denkmal": [
    "Goethe-Denkmal Berlin Tiergarten",
    "Goethe Denkmal Tiergarten Berlin",
  ],
  "soviet_war_memorial_tiergarten": [
    "Sowjetisches Ehrenmal Tiergarten Berlin",
    "Soviet War Memorial Tiergarten Berlin",
  ],
  "kemperplatz_tiergartentunnel": [
    "Kemperplatz Berlin Tiergartentunnel",
    "Tunnel Tiergarten Spreebogen Kemperplatz Berlin",
    "Berlin Tiergartentunnel",
  ],
  "tiergarten_spreebogen": [
    "Spreebogenpark Berlin Tiergarten",
    "Tiergarten Berlin Spreebogen",
    "Spreebogenpark Berlin",
  ],
  "tiergarten": [
    "Tiergarten Berlin Ebertstraße Goethe Denkmal",
    "Großer Tiergarten Berlin Reichstag",
    "Tiergarten Berlin park entrance",
  ],
}

REQUIRED_TITLE_TERMS: dict[str, tuple[str, ...]] = {
  "reichstag": ("reichstag", "reichstags"),
  "bundeskanzleramt": ("bundeskanzleramt", "kanzler"),
  "paul_loebe_haus": ("paul-lobe", "paul-loebe", "lobe-haus", "loebe-haus"),
  "marie_elisabeth_lueders_haus": (
    "marie-elisabeth",
    "luders-haus",
    "lueders-haus",
  ),
  "hauptbahnhof": ("hauptbahnhof",),
  "humboldthafen": ("humboldthafen",),
  "rahel_hirsch_strasse": ("rahel-hirsch",),
  "gustav_heinemann_bruecke": ("gustav-heinemann",),
  "hugo_preuss_bruecke": ("hugo-preuss",),
  "moltkebruecke": ("moltkebrucke", "moltke-brucke", "moltke"),
  "hkw": ("haus-der-kulturen", "kulturen-der-welt", "kongresshalle", "hkdw", "hkw"),
  "brandenburger_tor": ("brandenburger",),
  "pariser_platz": ("pariser-platz",),
  "max_liebermann_haus": (
    "maxliebermannhaus",
    "max-liebermann-haus",
  ),
  "us_embassy": ("embassy", "botschaft", "amerikanische", "united-states"),
  "holocaust_memorial": (
    "denkmal-fur-die-ermordeten-juden",
    "memorial-to-the-murdered-jews",
    "holocaust",
  ),
  "memorial_homosexuals": ("homosexuellen", "homosexuals", "homosexual"),
  "sinti_roma_memorial": ("sinti", "roma"),
  "beethoven_haydn_mozart_memorial": (
    "beethoven-haydn-mozart",
    "beethoven-haydn-mozart-denkmal",
  ),
  "goethe_denkmal": ("goethe",),
  "soviet_war_memorial_tiergarten": (
    "sowjetisches-ehrenmal",
    "soviet-war-memorial",
    "tiergarten",
  ),
  "kemperplatz_tiergartentunnel": (
    "kemperplatz",
    "tiergartentunnel",
    "tunnel-tiergarten-spreebogen",
  ),
  "tiergarten_spreebogen": ("tiergarten", "spreebogen", "spreebogenpark"),
  "tiergarten": ("tiergarten",),
}

EXCLUDED_TITLE_TERMS = (
  "academy-architecture",
  "architekt",
  "archiv",
  "archive",
  "ambassador",
  "ambassadors",
  "alte-nationalgalerie",
  "amsterdam",
  "ausschreitungen",
  "blaue-stunde",
  "blumenstauden",
  "bundesversammlung",
  "bundesarchiv",
  "cube",
  "christmas",
  "decoration",
  "demonstration",
  "exclusion-zone",
  "gedenktafel",
  "hanukkah",
  "historical",
  "historisch",
  "hindenburg",
  "interior",
  "innen",
  "karte",
  "map",
  "naumann",
  "nachts",
  "night",
  "ost-berlin",
  "plan",
  "portrait",
  "portrat",
  "portraet",
  "protest",
  "siegessaule",
  "siegessaeule",
  "siegessäule",
  "skulptur",
  "stolperstein",
  "tafel",
  "notausgang",
  "ukrainian",
  "underground",
  "wahl",
  "waisenhaus",
  "wannseegarten",
  "wreath",
  "wannsee",
)
HISTORIC_YEAR_RE = re.compile(r"(?<!\d)(?:18|19)\d{2}(?!\d)")


@dataclass(frozen=True)
class WikimediaImage:
  landmark_id: str
  title: str
  page_url: str
  thumb_url: str
  width: int
  height: int
  mime: str
  license: str
  license_url: str
  artist: str
  credit: str
  description: str


def request_json(params: dict[str, str | int]) -> dict[str, Any]:
  query = urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
  request = urllib.request.Request(
    f"{COMMONS_API}?{query}", headers={"User-Agent": USER_AGENT}
  )
  with urllib.request.urlopen(request, timeout=30) as response:
    return json.loads(response.read().decode("utf-8"))


def text_meta(metadata: dict[str, Any], key: str) -> str:
  value = metadata.get(key, {}).get("value", "")
  text = re.sub(r"<[^>]+>", " ", str(value))
  return re.sub(r"\s+", " ", html.unescape(text)).strip()


def normalized_license_key(license_name: str) -> str:
  """Return a comparable license key from Commons extmetadata."""
  return re.sub(r"[^a-z0-9]+", "-", license_name.lower()).strip("-")


def license_allowed(license_name: str) -> bool:
  key = normalized_license_key(license_name)
  if not key:
    return False
  if "-nc" in key or key.endswith("-nc") or "-nd" in key or key.endswith("-nd"):
    return False
  return key in {"cc0", "pd"} or key.startswith(
    ("cc0-", "cc-by-", "cc-by-sa-", "public-domain", "pd-")
  )


def license_requires_attribution(license_name: str) -> bool:
  key = normalized_license_key(license_name)
  if not license_allowed(license_name):
    return False
  return not (key in {"cc0", "pd"} or key.startswith(("cc0-", "public-domain", "pd-")))


def image_from_page(landmark_id: str, page: dict[str, Any]) -> WikimediaImage | None:
  infos = page.get("imageinfo") or []
  if not infos:
    return None
  info = infos[0]
  mime = str(info.get("mime", ""))
  if not mime.startswith("image/"):
    return None
  metadata = info.get("extmetadata") or {}
  license_name = text_meta(metadata, "LicenseShortName")
  if not license_allowed(license_name):
    return None
  title = str(page.get("title", ""))
  thumb_url = str(info.get("thumburl") or info.get("url") or "")
  if not thumb_url:
    return None
  width = int(info.get("thumbwidth") or info.get("width") or 0)
  height = int(info.get("thumbheight") or info.get("height") or 0)
  if width <= 0 or height <= 0:
    return None
  artist = text_meta(metadata, "Artist")
  credit = text_meta(metadata, "Credit")
  if license_requires_attribution(license_name) and not (artist or credit):
    return None
  return WikimediaImage(
    landmark_id=landmark_id,
    title=title,
    page_url=f"{COMMONS_FILE_URL}{urllib.parse.quote(title.replace(' ', '_'))}",
    thumb_url=thumb_url,
    width=width,
    height=height,
    mime=mime,
    license=license_name,
    license_url=text_meta(metadata, "LicenseUrl"),
    artist=artist,
    credit=credit,
    description=text_meta(metadata, "ImageDescription"),
  )


def search_commons(landmark_id: str, query: str, *, limit: int) -> list[WikimediaImage]:
  payload = request_json(
    {
      "action": "query",
      "generator": "search",
      "gsrnamespace": 6,
      "gsrlimit": limit,
      "gsrsearch": query,
      "prop": "imageinfo",
      "iiprop": "url|mime|size|extmetadata",
      "iiurlwidth": 640,
    }
  )
  pages = payload.get("query", {}).get("pages", [])
  images: list[WikimediaImage] = []
  for page in pages:
    image = image_from_page(landmark_id, page)
    if image is not None:
      images.append(image)
  return images


def slugify(value: str) -> str:
  value = value.replace("ß", "ss").replace("ẞ", "SS")
  ascii_value = "".join(
    char
    for char in unicodedata.normalize("NFKD", value)
    if not unicodedata.combining(char)
  )
  slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_value.lower()).strip("-")
  return slug[:96] or "image"


def title_suitable(landmark_id: str, title: str) -> bool:
  key = slugify(title)
  if any(term in key for term in EXCLUDED_TITLE_TERMS):
    return False
  if HISTORIC_YEAR_RE.search(title):
    return False
  required = REQUIRED_TITLE_TERMS.get(landmark_id, ())
  return not required or any(term in key for term in required)


def download_thumbnail(image: WikimediaImage, path: Path) -> None:
  request = urllib.request.Request(image.thumb_url, headers={"User-Agent": USER_AGENT})
  with urllib.request.urlopen(request, timeout=45) as response:
    data = response.read()
  path.parent.mkdir(parents=True, exist_ok=True)
  path.write_bytes(data)


def dominant_colours(path: Path, *, count: int = 6) -> list[str]:
  with Image.open(path) as image:
    small = image.convert("RGB").resize((96, 96))
  palette = small.quantize(colors=count, method=Image.Quantize.MEDIANCUT)
  colours = palette.getpalette()[: count * 3]
  return [
    f"#{colours[index]:02x}{colours[index + 1]:02x}{colours[index + 2]:02x}"
    for index in range(0, len(colours), 3)
  ]


def font(size: int) -> ImageFont.ImageFont:
  for candidate in [
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  ]:
    try:
      return ImageFont.truetype(candidate, size=size)
    except OSError:
      continue
  return ImageFont.load_default()


def write_atlas(records: list[dict[str, Any]], out_path: Path) -> None:
  if not records:
    return
  cell_w, cell_h = 320, 270
  columns = 3
  rows = (len(records) + columns - 1) // columns
  atlas = Image.new("RGB", (columns * cell_w, rows * cell_h), (244, 240, 230))
  draw = ImageDraw.Draw(atlas)
  title_font = font(14)
  small_font = font(11)
  for index, record in enumerate(records):
    col = index % columns
    row = index // columns
    x = col * cell_w
    y = row * cell_h
    image_path = out_path.parent / record["thumbnail_path"]
    with Image.open(image_path) as thumb:
      thumb = thumb.convert("RGB")
      thumb.thumbnail((cell_w - 24, 178), Image.Resampling.LANCZOS)
      atlas.paste(thumb, (x + 12, y + 12))
    text_y = y + 198
    title = record["title"].removeprefix("File:")
    draw.text((x + 12, text_y), title[:40], fill=(34, 41, 38), font=title_font)
    label = f"{record['landmark_id']} · {record['license']}"
    wrapped = textwrap.wrap(label, width=42)[:2]
    for line in wrapped:
      text_y += 18
      draw.text((x + 12, text_y), line, fill=(82, 76, 68), font=small_font)
  out_path.parent.mkdir(parents=True, exist_ok=True)
  atlas.save(out_path, optimize=True)


def build_manifest(
  *,
  per_landmark: int,
  search_limit: int,
  references_dir: Path,
) -> dict[str, Any]:
  records: list[dict[str, Any]] = []
  seen_titles: set[str] = set()
  for landmark_id, queries in LANDMARK_QUERIES.items():
    chosen: list[WikimediaImage] = []
    for query in queries:
      for image in search_commons(landmark_id, query, limit=search_limit):
        if image.title in seen_titles:
          continue
        if not title_suitable(landmark_id, image.title):
          continue
        seen_titles.add(image.title)
        chosen.append(image)
        if len(chosen) >= per_landmark:
          break
      if len(chosen) >= per_landmark:
        break
    for idx, image in enumerate(chosen, start=1):
      suffix = ".jpg" if "jpeg" in image.mime or "jpg" in image.mime else ".png"
      relative = Path(f"{image.landmark_id}_{idx:02d}_{slugify(image.title)}{suffix}")
      thumbnail_path = references_dir / relative
      download_thumbnail(image, thumbnail_path)
      colours = dominant_colours(thumbnail_path)
      records.append(
        {
          "landmark_id": image.landmark_id,
          "title": image.title,
          "page_url": image.page_url,
          "thumbnail_path": str(relative),
          "thumb_url": image.thumb_url,
          "license": image.license,
          "license_url": image.license_url,
          "artist": image.artist,
          "credit": image.credit,
          "description": image.description,
          "dominant_colours": colours,
          "role": "visual_reference_for_material_and_facade_QA",
        }
      )
  atlas_path = references_dir / "atlas.jpg"
  write_atlas(records, atlas_path)
  return {
    "source": "wikimedia",
    "available": bool(records),
    "generated_by": "isometric_berlin.data.fetch_wikimedia",
    "policy": "Small freely licensed Wikimedia Commons thumbnails for visual reference; attribution metadata retained per image.",
    "records": records,
    "atlas_path": str(atlas_path),
  }


def clean_reference_images(references_dir: Path) -> None:
  for path in references_dir.glob("*"):
    if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
      path.unlink()


def write_readme(
  references_dir: Path, manifest_path: Path, records: list[dict[str, Any]]
) -> None:
  rows = [
    "| Landmark | File | Author / credit | License |",
    "|---|---|---|---|",
  ]
  for record in records:
    title = str(record.get("title", "")).removeprefix("File:")
    author = str(record.get("artist") or record.get("credit") or "unknown")
    license_name = str(record.get("license", ""))
    page_url = str(record.get("page_url", ""))
    license_url = str(record.get("license_url", ""))
    rows.append(
      "| "
      + " | ".join(
        [
          str(record.get("landmark_id", "")),
          f"[{title}]({page_url})",
          author.replace("|", "/"),
          f"[{license_name}]({license_url})" if license_url else license_name,
        ]
      )
      + " |"
    )
  (references_dir / "README.md").write_text(
    f"""# Wikimedia visual references

Small Wikimedia Commons thumbnails used as additive visual references
for the Regierungsviertel hero landmarks. The authoritative geometry
remains Berlin LoD2; OSM remains the semantic/context source.

See `{manifest_path}` for per-image URL, author, license, and dominant
colour metadata. Keep attribution when using any thumbnail or derivative
texture work based on these references.

## Attribution

{chr(10).join(rows)}
""",
    encoding="utf-8",
  )


def main() -> int:
  parser = argparse.ArgumentParser(description=__doc__)
  parser.add_argument("--per-landmark", type=int, default=3)
  parser.add_argument("--search-limit", type=int, default=18)
  parser.add_argument("--clean", action="store_true")
  parser.add_argument(
    "--references-dir", type=Path, default=Path("references/wikimedia")
  )
  parser.add_argument(
    "--out",
    type=Path,
    default=Path("geo_data/regierungsviertel/wikimedia_references.json"),
  )
  args = parser.parse_args()

  args.references_dir.mkdir(parents=True, exist_ok=True)
  if args.clean:
    clean_reference_images(args.references_dir)
  manifest = build_manifest(
    per_landmark=args.per_landmark,
    search_limit=args.search_limit,
    references_dir=args.references_dir,
  )
  args.out.parent.mkdir(parents=True, exist_ok=True)
  args.out.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
  )
  write_readme(args.references_dir, args.out, manifest["records"])
  print(f"Wrote {len(manifest['records'])} Wikimedia references to {args.out}")
  return 0


if __name__ == "__main__":
  raise SystemExit(main())
