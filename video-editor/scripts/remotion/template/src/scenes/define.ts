import type {Env} from '../options/domain.ts';
import type {Params, ParamSet} from '../options/Param.ts';

/* Declares a scene.

   `bottom` is how far down the graphic reaches, in design pixels (a 1080x1920 canvas): the SPLIT
   layout leaves the video that much room. A function when it depends on the parameters (more
   rows make a taller graphic).

   `overlay` scenes are drawn over the video card and animate themselves; the others enter and
   leave with the standard rise (transitions/constants.ts).

   `check` reports what only the outside world can tell, such as a missing file. */
export function scene<S extends ParamSet>(d: {
  about: string;
  when?: string;
  bottom: number | ((p: Params<S>) => number);
  overlay?: boolean;
  params: S;
  check?: (p: Params<S>, env: Env) => string[];
}) {
  return d;
}
