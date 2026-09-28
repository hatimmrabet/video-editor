import {number} from '../options/Param.ts';
import {filter} from './define.ts';

export const SEPIA = filter({
  about: 'A warm brown tint, like an old photograph.',
  when: 'Only when the creator asks for it: a memory or a story from the past. Never by default.',
  params: {
    amount: number({about: '0 = colour, 1 = full sepia.', default: 0.8, min: 0, max: 1}),
  },
  css: ({amount}) => `sepia(${amount})`,
});
