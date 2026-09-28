/* Every constant that shapes a layout. Nothing else in the project holds any of them.

   Everything here was designed against a 1080x1920 canvas; `scaleOf(frame)` carries the design
   to the real composition size, so a horizontal recording gets the same relative layout
   instead of a canvas that does not match its own frame. Radii and the caption's own size are
   not scaled: they are about how big things read, not where they sit. */
import type {Frame} from '../geometry.ts';

export const DESIGN = {w: 1080, h: 1920};

export const scaleOf = (frame: Frame) => ({x: frame.w / DESIGN.w, y: frame.h / DESIGN.h});

/* The one face size every layout shares (FaceTarget.h — see layouts/types.ts for why this
   must be a fraction of the FULL FRAME, never of a layout's own, possibly much smaller,
   rect). A natural selfie/webcam shot measures the face at roughly 25-28% of frame height;
   this sits at or slightly below that — genuinely no punch-in, closer to zoomed OUT than "as
   shot" — because a face this close reads as cropped-in on a phone screen far more readily
   than the same framing does on a monitor. Every layout uses this one value for `h`, so the
   real-world face size a viewer sees never depends on which layout happens to be active. */
export const FACE_HEIGHT = 0.24;

/* LOWER: a small card low on the screen. */
export const LOWER_CARD = {x: 350, y: 1370, w: 380, h: 520, r: 32};

/* The caption's bottom edge on FULL/SPLIT/HIDDEN: 1560 on a 1920-tall canvas — inside the
   platform's caution belt but clear of its bottom buttons — expressed as a share of the
   height so it holds at any size. */
export const CAPTION_BOTTOM = 360 / 1920;

/* Where the caption rides a seam (LOWER only): the share of its own rendered height that
   sits ABOVE the seam line (the rest sits below) — ties the small card to the panel above it
   instead of reading as a stuck-on label. */
export const CAPTION_SEAM_BIAS = 0.42;

/* Where a scene may never start, at the very top of the frame: the platform's own UI sits in
   the first 150px of a 1920-tall canvas (SKILL.md's safe-zone table), expressed as a share of
   the height so it holds at any size. HIDDEN has no face to clear below it, so its scene uses
   the whole frame instead of this margin. */
export const SAFE_TOP = 150 / 1920;

/* Pacing budgets, enforced by layouts/index.ts's audit (options/check.ts runs it at sync).
   Only FULL keeps the face alone on screen; every other layout counts against these. */
export const HOOK_SECONDS = 3.5;          // the opening must be FULL for at least this long
export const MAX_NON_FULL_SHARE = 0.5;    // at most half the video outside FULL, total
export const MAX_NON_FULL_RUN = 8.0;      // at most this many seconds of non-FULL in a row
