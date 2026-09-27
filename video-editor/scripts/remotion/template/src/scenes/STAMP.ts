import {flag, number, text} from '../options/Param.ts';
import {scene} from './define.ts';

export const STAMP = scene({
  about: 'A label stamped onto the screen, with a ring that pulses outward.',
  when: 'A short punchy label: "3 steps", "FREE", a verdict.',
  bottom: 400,
  params: {
    text: text({about: 'The label.', required: true}),
    lead: text({about: 'A smaller word written before the label.'}),
    rotation: number({about: 'Tilt in degrees.', default: -7, min: -30, max: 30}),
    ring: flag({about: 'Pulse a ring outward when the label lands.', default: true}),
    x: number({about: 'Horizontal position of the label\'s centre, as a share of the scene area\'s own width.', default: 0.5, min: 0, max: 1}),
    y: number({about: 'Vertical position of the label\'s centre, as a share of the scene area\'s own height.', default: 0.5, min: 0, max: 1}),
  },
});
