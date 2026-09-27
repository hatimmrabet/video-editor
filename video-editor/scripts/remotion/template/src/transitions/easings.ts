/* The easing curves — how a change accelerates. The single definition: transitions, scene
   enter/exit and captions all read these, nothing redraws them. Pure maths, no React. */
import {defineDomain} from '../options/domain.ts';
import {number} from '../options/Param.ts';
import type {Params, ParamSet} from '../options/Param.ts';

function easing<S extends ParamSet>(d: {about: string; params: S; curve: (k: number, p: Params<S>) => number}) {
  return d;
}

const LINEAR = easing({
  about: 'Constant speed.',
  params: {},
  curve: k => k,
});

const EASE_OUT = easing({
  about: 'Starts fast and settles gently (out-cubic).',
  params: {},
  curve: k => 1 - Math.pow(1 - k, 3),
});

const EASE_IN_OUT = easing({
  about: 'Gentle start and end, quick in the middle (in-out-cubic).',
  params: {},
  curve: k => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
});

const BACK = easing({
  about: 'Overshoots its target, then settles back (out-back).',
  params: {
    overshoot: number({about: 'How far past the target it swings.', default: 1.9, min: 0, max: 4}),
  },
  curve: (k, {overshoot}) => 1 + (overshoot + 1) * Math.pow(k - 1, 3) + overshoot * Math.pow(k - 1, 2),
});

export const EASINGS = defineDomain('easing', {LINEAR, EASE_OUT, EASE_IN_OUT, BACK}, {fallback: 'EASE_IN_OUT'});

export type EasingName = (typeof EASINGS.names)[number];

const curves = new Map<string, (k: number) => number>();

/* progress 0..1 -> eased progress 0..1, for a named easing at its default parameters. */
export function ease(name: string = 'EASE_IN_OUT'): (k: number) => number {
  let f = curves.get(name);
  if (!f) {
    const {option, params} = EASINGS.parse(name);
    const curve = option.curve as (k: number, p: Record<string, any>) => number;
    f = (k: number) => curve(k, params);
    curves.set(name, f);
  }
  return f;
}
