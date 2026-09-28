/* COUNTER — a number that rolls, then lands on its final value with a beat.
   What it does and accepts: ../COUNTER.ts */
import {clamp01 as cl, lerp} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, aw, ah, rgba} from '../../util';
import {COUNTER} from '../COUNTER.ts';

const easeOut = ease('EASE_OUT');
const back = ease('BACK');

type Props = {t: number; prog: number; area: Rect;
  theme: {acc: string; ink: string; mut: string; font: string};
  params: Params<typeof COUNTER.params>};

export default function Counter({t, prog, theme, params, area}: Props) {
  const {to, from, settleAt, scramble} = params;
  const prefix = params.prefix ?? '', suffix = params.suffix ?? '';
  const dec = params.decimals ?? (String(to).indexOf('.') >= 0 ? 2 : 0);
  const cx = ax(area, 0.5), cy = ay(area, 0.46);

  let val: number, settleK = 0;
  if (prog < settleAt) {
    if (scramble) {
      const r = Math.sin(Math.floor(t * 30) * 12.9898) * 43758.5453;
      const noise = Math.abs(r - Math.floor(r));
      const span = Math.abs(to - from) || 90;
      val = Math.min(from, to) + noise * span;
    } else {
      val = from;
    }
  } else {
    settleK = cl((prog - settleAt) / 0.15);
    val = lerp(from, to, easeOut(settleK));
  }

  const s = prefix + val.toFixed(dec) + suffix;
  const sc = settleK > 0 ? lerp(1.55, 1, back(settleK)) : 1;
  const sy = settleK > 0 ? Math.sin(settleK * Math.PI * 3) * (1 - settleK) * 10 : 0;
  const uk = settleK > 0 ? easeOut(cl((prog - settleAt) / 0.35)) : 0;

  return (
    <>
      {params.title && (
        <div style={{position: 'absolute', left: area.x, width: area.w, top: cy - ah(area, 0.18), textAlign: 'center',
          fontFamily: theme.font, fontWeight: 700, fontSize: 44, color: theme.mut}}>{params.title}</div>
      )}
      <div dir="ltr" style={{position: 'absolute', left: cx, top: cy + sy,
        transform: `translate(-50%,-50%) scale(${sc})`, fontFamily: theme.font, fontWeight: 900,
        fontSize: 150, color: settleK > 0 ? theme.acc : rgba(theme.ink, 0.35), whiteSpace: 'nowrap'}}>{s}</div>
      {uk > 0 && (
        <div style={{position: 'absolute', left: cx, top: cy + ah(area, 0.12), width: aw(area, 0.43) * uk, height: 10,
          transform: 'translateX(-50%)', background: theme.acc, borderRadius: 5}} />
      )}
      {settleK > 0 && settleK < 1 && (
        <div style={{position: 'absolute', left: cx, top: cy,
          width: 240 + settleK * 600, height: 240 + settleK * 600, transform: 'translate(-50%,-50%)',
          borderRadius: '50%', border: `7px solid ${theme.acc}`, opacity: (1 - settleK) * 0.4}} />
      )}
    </>
  );
}
