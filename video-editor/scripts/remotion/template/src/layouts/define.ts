import type {Params, ParamSet} from '../options/Param.ts';
import type {Arrangement, Context} from './types.ts';

/* Declares a layout. `arrange` answers where the video, and the caption, go for this frame
   size, caption height and scene. */
export function layout<S extends ParamSet>(d: {
  about: string;
  when?: string;
  params: S;
  arrange: (ctx: Context, p: Params<S>) => Arrangement;
}) {
  return d;
}
