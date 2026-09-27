/* Every constant that shapes a layout. Nothing else in the project holds any of them.

   Everything here was designed against a 1080x1920 canvas; `scaleOf(frame)` carries the design
   to the real composition size, so a horizontal recording gets the same relative layout
   instead of a canvas that does not match its own frame. Radii and the caption's own size are
   not scaled: they are about how big things read, not where they sit. */
import type {Frame} from '../geometry.ts';

export const DESIGN = {w: 1080, h: 1920};

export const scaleOf = (frame: Frame) => ({x: frame.w / DESIGN.w, y: frame.h / DESIGN.h});

/* SPLIT: the video takes what is left under the graphic and the caption. */
export const SPLIT_GAP_ABOVE_CAPTION = 40;   // between the graphic's bottom and the caption block
export const SPLIT_GAP_BELOW_CAPTION = 50;   // between the caption block and the video's top edge
export const SPLIT_DEFAULT_BOTTOM = 500;     // the graphic's bottom when the scene states none

/* LOWER: a small card low on the screen. */
export const LOWER_CARD = {x: 350, y: 1370, w: 380, h: 520, r: 32};

/* The caption's bottom edge on FULL/HIDDEN: 1560 on a 1920-tall canvas — inside the
   platform's caution belt but clear of its bottom buttons — expressed as a share of the
   height so it holds at any size. */
export const CAPTION_BOTTOM = 360 / 1920;

/* Where the caption rides a seam (SPLIT/LOWER): the share of its own rendered height that
   sits ABOVE the seam line (the rest sits below) — ties the graphic and the video halves of
   the screen together instead of reading as two stuck-on pieces. */
export const CAPTION_SEAM_BIAS = 0.42;

/* The overlay band FULL and HIDDEN reserve for a scene: no video card to size it against, so
   it is a fixed share of the frame, clear of the top safe zone and the face. */
export const OVERLAY_SCENE_BAND = {top: 0.06, height: 0.34};

/* Pacing budgets, enforced by layouts/index.ts's audit (options/check.ts runs it at sync).
   Only FULL keeps the face alone on screen; every other layout counts against these. */
export const HOOK_SECONDS = 3.5;          // the opening must be FULL for at least this long
export const MAX_NON_FULL_SHARE = 0.5;    // at most half the video outside FULL, total
export const MAX_NON_FULL_RUN = 8.0;      // at most this many seconds of non-FULL in a row
