import {CAPTION_BOTTOM, OVERLAY_SCENE_BAND} from './constants.ts';
import {layout} from './define.ts';

export const FULL = layout({
  about: 'The face fills the screen; the caption sits near the bottom. The default.',
  when: 'Most of the time: a hook, a peak, a question to the viewer, any moment with no graphic. '
    + 'The first 3 to 4 seconds are always FULL.',
  params: {},
  arrange: ({frame}) => ({
    video: {x: 0, y: 0, w: frame.w, h: frame.h, r: 0},
    face: {x: 0.5, y: 0.38, h: 0.62},
    caption: {y: frame.h * CAPTION_BOTTOM, align: 'BOTTOM'},
    scene: {x: 0, y: frame.h * OVERLAY_SCENE_BAND.top, w: frame.w, h: frame.h * OVERLAY_SCENE_BAND.height, r: 0},
  }),
});
