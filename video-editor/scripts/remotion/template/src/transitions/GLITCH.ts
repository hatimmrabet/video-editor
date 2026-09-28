import {number} from '../options/Param.ts';
import {transition} from './define.ts';

/* A number in [0, 1) that depends only on the frame — the render must be seek-safe, so no
   Math.random(): the same frame always glitches the same way. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

export const GLITCH = transition({
  about: 'The picture tears into shifted slices with split colours while it swaps to the new layout.',
  when: 'A jarring change: an error, a shock, a break in the story.',
  duration: 0.35,
  params: {
    intensity: number({about: 'How violent the tearing and colour split are.', default: 1, min: 0.2, max: 3}),
  },
  layers: ({from, to, k, tick}, {intensity}) => {
    const peak = Math.sin(Math.PI * k);                       // 0 at both ends, 1 in the middle
    // in the middle third the two layouts flicker against each other, frame by frame
    const flicker = k > 0.25 && k < 0.75 && hash(tick) > 0.5;
    const showNew = k >= 0.5 ? !flicker : flicker;
    return [{
      rect: showNew ? to : from,
      filter: 'url(#glitch)',
      defs: {glitch: {seed: tick, shift: 14 * intensity * peak, scale: 90 * intensity * peak}},
    }];
  },
});
