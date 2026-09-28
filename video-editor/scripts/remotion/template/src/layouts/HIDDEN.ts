import {CAPTION_BOTTOM} from './constants.ts';
import {layout} from './define.ts';

export const HIDDEN = layout({
  about: 'No face on screen: an ambient background carries the picture and the scene draws on top. '
    + 'The voice keeps playing.',
  when: 'One dense, data-heavy beat (a statistic, a list, a price) that a graphic explains better than a '
    + 'talking head. Rarer than SPLIT: never for more than 8 seconds in a row. Always give it a scene.',
  params: {},
  arrange: ({frame}) => ({
    video: null,
    face: {x: 0.5, y: 0.4, h: 0.5},   // unused: there is no video to frame
    caption: {y: frame.h * CAPTION_BOTTOM, align: 'BOTTOM'},
    scene: {x: 0, y: 0, w: frame.w, h: frame.h, r: 0},
  }),
});
