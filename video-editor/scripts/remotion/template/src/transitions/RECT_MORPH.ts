import {lerpRect} from '../geometry.ts';
import {transition} from './define.ts';

export const RECT_MORPH = transition({
  about: 'The video card glides and resizes from the old layout to the new one.',
  when: 'The default. Fits almost every change of layout.',
  duration: 0.42,
  params: {},
  layers: ({from, to, k}) => [{rect: lerpRect(from, to, k)}],
});
