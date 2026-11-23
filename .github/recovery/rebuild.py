"""Regenerate already-audited release assets without rebuilding the Vite bundle."""
import base64
import concurrent.futures
import ctypes as C
import gzip
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import threading

tag, src_arg, pages_arg, output_arg, library_arg = sys.argv[1:]
src, pages, output, library = map(Path, [src_arg, pages_arg, output_arg, library_arg])
sha = lambda buf: hashlib.sha256(buf).hexdigest()
def file_hash(path):
    with path.open('rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()
assert file_hash(library) == '1f21f19cb8406b030cdf01b598ff399e084618e53164b56c813d8c2cd6e88aca'
receipt=json.loads(Path(__file__).with_name('receipts.json').read_text())[tag]
spec=importlib.util.spec_from_file_location('release_packager',src/'scripts/package_static_site.py')
pkg=importlib.util.module_from_spec(spec)
spec.loader.exec_module(pkg)
assert tag=='v'+pkg.PACKAGE_VERSION
output.mkdir()
stage=output.parent/'staging'
stage.mkdir()
site=stage/pkg.PACKAGE_NAME
site.mkdir()

# Cross-directory links are only used for read-only data. Normalize archive
# permissions on the isolated package tree; do not chmod the Git checkout.
def copy_member(source, dest, executable=False):
    dest.parent.mkdir(parents=True,exist_ok=True)
    with source.open('rb') as reader,dest.open('wb') as writer:
        import shutil
        shutil.copyfileobj(reader,writer, 1024*1024)
    dest.chmod(0o711 if executable else 0o600)

for p in pages.rglob('*'):
    rel=p.relative_to(pages)
    if any(part.startswith('.') for part in rel.parts) or not p.is_file(): continue
    if p.is_symlink():raise ValueError(f'unexpected Pages symlink {rel}')
    copy_member(p,site/rel,p.name in pkg.EXECUTABLE_PACKAGE_FILES)
pkg.zip_package(site,output/(pkg.PACKAGE_NAME+'-compact.zip'))

relative=Path('mesh/surrounding-berlin-v159')
source_tiles=src/'src/app/public'/relative
target_tiles=site/relative
raw_manifest=(source_tiles/'manifest.json').read_text()
manifest=json.loads(raw_manifest)
selection=json.loads((src/'src/app/scripts/offline-delta-selection.json').read_text())
mask=base64.b64decode(selection['maskBase64'])
assets=[(chunk,chunk[mode]) for chunk in manifest['chunks'] for mode in ('drawn','minecraft')]
selected=[a for index,(c,a) in enumerate(assets) if index//8<len(mask) and mask[index//8] & (1<<(index%8))]
assert len(selected)==selection['candidateCount']
# Starting in v1.0.256 a second finite mask admits plain gzip, independently
# of the earlier delta candidates. Raw manifest bytes guard its ordering.
if 'plainGzipMaskBase64' in selection:
    if sha(raw_manifest.encode()) != selection['plainGzipManifestSha256']:
        raise ValueError('Unexpected source manifest for plain gzip')
    plain_mask = base64.b64decode(selection['plainGzipMaskBase64'],validate=True)
    if len(plain_mask) != (len(assets)+7)//8:
        raise ValueError('Unexpected size of plain gzip mask')
    if any(a & b for a,b in zip(mask,plain_mask)):
        raise ValueError('Plain gzip mask overlaps earlier candidates')
    plain = [a for index,(_,a) in enumerate(assets)
             if plain_mask[index//8] & (1<<(index%8))]
    if len(plain) != selection['plainGzipCount']:
        raise ValueError('Unexpected size of plain gzip selection')
    selected.extend(plain)
assert {p.relative_to(source_tiles) for p in source_tiles.rglob('*') if p.is_file()}=={
    p.relative_to(target_tiles) for p in target_tiles.rglob('*') if p.is_file()}
for p in source_tiles.rglob('*'):
    if p.is_file():copy_member(p,target_tiles/p.relative_to(source_tiles))

# Byte-identical implementation of compact-offline-tiles.ts mode gzip using
# the very same Debian libdeflate build. Only replace smaller, lossless gzip.
lib=C.CDLL(str(library.resolve()))
ptr=C.c_void_p; size=C.c_size_t
alloc=lib.libdeflate_alloc_compressor;alloc.argtypes=[C.c_int];alloc.restype=ptr
bound=lib.libdeflate_gzip_compress_bound;bound.argtypes=[ptr,size];bound.restype=size
encode=lib.libdeflate_gzip_compress;encode.argtypes=[ptr,ptr,size,ptr,size];encode.restype=size
local=threading.local()
def compress_tile(asset):
    path=target_tiles/asset['url']
    packed=path.read_bytes()
    assert len(packed)==asset['bytes'] and sha(packed)==asset['sha256']
    raw=gzip.decompress(packed)
    assert len(raw)==asset['decodedBytes']
    if not hasattr(local,'compressor'):
        local.compressor=alloc(12)
        if not local.compressor:raise MemoryError()
    cap=bound(local.compressor,len(raw))
    buffer=C.create_string_buffer(cap)
    written=encode(local.compressor,raw,len(raw),buffer,cap)
    assert written>0
    if written>=len(packed):return None
    data=buffer.raw[:written]
    assert gzip.decompress(data)==raw
    path.write_bytes(data)
    return {**asset,'bytes':len(data),'sha256':sha(data)}

with concurrent.futures.ThreadPoolExecutor(max_workers=min(4,os.cpu_count() or 1)) as pool:
    changed={a['url']:a for a in pool.map(compress_tile,selected) if a}
for _, a in assets:
    if a['url'] in changed: a.update(changed[a['url']])
used=set()
def update(match):
    key=json.loads(match[0])['url']
    if key not in changed or key in used:return match[0]
    used.add(key)
    return json.dumps(changed[key],separators=(',',':'),ensure_ascii=False)
new_manifest=re.sub(r'\{[^{}]*"url"\s*:\s*"[^"]+\.json\.gz"[^{}]*\}',update,raw_manifest)
assert used==set(changed) and json.loads(new_manifest)==manifest
(target_tiles/'manifest.json').write_text(new_manifest)
pkg.write_package_manifest(site)
pkg.zip_package(site,output/(pkg.PACKAGE_NAME+'.zip'))
pkg.tar_static_site(site,output/pkg.STATIC_ARCHIVE_NAME)
actual={p.name:file_hash(p) for p in output.iterdir()}
print(json.dumps(actual,indent=2),flush=True)
if actual!=receipt['sha256']:raise SystemExit('SHA-256 mismatch; assets must not be uploaded')
