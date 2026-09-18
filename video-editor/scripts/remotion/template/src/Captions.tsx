import {T, TX, H} from './theme';
import {p, rgba, ease, back, ez} from './util';
import {capPages, CAP_FS, CAP_MAXW, CAP_GAP} from './capPages';
import caps from './timeline.json';

type W = {t:string; s:number; e:number; hot:boolean};
type C = {s:number; e:number; w:W[]};
const CARDS = (caps as any).cards as C[];

/* WARNING on a 9:16 render: bottom margin 360 (designed as 1920-1560, the card ending at
   y=1560, inside Guides.tsx's "caution" band 1500-1620 but 60px clear of its hard "bottom"
   band at 1620) stays above Instagram's button area only because it's a fraction of H, not
   a fixed 360px — don't change the fraction without checking safe zones on that platform
   (`remotion.sh <work> studio`, "guides": true in timeline.json). Room to sit this low
   opened up when the progress bar (it used to occupy 1492-1499) was removed (issue #153). */
const CAP_BOTTOM = 360 / 1920;   // fraction of H, so the caption stays above Instagram's UI at any H

// A card is one whole spoken sentence — too much text for one caption to show at once
// without swallowing the face (the bug capPages.ts's header explains). Pages are cheap to
// recompute (a handful of words, no more than a sentence) but stable per card, so cache them.
const _pages = new WeakMap<C, ReturnType<typeof capPages<W>>>();
function pagesFor(c: C) {
  let pg = _pages.get(c);
  if (!pg) { pg = capPages(c.s, c.e, c.w); _pages.set(c, pg); }
  return pg;
}

export const Captions: React.FC<{t:number}> = ({t}) => {
  const c = CARDS.find(c => t >= c.s && t < c.e);
  if (!c) return null;
  const pages = pagesFor(c);
  const pg = pages.find(pg => t >= pg.s && t < pg.e) || pages[pages.length - 1];
  const lt = t - pg.s, rt = pg.e - t;
  let a = 1, dy = 0, sc = 1;
  const en = TX.sceneEnter, ex = TX.sceneExit;   // the `rise` type — caption default (== today's values)
  if (lt < en.duration) { const k = lt/en.duration, e = ez(en.easing)(k); a = e; dy = (1-e)*en.params.y; sc = en.params.scale ? 0.93 + 0.07*back(k) : 1; }
  if (rt < ex.duration) { const k = rt/ex.duration, e = ez(ex.easing)(k); a = e; dy = (1-e)*ex.params.y; }

  return (
    <div style={{position:'absolute', left:0, right:0, bottom:H*CAP_BOTTOM, display:'flex', justifyContent:'center',
      opacity:a, transform:`translateY(${dy}px) scale(${sc})`}}>
      <div dir="rtl" style={{
        maxWidth:CAP_MAXW, background:rgba(T.bg,0.96), border:`2.5px solid ${rgba(T.ink,0.09)}`,
        borderRadius:38, padding:'30px 44px', boxShadow:`0 20px 48px ${rgba(T.ink,0.30)}`,
        fontFamily:T.font, fontWeight:800, fontSize:CAP_FS, lineHeight:1.44, textAlign:'center', color:T.ink}}>
        {pg.w.map((w,i) => {
          const active = t >= w.s && t < w.e;
          const spoken = t >= w.s;
          const lift = active ? -5*Math.sin(Math.min(1,(t-w.s)/0.10)*Math.PI) : 0;
          const hot = w.hot && spoken;
          const grow = hot ? Math.min(1,(t-w.s)/0.16) : 0;
          return (
            <span key={i} style={{display:'inline-block', margin:`0 ${CAP_GAP/2}px`, position:'relative',
              transform:`translateY(${lift}px)`,
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
