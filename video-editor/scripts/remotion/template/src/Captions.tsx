import {T, TX} from './theme';
import {p, rgba, ease, back, ez} from './util';
import caps from './caps.json';

type W = {t:string; s:number; e:number; hot:boolean};
type C = {s:number; e:number; w:W[]};
const CARDS = (caps as any).cards as C[];

/* WARNING bottom: 1920-1500 = the card ends at y=1460, above Instagram's button area.
   Don't push it lower — run safe_check.js after any change. */
export const Captions: React.FC<{t:number}> = ({t}) => {
  const c = CARDS.find(c => t >= c.s && t < c.e);
  if (!c) return null;
  const lt = t - c.s, rt = c.e - t;
  let a = 1, dy = 0, sc = 1;
  const en = TX.sceneEnter, ex = TX.sceneExit;   // the `rise` type — caption default (== today's values)
  if (lt < en.duration) { const k = lt/en.duration, e = ez(en.easing)(k); a = e; dy = (1-e)*en.params.y; sc = en.params.scale ? 0.93 + 0.07*back(k) : 1; }
  if (rt < ex.duration) { const k = rt/ex.duration, e = ez(ex.easing)(k); a = e; dy = (1-e)*ex.params.y; }

  return (
    <div style={{position:'absolute', left:0, right:0, bottom:1920-1460, display:'flex', justifyContent:'center',
      opacity:a, transform:`translateY(${dy}px) scale(${sc})`}}>
      <div dir="rtl" style={{
        maxWidth:730, background:rgba(T.bg,0.96), border:`2.5px solid ${rgba(T.ink,0.09)}`,
        borderRadius:38, padding:'30px 44px', boxShadow:`0 20px 48px ${rgba(T.ink,0.30)}`,
        fontFamily:T.font, fontWeight:800, fontSize:55, lineHeight:1.44, textAlign:'center', color:T.ink}}>
        {c.w.map((w,i) => {
          const active = t >= w.s && t < w.e;
          const spoken = t >= w.s;
          const lift = active ? -5*Math.sin(Math.min(1,(t-w.s)/0.10)*Math.PI) : 0;
          const hot = w.hot && spoken;
          const grow = hot ? Math.min(1,(t-w.s)/0.16) : 0;
          return (
            <span key={i} style={{display:'inline-block', margin:'0 8px', position:'relative',
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
