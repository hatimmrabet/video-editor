import {CAPTION_BOTTOM, FACE_HEIGHT, SAFE_TOP} from './constants.ts';
import {layout} from './define.ts';

const FACE = {x: 0.5, y: 0.38, h: FACE_HEIGHT};

// find_face.py's detector boxes roughly eyebrows-to-chin: real hair reaches meaningfully
// higher than that box's own top edge, a gap a scene must clear too, not just the box itself.
const HAIR_MARGIN = 0.05;

export const FULL = layout({
  about: 'The face fills the screen; the caption sits near the bottom. The default.',
  when: 'Most of the time: a hook, a peak, a question to the viewer, any moment with no graphic. '
    + 'The first 3 to 4 seconds are always FULL.',
  params: {},
  arrange: ({frame}) => {
    // The scene draws in the headroom ABOVE the face — derived from FACE itself, not a band
    // sized independently of it, so the two can never drift apart the way a hand-picked band
    // height and a later-retuned face size once quietly could.
    const faceTop = FACE.y - FACE.h / 2 - HAIR_MARGIN;
    return {
      video: {x: 0, y: 0, w: frame.w, h: frame.h, r: 0},
      face: FACE,
      caption: {y: frame.h * CAPTION_BOTTOM, align: 'BOTTOM'},
      scene: {x: 0, y: frame.h * SAFE_TOP, w: frame.w, h: frame.h * Math.max(0, faceTop - SAFE_TOP), r: 0},
    };
  },
});
