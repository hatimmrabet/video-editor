import {transition} from './define.ts';
import {direction} from './direction.ts';

export const WIPE = transition({
  about: 'A hard edge sweeps across the screen and uncovers the new layout behind it.',
  when: 'A confident change of layout, for example into a new topic.',
  duration: 0.45,
  params: {
    dir: direction('Where the edge travels: UP uncovers the new layout from the bottom edge upward.'),
  },
  layers: ({from, to, k, frame}, {dir}) => {
    const behind = (1 - k);                      // the share of the frame the edge has yet to cross
    const clip = dir === 'UP' ? `inset(${behind * frame.h}px 0 0 0)`
      : dir === 'DOWN' ? `inset(0 0 ${behind * frame.h}px 0)`
      : dir === 'LEFT' ? `inset(0 0 0 ${behind * frame.w}px)`
      : `inset(0 ${behind * frame.w}px 0 0)`;
    return [{rect: from}, {rect: to, clip}];
  },
});
