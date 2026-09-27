/* Scenes: the motion graphics drawn over (or instead of) the video. An entry's `scene` chooses
   one — {type: KEYWORD, params: {...}, at, dur, timing} — and this domain is the only way a
   scene is described or drawn: there is no per-video scene code.

   Each scene has two files. The definition, named after its keyword (CHECKLIST.ts), says what it
   does, when to use it and which parameters it takes — pure TypeScript, so it loads under plain
   Node for validation. The component (components/Checklist.tsx) draws it; components.tsx pairs
   the two and the type checker refuses a keyword without a component or the reverse.
   Adding a scene means adding both files and one line in each list.

   THE COMPONENT CONTRACT. SceneList.tsx renders each active scene with these props:
     t          absolute seconds
     prog       0..1, linear progress through the whole scene (for its own phases)
     enter      0..1, raw linear progress of the entrance (ease it however you like)
     exit       0..1, raw linear progress of the exit (1 = gone)
     words      the sentence's words with their timings: {t, s, e, hot}[]
     wordIndex  how many of those words have started, minus one (-1 before the first)
     rect       the video card's rectangle at this instant (GLITCH's own use only — it draws
                ON the video, everything else draws in `area`)
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
import {GLITCH} from './GLITCH.ts';
import {IMAGE_CARD} from './IMAGE_CARD.ts';
import {QUOTE} from './QUOTE.ts';
import {STAMP} from './STAMP.ts';
import {SUSPENSE} from './SUSPENSE.ts';
import {SYNC_VIZ} from './SYNC_VIZ.ts';
import {TRANSCRIPT_PANEL} from './TRANSCRIPT_PANEL.ts';

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
  {CARD_STACK, CHECKLIST, COMMENT_BOX, COUNTER, FILE_MERGE, GLITCH, IMAGE_CARD, QUOTE, STAMP, SUSPENSE, SYNC_VIZ, TRANSCRIPT_PANEL},
  {
    audit: (plan, env: Env) => (plan.scenes ?? []).flatMap((sc: any) => {
      const where = locate(sc);
      const spec = {type: sc.type, ...(sc.params ?? {})};
      const r = SCENES.resolve(spec);
      const world = r.errors.length ? [] : ((r.option as any).check?.(r.params, env) ?? []).map((e: string) => `${where}: scene ${e}`);
      return [...r.errors.map(e => `${where}: scene ${e}`), ...world, ...timingProblems(sc.timing, where)];
    }),
  },
);
