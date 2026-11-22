export type StudioMode = "edit" | "split" | "3d";

export function hasWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return Boolean(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** 2D + 3D on large screens with WebGL; 2D otherwise (small screens keep the editor in view and load 3D on demand). */
export function preferredMode(webgl: boolean, viewportWidth: number): StudioMode {
  return webgl && viewportWidth >= 1024 ? "split" : "edit";
}
