// Copies the ONNX Runtime WebAssembly files next to the site (public/ort) so the browser loads them from SAWWA,
// not from a third-party CDN. Run before `next dev` and `next build`.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("onnxruntime-web/ort-wasm-simd-threaded.wasm"));
const out = path.join(import.meta.dirname, "..", "public", "ort");
mkdirSync(out, { recursive: true });
for (const f of ["ort-wasm-simd-threaded.wasm", "ort-wasm-simd-threaded.mjs"]) copyFileSync(path.join(dist, f), path.join(out, f));
console.log("onnxruntime-web files copied to public/ort");
