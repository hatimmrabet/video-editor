import {number} from '../options/Param.ts';
import {filter} from './define.ts';

export const BLACK_AND_WHITE = filter({
  about: 'The person\'s video in black and white.',
  when: 'Only when the creator asks for it: a serious or sad passage. Never by default.',
  params: {
    amount: number({about: '0 = colour, 1 = fully black and white.', default: 1, min: 0, max: 1}),
  },
  css: ({amount}) => `grayscale(${amount})`,
});
