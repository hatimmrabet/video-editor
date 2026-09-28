import {number} from '../options/Param.ts';
import {scene} from './define.ts';

export const SUSPENSE = scene({
  about: 'Rings pulsing outward from a point on the video card.',
  when: 'Building tension: a pause before a reveal.',
  overlay: true,
  params: {
    rings: number({about: 'How many rings pulse at once.', default: 2, min: 1, max: 6, whole: true}),
    x: number({about: 'Horizontal position of the centre, as a share of the video card\'s own width.', default: 0.5, min: 0, max: 1}),
    y: number({about: 'Vertical position of the centre, as a share of the video card\'s own height.', default: 0.5, min: 0, max: 1}),
  },
});
