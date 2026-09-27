import {centre} from '../geometry.ts';
import {choice} from '../options/Param.ts';
import {transition} from './define.ts';

export const IRIS = transition({
  about: 'A circle opens to reveal the new layout, or closes on the old one.',
  when: 'A change that should draw the eye to the centre of the new layout.',
  duration: 0.6,
  params: {
    dir: choice(['OPEN', 'CLOSE'] as const, {
      about: 'OPEN: the new layout grows out of a circle. CLOSE: the old layout shrinks into one.',
      default: 'OPEN',
    }),
  },
  layers: ({from, to, k, frame}, {dir}) => {
    // the circle must reach the farthest corner of the frame to uncover everything
    const reach = (c: {x: number; y: number}) =>
      Math.hypot(Math.max(c.x, frame.w - c.x), Math.max(c.y, frame.h - c.y));
    if (dir === 'OPEN') {
      const c = centre(to);
      return [{rect: from}, {rect: to, clip: `circle(${k * reach(c)}px at ${c.x}px ${c.y}px)`}];
    }
    const c = centre(from);
    return [{rect: to}, {rect: from, clip: `circle(${(1 - k) * reach(c)}px at ${c.x}px ${c.y}px)`}];
  },
});
