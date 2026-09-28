import {flag, number, text} from '../options/Param.ts';
import {scene} from './define.ts';

export const COUNTER = scene({
  about: 'A number that rolls, then lands on its final value with a beat.',
  when: 'The speaker gives a number: a price, a score, a percentage, a count.',
  params: {
    to: number({about: 'The final value.', required: true}),
    from: number({about: 'The value it rolls from.', default: 0}),
    title: text({about: 'Label above the number.'}),
    prefix: text({about: 'Written before the number, such as a currency sign.'}),
    suffix: text({about: 'Written after the number, such as % or a unit.'}),
    decimals: number({about: 'Digits after the decimal point. Default: 2 when `to` has a decimal part, otherwise 0.', min: 0, max: 6, whole: true}),
    settleAt: number({about: 'When the number stops rolling and lands, as a share of the scene.', default: 0.55, min: 0.1, max: 0.9}),
    scramble: flag({about: 'Show random digits while it rolls (otherwise it waits at `from`).', default: true}),
  },
});
