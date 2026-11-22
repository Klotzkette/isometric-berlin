// Build-only optional accelerator. All produced files are standard gzip.
import { dlopen, FFIType, ptr } from "bun:ffi";

const api = {
  libdeflate_alloc_compressor: { args: [FFIType.i32], returns: FFIType.ptr },
  libdeflate_free_compressor: { args: [FFIType.ptr], returns: FFIType.void },
  libdeflate_gzip_compress_bound: { args: [FFIType.ptr, FFIType.usize], returns: FFIType.usize },
  libdeflate_gzip_compress: {
    args: [FFIType.ptr, FFIType.ptr, FFIType.usize, FFIType.ptr, FFIType.usize], returns: FFIType.usize,
  },
} as const;

export function openOfflineGzip() {
  const names = process.platform === "darwin" ? ["libdeflate.0.dylib", "libdeflate.dylib"] :
    process.platform === "win32" ? ["deflate.dll", "libdeflate.dll"] : ["libdeflate.so.0", "libdeflate.so"];
  for (const name of names) {
    let library;
    try {
      library = dlopen(name, api);
    } catch {
      continue;
    }
    const impl = library.symbols;
    const compressor = impl.libdeflate_alloc_compressor(12);
    if (!compressor) {
      library.close();
      throw Error("Cannot allocate offline gzip compressor");
    }
    return {
      compress(source: Buffer): Buffer {
        const capacity = Number(impl.libdeflate_gzip_compress_bound(compressor, source.length));
        const data = Buffer.allocUnsafe(capacity);
        const length = Number(impl.libdeflate_gzip_compress(compressor, ptr(source), source.length, ptr(data), capacity));
        if (!length) throw Error("Cannot gzip offline tile");
        return data.subarray(0, length);
      },
      close() {
        impl.libdeflate_free_compressor(compressor);
        library.close();
      },
    };
  }
}
