import {flag, number, text} from '../options/Param.ts';
import {scene} from './define.ts';

export const QUOTE = scene({
  about: 'A short title chip at the top of the screen.',
  when: 'A key phrase, a title or a one-line message worth reading.',
  params: {
    text: text({about: 'What the chip says.', required: true}),
    accent: flag({about: 'Fill the chip with the accent colour.', default: false}),
    y: number({about: 'Where the chip sits, as a share of the scene area\'s own height.', default: 0.35, min: 0, max: 1}),
  },
});
