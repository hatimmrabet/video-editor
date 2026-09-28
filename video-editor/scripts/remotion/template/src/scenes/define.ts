import type {Env} from '../options/domain.ts';
import type {Params, ParamSet} from '../options/Param.ts';

/* Declares a scene.

   `overlay` scenes are drawn over the video card and animate themselves; the others enter and
   leave with the standard rise (transitions/constants.ts) inside the area their layout hands
   them — a scene never sizes that area itself, every layout's own arrangement is fixed.

   `check` reports what only the outside world can tell, such as a missing file. */
export function scene<S extends ParamSet>(d: {
  about: string;
  when?: string;
  overlay?: boolean;
  params: S;
  check?: (p: Params<S>, env: Env) => string[];
}) {
  return d;
}
