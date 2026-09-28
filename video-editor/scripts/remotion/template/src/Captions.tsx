import {T} from './theme';
import {p, rgba, ease, back} from './util';
import {capPages, fontReady, CAP_FS, CAP_MAXW, CAP_GAP} from './capPages';
import caps from './plan.json';
import {arrangementAt} from './stage';
import {CAPTION_SEAM_BIAS} from './layouts/constants.ts';
import {SCENE_ENTER, SCENE_EXIT, ease as easing} from './transitions/index.ts';

type Fx = 'drop' | 'shake' | 'pulse' | 'type';
type W = {t:string; s:number; e:number; hot:boolean; fx?: Fx | null};
type C = {s:number; e:number; w:W[]};
const CARDS = (caps as any).cards as C[];

// A word's own entrance choreography — `*word:drop*` etc. in timeline.json's `text`
// (lib/timeline.py's `_WORD_FX` — keep the two lists in sync). Every duration here is real
// seconds off the word's own `t - w.s`, never a share of the caption card's or the segment's
// own duration: the same lesson SUSPENSE and GLITCH both had to learn the hard way — a word
// choreographs identically whether its sentence is short or long.
const DROP_S = 0.34, DROP_FALL = 0.72, DROP_H = 70, DROP_BOUNCE = 5;
const SHAKE_S = 0.38, SHAKE_PX = 10;
const PULSE_S = 0.38, PULSE_AMT = 0.22;
const TYPE_S = 0.30;

// A card is one whole spoken sentence — too much text for one caption to show at once
// without swallowing the face (the constraint capPages.ts's header explains). Pages are
// cheap to recompute (a handful of words, no more than a sentence) but stable per card,
// so cache them — except a page wrapped before the theme font was ready, which is kept out
// of the cache so the next frame (still before anything visible was captured) measures it
// again instead of freezing a wrap taken against a fallback font forever.
const _pages = new WeakMap<C, ReturnType<typeof capPages<W>>>();
function pagesFor(c: C) {
  let pg = _pages.get(c);
  if (!pg) {
    pg = capPages(c.s, c.e, c.w);
    if (fontReady()) _pages.set(c, pg);
  }
  return pg;
}

export const Captions: React.FC<{t:number}> = ({t}) => {
  const c = CARDS.find(c => t >= c.s && t < c.e);
  if (!c) return null;
  const pages = pagesFor(c);
  const pg = pages.find(pg => t >= pg.s && t < pg.e) || pages[pages.length - 1];
  const lt = t - pg.s, rt = pg.e - t;
  let a = 1, dy = 0, sc = 1;
  const en = SCENE_ENTER, ex = SCENE_EXIT;   // the same rise scenes use — one definition in transitions/
  if (lt < en.duration) { const k = lt/en.duration, e = easing(en.easing)(k); a = e; dy = (1-e)*en.y; sc = en.scale ? 0.93 + 0.07*back(k) : 1; }
  if (rt < ex.duration) { const k = rt/ex.duration, e = easing(ex.easing)(k); a = e; dy = (1-e)*ex.y; }

  // BOTTOM (FULL/HIDDEN): the box grows upward from a fixed distance off the frame's bottom
  // edge. SEAM (SPLIT/LOWER): its top sits exactly at the seam, then a translateY(-42%) —
  // a fraction of the box's OWN rendered height, which only the browser knows — pulls it up
  // so 42% rides above the line and 58% below, tying the graphic and the video halves
  // together instead of floating free over either one.
  const cap = arrangementAt(t).caption;
  const seamShift = cap.align === 'SEAM' ? `translateY(${-CAPTION_SEAM_BIAS * 100}%) ` : '';
  const posStyle = cap.align === 'SEAM' ? {top: cap.y} : {bottom: cap.y};

  return (
    <div style={{position:'absolute', left:0, right:0, ...posStyle, display:'flex', justifyContent:'center',
      opacity:a, transform:`${seamShift}translateY(${dy}px) scale(${sc})`}}>
      <div dir="rtl" style={{
        // content-box, explicitly: CAP_MAXW is capPages.ts's wrap width for the TEXT alone —
        // border/padding must add to it, never eat into it, or the two would wrap differently.
        boxSizing:'content-box', maxWidth:CAP_MAXW, background:rgba(T.bg,0.96), border:`2.5px solid ${rgba(T.ink,0.09)}`,
        borderRadius:38, padding:'30px 44px', boxShadow:`0 20px 48px ${rgba(T.ink,0.30)}`,
        fontFamily:T.font, fontWeight:800, fontSize:CAP_FS, lineHeight:1.44, textAlign:'center', color:T.ink}}>
        {pg.w.map((w,i) => {
          const active = t >= w.s && t < w.e;
          const spoken = t >= w.s;
          const dt = t - w.s;
          const hot = w.hot && spoken;
          const grow = hot ? Math.min(1,(t-w.s)/0.16) : 0;
          // Plain words keep the small default lift; a `fx`-tagged word replaces it with its
          // own choreography instead of stacking both — drop/shake/pulse already carry enough
          // motion on their own. `type` clips the word away entirely before its own moment
          // (nothing to reveal yet), unlike every other word, which is visible for its whole
          // page the instant the page itself enters.
          let lift = active ? -5*Math.sin(Math.min(1,dt/0.10)*Math.PI) : 0, sx = 0, scale = 1, clip = 0;
          if (w.fx === 'drop' && spoken) {
            const k = Math.min(1, dt/DROP_S);
            lift = k < DROP_FALL ? -((1-k/DROP_FALL)**2)*DROP_H : -Math.sin((k-DROP_FALL)/(1-DROP_FALL)*Math.PI)*DROP_BOUNCE;
          } else if (w.fx === 'shake' && spoken) {
            const k = Math.min(1, dt/SHAKE_S);
            sx = Math.sin(k*40)*(1-k)*SHAKE_PX;
          } else if (w.fx === 'pulse' && spoken) {
            scale = 1 + PULSE_AMT*Math.sin(Math.min(1, dt/PULSE_S)*Math.PI);
          } else if (w.fx === 'type') {
            clip = spoken ? 1 - Math.min(1, dt/TYPE_S) : 1;
          }
          return (
            <span key={i} style={{display:'inline-block', margin:`0 ${CAP_GAP/2}px`, position:'relative',
              transform:`translate(${sx}px, ${lift}px) scale(${scale})`,
              clipPath: clip > 0 ? `inset(0 0 0 ${clip*100}%)` : undefined,
              color: hot ? '#FFF' : (active ? T.acc : T.ink)}}>
              {hot && (
                <span style={{position:'absolute', inset:'-11px -14px', background:T.acc, borderRadius:15,
                  transform:`scaleX(${ease(grow)})`, transformOrigin:'right center', zIndex:-1}} />
              )}
              {w.t}
            </span>
          );
        })}
      </div>
    </div>
  );
};
