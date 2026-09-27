import {number} from '../options/Param.ts';
import {scene} from './define.ts';

export const GLITCH = scene({
  about: 'The picture tears into shifted coloured slices, then cracks.',
  when: 'Something breaks: an error, a failure, a shock.',
  bottom: 0,
  overlay: true,
  params: {
    intensity: number({about: 'How violent the tearing is.', default: 1, min: 0.2, max: 3}),
    slices: number({about: 'How many slices the picture tears into.', default: 16, min: 4, max: 48, whole: true}),
  },
});
