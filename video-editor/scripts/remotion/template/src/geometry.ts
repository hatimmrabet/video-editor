/* Plain geometry shared by every drawing domain (layouts, transitions, scenes).
   No project data and no React, so it also loads under plain Node — which is what lets the
   `options` command list the domains without a build step. */

export type Frame = {w: number; h: number};

/* r is the corner radius. */
export type Rect = {x: number; y: number; w: number; h: number; r: number};

export const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const lerpRect = (a: Rect, b: Rect, k: number): Rect =>
  ({x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k), r: lerp(a.r, b.r, k)});

export const centre = (r: Rect) => ({x: r.x + r.w / 2, y: r.y + r.h / 2});
