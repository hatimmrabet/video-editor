/* Every domain, by kind. Each one audits the part of the render plan it is responsible for;
   check.ts runs them all. The drawing code never imports this file: it reads the domains
   directly. */
import {FILTERS} from '../filters/index.ts';
import {LAYOUTS} from '../layouts/index.ts';
import {SCENES} from '../scenes/index.ts';
import {EASINGS, TRANSITIONS} from '../transitions/index.ts';

export const DOMAINS = {layout: LAYOUTS, transition: TRANSITIONS, easing: EASINGS, scene: SCENES, filter: FILTERS};
