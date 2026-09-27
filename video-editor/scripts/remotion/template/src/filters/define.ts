import type {Params, ParamSet} from '../options/Param.ts';

/* Declares a filter. `css` answers the CSS `filter` value that gives the person's video its
   look, for the parameters the author chose. */
export function filter<S extends ParamSet>(d: {
  about: string;
  when?: string;
  params: S;
  css: (p: Params<S>) => string;
}) {
  return d;
}
