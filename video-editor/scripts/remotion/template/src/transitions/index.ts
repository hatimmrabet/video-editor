/* Transitions: how the video moves from one layout to the next, and every constant that
   belongs to moving things on and off the screen (easings, enter/exit rise, the end-card
   slide). An entry's `video.in` chooses one; without it a change of layout is a RECT_MORPH.

   Each option has its own file, named after its keyword, and answers `layers(move, params)`:
   which video cards are drawn at this instant, and how. Adding a transition means adding a
   file here and one line below — nothing outside this folder lists them. */
import {defineDomain, locate} from '../options/domain.ts';
import {CUT} from './CUT.ts';
import {DISSOLVE} from './DISSOLVE.ts';
import {RECT_MORPH} from './RECT_MORPH.ts';
import {WIPE} from './WIPE.ts';
import {PUSH} from './PUSH.ts';
import {ZOOM_BLUR} from './ZOOM_BLUR.ts';
import {IRIS} from './IRIS.ts';
import {GLITCH} from './GLITCH.ts';

export const TRANSITIONS = defineDomain(
  'transition',
  {CUT, DISSOLVE, RECT_MORPH, WIPE, PUSH, ZOOM_BLUR, IRIS, GLITCH},
  {
    fallback: 'RECT_MORPH',
    audit: plan => (plan.stage ?? []).flatMap((span: any) =>
      span.transition == null ? [] : TRANSITIONS.problems(span.transition, locate(span))),
  },
);

export {EASINGS, ease} from './easings.ts';
export type {EasingName} from './easings.ts';
export {SCENE_ENTER, SCENE_EXIT, OUTRO} from './constants.ts';
export type {Rise} from './constants.ts';
export type {Layer, LayerDefs, Move} from './types.ts';
