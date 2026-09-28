/* Filters: the look given to the person's video. An entry's `video.filter` chooses one; without
   it the image is left exactly as it was shot — unless the project's `grade` setting is on.

   Each option has its own file, named after its keyword, and answers `css(params)`. Adding a
   filter means adding a file here and one line below. */
import {defineDomain, locate} from '../options/domain.ts';
import type {Spec} from '../options/domain.ts';
import {BLACK_AND_WHITE} from './BLACK_AND_WHITE.ts';
import {SEPIA} from './SEPIA.ts';
import {GRADE} from './GRADE.ts';

export const FILTERS = defineDomain(
  'filter',
  {BLACK_AND_WHITE, SEPIA, GRADE},
  {
    audit: plan => (plan.pieces ?? []).flatMap((piece: any) =>
      piece.filter == null ? [] : FILTERS.problems(piece.filter, locate(piece))),
  },
);

const cache = new Map<string, string>();

/* The CSS `filter` for a piece of footage: its own choice, else GRADE when the project asks
   for a grade, else none (undefined). */
export function css(spec: Spec | null | undefined, grade: boolean): string | undefined {
  const choice = spec ?? (grade ? 'GRADE' : null);
  if (choice == null) return undefined;
  const key = JSON.stringify(choice);
  let out = cache.get(key);
  if (out === undefined) {
    const {option, params} = FILTERS.parse(choice);
    out = (option.css as (p: Record<string, any>) => string)(params);
    cache.set(key, out);
  }
  return out;
}
