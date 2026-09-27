/* Layouts: how the screen is arranged — where the person's video sits, where the caption
   goes, where the face is framed and where a scene draws. A segment's `layout` chooses one;
   without it the layout is FULL.

   Each option has its own file, named after its keyword, and answers `arrange(context, params)`.
   Every constant that shapes a layout is in constants.ts; nothing outside this folder holds any.
   Adding a layout means adding a file here and one line below.

   THE PACING BUDGETS (SKILL.md step 10's "don't overuse SPLIT" rule) are enforced here, not
   left as prose a render can silently ignore: the hook must be FULL, no more than half the
   video may sit outside FULL, and no run of non-FULL layouts may exceed
   `constants.MAX_NON_FULL_RUN` without a FULL shot in between. A plan that breaks one of these
   fails `options/check.ts`, naming the offending segment. */
import {defineDomain, locate} from '../options/domain.ts';
import type {Env} from '../options/domain.ts';
import {HOOK_SECONDS, MAX_NON_FULL_RUN, MAX_NON_FULL_SHARE} from './constants.ts';
import {FULL} from './FULL.ts';
import {SPLIT} from './SPLIT.ts';
import {LOWER} from './LOWER.ts';
import {HIDDEN} from './HIDDEN.ts';

export const LAYOUTS = defineDomain(
  'layout',
  {FULL, SPLIT, LOWER, HIDDEN},
  {
    fallback: 'FULL',
    audit: (plan: any, env: Env) => {
      const stage = (plan.stage ?? []) as any[];
      const problems = stage.flatMap(span => LAYOUTS.problems(span.layout, locate(span)));
      const total = typeof plan.total === 'number' ? plan.total : 0;
      if (!stage.length || total <= 0) return problems;

      const spans = stage.map(span => ({s: span.s, e: span.e, where: locate(span),
        name: LAYOUTS.resolve(span.layout).name ?? 'FULL'}));

      const badHook = spans.find(s => s.s < HOOK_SECONDS && s.name !== 'FULL');
      if (badHook) {
        problems.push(`${badHook.where}: the opening ${HOOK_SECONDS}s must be FULL (the hook), found ${badHook.name}`);
      }

      const nonFull = spans.filter(s => s.name !== 'FULL').reduce((a, s) => a + (s.e - s.s), 0);
      if (nonFull > total * MAX_NON_FULL_SHARE) {
        problems.push(`non-FULL layouts cover ${(nonFull / total * 100).toFixed(0)}% of the video `
          + `(${nonFull.toFixed(1)}s of ${total.toFixed(1)}s) — over the ${(MAX_NON_FULL_SHARE * 100).toFixed(0)}% limit`);
      }

      // Reported once per run, at the span that first crosses the limit — but `runStart`
      // itself is never reset by a report, only by a genuine FULL span. Resetting it on
      // report would treat the next non-FULL span as if it opened a fresh run, so a run long
      // enough to be reported once could keep going, unbroken, well past the limit a second
      // time with nothing left to catch it.
      let runStart: number | null = null, runWhere = '', reported = false;
      for (const s of spans) {
        if (s.name === 'FULL') { runStart = null; reported = false; continue; }
        if (runStart === null) { runStart = s.s; runWhere = s.where; reported = false; }
        if (!reported && s.e - runStart > MAX_NON_FULL_RUN) {
          problems.push(`${runWhere}: non-FULL layouts run ${(s.e - runStart).toFixed(1)}s without a FULL `
            + `shot — over the ${MAX_NON_FULL_RUN}s limit`);
          reported = true;
        }
      }
      return problems;
    },
  },
);

export type {Arrangement, CaptionPlacement, Context, FaceTarget} from './types.ts';
