import {CAPTION_BOTTOM, SAFE_TOP} from './constants.ts';
import {layout} from './define.ts';

// A natural selfie/webcam shot measures the face at roughly 25-30% of frame height; this is a
// gentle punch-in over that, not a headshot — leaves shoulders, hands and whatever is behind
// the speaker in frame, room the caption and the scene above the head both need.
const FACE = {x: 0.5, y: 0.38, h: 0.34};

export const FULL = layout({
  about: 'The face fills the screen; the caption sits near the bottom. The default.',
  when: 'Most of the time: a hook, a peak, a question to the viewer, any moment with no graphic. '
    + 'The first 3 to 4 seconds are always FULL.',
  params: {},
  arrange: ({frame}) => {
    // The scene draws in the headroom ABOVE the face — derived from FACE itself, not a band
    // sized independently of it, so the two can never drift apart the way a hand-picked band
    // height and a later-retuned face size once quietly could.
    const faceTop = FACE.y - FACE.h / 2;
    return {
      video: {x: 0, y: 0, w: frame.w, h: frame.h, r: 0},
      face: FACE,
      caption: {y: frame.h * CAPTION_BOTTOM, align: 'BOTTOM'},
      scene: {x: 0, y: frame.h * SAFE_TOP, w: frame.w, h: frame.h * Math.max(0, faceTop - SAFE_TOP), r: 0},
    };
  },
});
