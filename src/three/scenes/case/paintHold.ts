import type { Visual } from "../../../content/schema";

export function isStageVisual(v: Visual): boolean {
  return (
    v.kind === "organ" || v.kind === "specimen" || v.kind === "plantanimal"
  );
}

export function visualToken(v: Visual): string {
  if (v.kind === "organ") return `organ:${v.highlight.join(",")}`;
  if (v.kind === "specimen") return `specimen:${v.ids.join(",")}`;
  if (v.kind === "plantanimal") return `plant:${v.show.join(",")}`;
  return v.kind;
}

/** Mean absolute luma difference. A copy of the same frame scores near 0. */
export function meanAbsLumaDelta(
  a: ArrayLike<number>,
  b: ArrayLike<number>,
  stride = 4,
): number {
  const n = Math.min(
    Math.floor(a.length / stride),
    Math.floor(b.length / stride),
  );
  if (n <= 0) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    const ya = a[o] * 0.3 + a[o + 1] * 0.5 + a[o + 2] * 0.2;
    const yb = b[o] * 0.3 + b[o + 1] * 0.5 + b[o + 2] * 0.2;
    sum += Math.abs(ya - yb);
  }
  return sum / n;
}

/** Population standard deviation of luma. `stride` is 4 for RGBA. */
export function lumaSpread(data: ArrayLike<number>, stride = 4): number {
  const n = Math.floor(data.length / stride);
  if (n <= 0) return 0;
  let sum = 0;
  let sum2 = 0;
  for (let i = 0; i < n; i++) {
    const o = i * stride;
    const y = data[o] * 0.3 + data[o + 1] * 0.5 + data[o + 2] * 0.2;
    sum += y;
    sum2 += y * y;
  }
  const mean = sum / n;
  const v = sum2 / n - mean * mean;
  return Math.sqrt(v > 0 ? v : 0);
}

export interface GLContext {
  compileAsync?: (obj: any, camera: any, scene: any) => Promise<void>;
  compile: (scene: any, camera: any) => void;
  setRenderTarget: (rt: any) => void;
  getRenderTarget: () => any;
  render: (scene: any, camera: any) => void;
}

export interface RenderTargetClass {
  new (width: number, height: number): { dispose: () => void };
}

/**
 * Prepares the next visual by compiling its shaders and forcing an offscreen render
 * so its textures are uploaded to the GPU. Ensures the swap frame will not be blank.
 */
export async function prepareNextHold(
  gl: GLContext,
  scene: any,
  camera: any,
  targetGroup: { visible: boolean },
  RenderTarget: RenderTargetClass,
  setCompiling: (v: boolean) => void,
  applyFront: () => void,
): Promise<void> {
  setCompiling(true);
  targetGroup.visible = true;
  try {
    if (gl.compileAsync) {
      await gl.compileAsync(targetGroup, camera, scene);
    } else {
      gl.compile(scene, camera);
    }

    // Force an offscreen render to guarantee textures are uploaded to the GPU.
    // Without this, the first visible frame might flash dark while textures upload.
    targetGroup.visible = true;
    const rt = new RenderTarget(1, 1);
    const oldRt = gl.getRenderTarget();
    gl.setRenderTarget(rt);
    gl.render(scene, camera);
    gl.setRenderTarget(oldRt);
    rt.dispose();
  } finally {
    if (setCompiling) setCompiling(false);
    if (applyFront) applyFront();
  }
}
