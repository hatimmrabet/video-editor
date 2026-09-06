/* SceneList — the scenes-as-data dispatcher (issue #18). Mirror of compose.html's
   drawScenes(t). Renders one motif per active scene from project.json.scenes, with the
   container `rise` (enter/exit alpha + translateY) applied here so the motif only draws
   its steady state. Null scene list (no config/scenes.json) → renders nothing; Ad.tsx
   falls back to the hand-written Scenes.tsx. */
import {T, SCENES} from './theme';
import {vrect} from './stage';
import Stamp from './motifs/Stamp';       // one static import per implemented motif
import Counter from './motifs/Counter';
import Quote from './motifs/Quote';
import Checklist from './motifs/Checklist';
import CardStack from './motifs/CardStack';
import TranscriptPanel from './motifs/TranscriptPanel';
import FileMerge from './motifs/FileMerge';
import Glitch from './motifs/Glitch';
import CommentBox from './motifs/CommentBox';
import SyncViz from './motifs/SyncViz';
import Suspense from './motifs/Suspense';

const MOTIFS: Record<string, React.FC<any>> = {
  stamp: Stamp, counter: Counter, quote: Quote, checklist: Checklist, 'card-stack': CardStack,
  'transcript-panel': TranscriptPanel, 'file-merge': FileMerge, glitch: Glitch,
  'comment-box': CommentBox, 'sync-viz': SyncViz, suspense: Suspense,
};

/* the four named easings — same curves as compose.html / transitions.json */
const linear = (k: number) => k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const eio = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const back = (k: number) => { const c = 1.9, s = c + 1; return 1 + s * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const ez = (n?: string) => (({linear, ease: easeOut, eio, back} as Record<string, (k: number) => number>)[n || 'ease']) || easeOut;
const cl = (v: number) => Math.max(0, Math.min(1, v));
const dur = (v: any, d: number) => (typeof v === 'number' ? v : (v && typeof v.duration === 'number' ? v.duration : d));

export const SceneList: React.FC<{t: number}> = ({t}) => {
  if (!SCENES) return null;
  return (
    <>
      {SCENES.map((sc: any, i: number) => {
        if (!sc.motif || t < sc.s || t >= sc.e) return null;
        const M = MOTIFS[sc.motif];
        if (!M) return null;

        const tm = sc.timing || {};
        const inD = Math.max(0.001, dur(tm.in, 0.20));
        const outD = Math.max(0.001, dur(tm.out, 0.13));
        const enter = cl((t - sc.s) / inD);
        const exit = cl((t - (sc.e - outD)) / outD);
        const words = sc.words || [];
        let hold = 1, wordIndex = -1;
        if (tm.hold === 'words' && words.length) {
          wordIndex = words.reduce((n: number, w: any) => (t >= w.s ? n + 1 : n), -1);
        } else if (typeof tm.hold === 'number') {
          hold = cl((t - sc.s - inD) / Math.max(0.001, tm.hold));
        }
        const eA = ez((tm.in && tm.in.easing) || 'ease')(enter);
        const xA = ez((tm.out && tm.out.easing) || 'linear')(exit);
        const riseY = (1 - eA) * (tm.in && typeof tm.in.y === 'number' ? tm.in.y : 28);
        const prog = cl((t - sc.s) / Math.max(0.001, sc.e - sc.s));
        const overlay = sc.kind === 'overlay';
        const wrap = overlay ? {} : {opacity: eA * (1 - xA), transform: `translateY(${riseY}px)`};

        return (
          <div key={i} style={{position: 'absolute', inset: 0, ...wrap}}>
            <M t={t} prog={prog} enter={enter} exit={exit} hold={hold} words={words} wordIndex={wordIndex}
               rect={vrect(t)} theme={T} params={sc.params || {}} />
          </div>
        );
      })}
    </>
  );
};
