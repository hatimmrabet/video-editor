import {transition} from './define.ts';
import {direction, travel} from './direction.ts';

export const PUSH = transition({
  about: 'The old layout is pushed off the screen by the new one, both sliding together.',
  when: 'A change that should feel like turning to the next page.',
  duration: 0.45,
  params: {
    dir: direction('Where the old layout is pushed toward: UP slides it out through the top.'),
  },
  layers: ({from, to, k, frame}, {dir}) => {
    const [dx, dy] = travel(dir, frame);
    return [
      {rect: from, transform: `translate(${dx * k}px, ${dy * k}px)`},
      {rect: to, transform: `translate(${-dx * (1 - k)}px, ${-dy * (1 - k)}px)`},
    ];
  },
});
