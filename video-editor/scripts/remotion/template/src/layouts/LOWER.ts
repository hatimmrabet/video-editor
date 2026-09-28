import {LOWER_CARD, scaleOf} from './constants.ts';
import {layout} from './define.ts';

export const LOWER = layout({
  about: 'A big panel on top; the face shrinks to a small card low on the screen. The '
    + 'caption moves above the card, on its seam.',
  when: 'B-roll or a large panel (lists, comparisons, tables) that the top half alone cannot hold.',
  params: {},
  arrange: ({frame}) => {
    const s = scaleOf(frame), c = LOWER_CARD;
    const video = {x: c.x * s.x, y: c.y * s.y, w: c.w * s.x, h: c.h * s.y, r: c.r};
    return {
      video,
      // The card itself is already small and tight, so this stays higher than FULL/SPLIT's
      // share of their own rect — but still well short of filling the card edge to edge.
      face: {x: 0.5, y: 0.42, h: 0.58},
      caption: {y: video.y, align: 'SEAM'},
      scene: {x: 0, y: 0, w: frame.w, h: video.y, r: 0},
    };
  },
});
