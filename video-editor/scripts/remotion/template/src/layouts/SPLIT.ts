import {number} from '../options/Param.ts';
import {SPLIT_DEFAULT_BOTTOM, SPLIT_GAP_ABOVE_CAPTION, SPLIT_GAP_BELOW_CAPTION, scaleOf} from './constants.ts';
import {layout} from './define.ts';

export const SPLIT = layout({
  about: 'A graphic on top, the face below at full width, the caption on the seam between '
    + 'them. The video card shrinks to leave room for the graphic and the caption.',
  when: 'Only while a scene is on screen. Never for the first 3 to 4 seconds, never for more than '
    + 'half of the video, never for more than 8 seconds in a row. No graphic at this moment? Then FULL.',
  params: {
    gb: number({
      about: 'Bottom edge of the graphic, in design pixels (a 1080x1920 canvas). Default: what the scene asks for.',
      min: 0, max: 1920,
    }),
  },
  arrange: ({frame, captionHeight, sceneBottom}, {gb}) => {
    const bottom = gb ?? sceneBottom ?? SPLIT_DEFAULT_BOTTOM;
    const seam = bottom * scaleOf(frame).y + SPLIT_GAP_ABOVE_CAPTION + captionHeight() + SPLIT_GAP_BELOW_CAPTION;
    return {
      video: {x: 0, y: seam, w: frame.w, h: frame.h - seam, r: 0},
      // A share of THIS rect's own (already reduced) height, not the full frame's — sized so
      // the face reads clearly in the room left under the graphic without filling it edge to
      // edge the way FULL's own, taller target would.
      face: {x: 0.5, y: 0.46, h: 0.44},
      caption: {y: seam, align: 'SEAM'},
      scene: {x: 0, y: 0, w: frame.w, h: seam, r: 0},
    };
  },
});
