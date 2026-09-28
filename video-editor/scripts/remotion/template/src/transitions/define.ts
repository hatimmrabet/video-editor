import {choice, number} from '../options/Param.ts';
import type {Params, ParamSet} from '../options/Param.ts';
import {EASINGS} from './easings.ts';
import type {Layer, Move} from './types.ts';

export type Timing = {duration: number; easing: string};

/* Declares a transition. Every one takes a `duration` and an `easing`; the builder adds
   them, with this transition's own default duration, so each one only declares what is
   particular to it. `layers` answers: which cards are drawn, and how, at this instant. */
export function transition<S extends ParamSet>(d: {
  about: string;
  when?: string;
  duration: number;
  easing?: string;
  params: S;
  layers: (move: Move, p: Params<S> & Timing) => Layer[];
}) {
  return {
    about: d.about,
    when: d.when,
    params: {
      duration: number({about: 'How long the change takes, in seconds.', default: d.duration, min: 0.05, max: 5}),
      easing: choice(EASINGS.names, {about: 'How the change accelerates.', default: d.easing ?? 'EASE_IN_OUT'}),
      ...d.params,
    },
    layers: d.layers,
  };
}
