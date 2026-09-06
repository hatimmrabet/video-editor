/* ═══════ The scenes — this is your part ═══════
   This file is a pattern library, not a template to copy. Invent new scenes for every video:
      each scene is a visual metaphor for what the speaker is saying at that moment, not decoration.
   • Time each scene from the words in caps.json — W(i) returns the words of sentence i with their timing.
   • VideoOverlay = what is drawn over the video itself (inside the card) — like the glitch.
   • Scenes      = what is drawn over everything (cards, counters, panels).
   • After any change: node scripts/safe_check.js <work> (safe zone + hook). */
import {T} from './theme';
import {p, ease, back, rgba, onACC, lerp} from './util';
import caps from './caps.json';

const CARDS = (caps as any).cards;
/** the words of sentence i — {t,s,e} */
export const W = (i:number) => CARDS[i].w as {t:string;s:number;e:number}[];
const abs = (s:React.CSSProperties):React.CSSProperties => ({position:'absolute', ...s});
export const CARD: React.CSSProperties = {
  background: rgba(T.bg,0.97), border:`2.5px solid ${rgba(T.ink,0.09)}`,
  boxShadow:`0 18px 44px ${rgba(T.ink,0.20)}`, borderRadius:20,
};

/* ── Example 1 · a stamp dropping in on a word ── */
const Stamp = ({t, at=[2.45,3.30], text='example'}:{t:number; at?:number[]; text?:string}) => {
  if (t < at[0] || t > at[1]) return null;
  const k = p(t,at[0],at[0]+0.30), a = t > at[1]-0.20 ? 1-p(t,at[1]-0.20,at[1]) : 1;
  return (
    <div style={abs({top:300, left:0, right:0, display:'flex', justifyContent:'center', opacity:a})}>
      <div style={{transform:`rotate(-7deg) scale(${lerp(1.6,1,back(k))})`, background:T.acc,
        color:onACC(T.acc), borderRadius:26, padding:'26px 42px', fontWeight:900, fontSize:52,
        boxShadow:`0 16px 40px ${rgba(T.ink,0.26)}`}}>{text}</div>
    </div>
  );
};

/* ── Example 2 · cards entering one at a time with each word ── */
const Chips = ({t, seg=1, labels=[] as string[], from=0, to=0}:
  {t:number; seg?:number; labels?:string[]; from?:number; to?:number}) => {
  if (!labels.length || t < from || t > to) return null;
  const ws = W(seg), out = p(t, to-0.20, to);
  const pos = [[770,380],[310,380],[770,548],[310,548]];
  return (<>{labels.slice(0,4).map((l,i) => {
    const w = ws[i]; if (!w || t < w.s) return null;
    const k = p(t, w.s, w.s+0.30);
    return (
      <div key={i} style={abs({left:pos[i][0]-209, top:pos[i][1]-62, width:418, height:124,
        opacity:(1-out)*ease(k), transform:`scale(${lerp(0.7,1,back(k))})`})}>
        <div style={{...CARD, borderRadius:34, width:'100%', height:'100%',
          display:'flex', alignItems:'center', justifyContent:'center'}}>
          <span style={{fontWeight:800, fontSize:46, color:T.ink}}>{l}</span>
        </div>
      </div>);
  })}</>);
};

/** over the video itself (inside the card) */
export const VideoOverlay = ({t}:{t:number}) => (<></>);

/** over everything. Empty by default — either author scenes here (no config/scenes.json),
    or write config/scenes.json and let SceneList dispatch motifs (Ad.tsx picks one). */
export const Scenes = ({t}:{t:number}) => (<>
  {/* <Stamp t={t} at={[2.45,3.30]} text="handmade"/> */}
  {/* <Chips t={t} seg={1} labels={['A','B','C','D']} from={3.3} to={8.0}/> */}
</>);
