import {centre, clamp01} from '../geometry.ts';
import type {Rect} from '../geometry.ts';
import {number} from '../options/Param.ts';
import {transition} from './define.ts';

const smooth = (k: number, a: number, b: number) => {
  const x = clamp01((k - a) / (b - a));
  return x * x * (3 - 2 * x);
};
const origin = (r: Rect) => `${centre(r).x}px ${centre(r).y}px`;

export const ZOOM_BLUR = transition({
  about: 'The old layout zooms in and blurs away; the new one comes out of the blur.',
  when: 'An energetic change, for a punchline or a switch of subject.',
  duration: 0.5,
  params: {
    strength: number({about: 'How far it zooms and how blurred it gets.', default: 1, min: 0.2, max: 2}),
  },
  layers: ({from, to, k}, {strength}) => {
    const swap = smooth(k, 0.3, 0.7);            // 0 -> 1 across the middle of the change
    return [
      {rect: from, opacity: 1 - swap, transform: `scale(${1 + 0.4 * strength * k})`, origin: origin(from),
        filter: `blur(${28 * strength * k}px)`},
      {rect: to, opacity: swap, transform: `scale(${1 + 0.4 * strength * (1 - k)})`, origin: origin(to),
        filter: `blur(${28 * strength * (1 - k)}px)`},
    ];
  },
});
