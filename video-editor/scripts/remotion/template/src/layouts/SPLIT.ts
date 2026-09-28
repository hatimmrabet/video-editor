import {FACE_HEIGHT, SPLIT_CAPTION_CLEARANCE, SPLIT_SCENE_RESERVE} from './constants.ts';
import {layout} from './define.ts';

export const SPLIT = layout({
  about: 'The frame cut clean in two, a fixed 50/50: the top half is pure design — a scene on '
    + 'the theme background, nothing of the person in it, the caption included — the bottom '
    + 'half the face alone, centred, nothing else drawn into it, like two separate images '
    + 'collaged together rather than one shot with a graphic laid over part of it.',
  when: 'Whenever there is a graphic to show. Never for the first 3 to 4 seconds, never for more '
    + 'than half of the video, never for more than 8 seconds in a row. No graphic at this moment? '
    + 'Then FULL.',
  params: {},
  arrange: ({frame}) => {
    const seam = frame.h * 0.5;
    return {
      video: {x: 0, y: seam, w: frame.w, h: frame.h - seam, r: 0},
      face: {x: 0.5, y: 0.5, h: FACE_HEIGHT},
      caption: {y: frame.h - seam + SPLIT_CAPTION_CLEARANCE, align: 'BOTTOM'},
      scene: {x: 0, y: 0, w: frame.w, h: Math.max(0, seam - SPLIT_SCENE_RESERVE), r: 0},
    };
  },
});
