"use client";

import type { InferenceSession } from "onnxruntime-web/wasm";
import { pixels, type Pixels } from "./image-ops";
import { U2NET_SIZE, applyMask, u2netInput } from "./segment-ops";

/**
 * E22 — automatic background removal in the browser (U²-Net small, ONNX Runtime WebAssembly). Engine and model are
 * served by SAWWA (public/ort, public/models), downloaded on first use only, then cached by the browser.
 * No image leaves the device.
 */
let session: Promise<{ ort: typeof import("onnxruntime-web/wasm"); s: InferenceSession }> | null = null;

function load() {
  session ??= (async () => {
    const ort = await import("onnxruntime-web/wasm");
    ort.env.wasm.wasmPaths = "/ort/";
    ort.env.wasm.numThreads = 1; // no cross-origin isolation needed
    const s = await ort.InferenceSession.create("/models/u2netp.onnx", { executionProviders: ["wasm"] });
    return { ort, s };
  })().catch((e) => { session = null; throw e; });
  return session;
}

function resized(img: Pixels, w: number, h: number): Pixels {
  const src = document.createElement("canvas");
  src.width = img.width; src.height = img.height;
  src.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, w, h);
  return pixels(w, h, ctx.getImageData(0, 0, w, h).data);
}

export async function removeBackgroundAI(img: Pixels): Promise<Pixels> {
  const { ort, s } = await load();
  const input = new ort.Tensor("float32", u2netInput(resized(img, U2NET_SIZE, U2NET_SIZE)), [1, 3, U2NET_SIZE, U2NET_SIZE]);
  const result = await s.run({ [s.inputNames[0]!]: input });
  const mask = result[s.outputNames[0]!]!.data as Float32Array; // d0: the fused, finest saliency map
  return applyMask(img, mask, U2NET_SIZE, U2NET_SIZE);
}
