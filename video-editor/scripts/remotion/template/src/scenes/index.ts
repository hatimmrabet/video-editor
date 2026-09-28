/* Scenes: the motion graphics drawn over (or instead of) the video. A segment's `scene` chooses
   one — {type: KEYWORD, params: {...}, timing} — and lives exactly as long as that segment;
   this domain is the only way a scene is described or drawn: there is no per-video scene code.

   Each scene has two files. The definition, named after its keyword (CHECKLIST.ts), says what it
   does, when to use it and which parameters it takes — pure TypeScript, so it loads under plain
   Node for validation. The component (components/Checklist.tsx) draws it; components.tsx pairs
   the two and the type checker refuses a keyword without a component or the reverse.
   Adding a scene means adding both files and one line in each list.

   MAX_SCENELESS_RUN caps how long the video may go with no scene running at all: enforced
   here, not left as prose a scene-design pass could silently under-deliver on. A plan that
   goes quiet too long fails `options/check.ts`, naming the stretch.

   THE COMPONENT CONTRACT. SceneList.tsx renders each active scene with these props:
     t          absolute seconds
     prog       0..1, linear progress through the whole scene (for its own phases)
     dur        the scene's own length in seconds (sc.e - sc.s) — prog*dur is elapsed seconds,
                for a phase that must stay short (a shock, a flash) regardless of how long the
                segment itself runs, instead of stretching to fill it
     enter      0..1, raw linear progress of the entrance (ease it however you like)
     exit       0..1, raw linear progress of the exit (1 = gone)
     words      the sentence's words with their timings: {t, s, e, hot}[]
     wordIndex  how many of those words have started, minus one (-1 before the first)
     itemReveal for a scene whose `items` param is a list, the absolute second each one first
                appeared, parallel to `items` (render_data.py's item_reveal_times) — a segment
                that continued an already-running list inherited its earlier items' real,
                original times, so `t - itemReveal[i]` animates only whichever item is
                actually new; every earlier one is already past its own entrance and reads as
                settled. `undefined`/no `items` param: nothing to key off, animate however
                the scene otherwise would.
     rect       the video card's rectangle at this instant — for an `overlay: true` scene
                (SUSPENSE), which draws ON the video; everything else draws in `area`
     area       the active LAYOUT's own scene rectangle (frame px) — draw inside it, in ITS
                own coordinate space (areaX(k) = area.x + k*area.w, and so on; util.tsx has
                the helper), never in absolute design pixels. A layout can be any size (SPLIT's
                graphic band, FULL's overlay strip, HIDDEN's whole frame): a scene that draws
                relative to `area` renders correctly in every one of them, unchanged.
     theme      the project's colours and font — never hardcode a colour
     params     the scene's parameters, every default applied
   Font sizes, radii and shadows stay literal — that is about how big things read, not where
   they sit. A scene that cannot draw returns null. */
import {defineDomain, locate} from '../options/domain.ts';
import type {Env} from '../options/domain.ts';
import {EASINGS} from '../transitions/index.ts';
import {CARD_STACK} from './CARD_STACK.ts';
import {CHECKLIST} from './CHECKLIST.ts';
import {COMMENT_BOX} from './COMMENT_BOX.ts';
import {COUNTER} from './COUNTER.ts';
import {FILE_MERGE} from './FILE_MERGE.ts';
import {IMAGE_CARD} from './IMAGE_CARD.ts';
import {QUOTE} from './QUOTE.ts';
import {STAMP} from './STAMP.ts';
import {SUSPENSE} from './SUSPENSE.ts';
import {SYNC_VIZ} from './SYNC_VIZ.ts';
import {TRANSCRIPT_PANEL} from './TRANSCRIPT_PANEL.ts';

// No stretch of the video may go this long without a scene: the visual variety this whole
// domain exists for, not a frame that is merely filled. Generous enough for a natural hook
// (no scene is ever expected in the first few seconds) plus a sentence or two after it —
// long stretches past that are a content gap, not a deliberate quiet moment.
const MAX_SCENELESS_RUN = 12;

/* Every stretch of the video with no scene running, in order — used only to word the audit
   below; a plan with no scenes at all is one giant gap, from 0 to its own end. */
function scenelessGaps(plan: any): string[] {
  const total = typeof plan.total === 'number' ? plan.total : 0;
  if (total <= 0) return [];
  const scenes = [...(plan.scenes ?? [])].sort((a: any, b: any) => a.s - b.s);
  const gaps: string[] = [];
  let cursor = 0;
  const flag = (from: number, to: number) => {
    if (to - from > MAX_SCENELESS_RUN)
      gaps.push(`${from.toFixed(1)}s-${to.toFixed(1)}s: ${(to - from).toFixed(1)}s with no scene — `
        + `over the ${MAX_SCENELESS_RUN}s limit`);
  };
  for (const sc of scenes) { flag(cursor, sc.s); cursor = Math.max(cursor, sc.e); }
  flag(cursor, total);
  return gaps;
}

/* `timing` tunes how a scene enters and leaves: {in, out}, each a number of seconds or
   {duration, easing, y}. */
function timingProblems(timing: any, where: string): string[] {
  if (timing == null) return [];
  const out: string[] = [];
  const mustBe = (what: string) => `${where}: scene timing.${what}`;
  for (const [key, v] of Object.entries<any>(timing)) {
    if (key !== 'in' && key !== 'out') { out.push(`${where}: scene timing has an unknown key "${key}" (keys: in · out)`); continue; }
    if (typeof v === 'number') { if (!(v > 0)) out.push(`${mustBe(key)} must be above 0 seconds`); continue; }
    if (typeof v !== 'object' || v === null) { out.push(`${mustBe(key)} must be a number of seconds or {duration, easing, y}`); continue; }
    for (const [k, x] of Object.entries<any>(v)) {
      if (k === 'duration') { if (!(typeof x === 'number' && x > 0)) out.push(`${mustBe(key)}.duration must be above 0 seconds`); }
      else if (k === 'easing') out.push(...EASINGS.problems(x, mustBe(key) + '.easing'));
      else if (k === 'y') { if (typeof x !== 'number') out.push(`${mustBe(key)}.y must be a number of pixels`); }
      else out.push(`${mustBe(key)} has an unknown key "${k}" (keys: duration · easing · y)`);
    }
  }
  return out;
}

export const SCENES = defineDomain(
  'scene',
  {CARD_STACK, CHECKLIST, COMMENT_BOX, COUNTER, FILE_MERGE, IMAGE_CARD, QUOTE, STAMP, SUSPENSE, SYNC_VIZ, TRANSCRIPT_PANEL},
  {
    audit: (plan, env: Env) => [
      ...(plan.scenes ?? []).flatMap((sc: any) => {
        const where = locate(sc);
        const spec = {type: sc.type, ...(sc.params ?? {})};
        const r = SCENES.resolve(spec);
        const world = r.errors.length ? [] : ((r.option as any).check?.(r.params, env) ?? []).map((e: string) => `${where}: scene ${e}`);
        return [...r.errors.map(e => `${where}: scene ${e}`), ...world, ...timingProblems(sc.timing, where)];
      }),
      ...scenelessGaps(plan),
    ],
  },
);
