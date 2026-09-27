/* CHECKLIST — rows that tick one after another. What it does and accepts: ../CHECKLIST.ts */
import {clamp01 as cl, lerp} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, aw, ah, rgba} from '../../util';
import {CHECKLIST} from '../CHECKLIST.ts';

const easeOut = ease('EASE_OUT');

type Props = {prog: number; wordIndex: number; area: Rect;
  theme: {acc: string; ink: string; mut: string; font: string};
  params: Params<typeof CHECKLIST.params>};

const Check = ({k, color, size}: {k: number; color: string; size: number}) => {
  // two-segment tick, drawn as an SVG polyline revealed by k
  const p = [[-0.32, 0.02], [-0.08, 0.26], [0.34, -0.26]];
  const pts: number[][] = [p[0]];
  if (k < 0.5) { const q = k / 0.5; pts.push([lerp(p[0][0], p[1][0], q), lerp(p[0][1], p[1][1], q)]); }
  else { pts.push(p[1]); const q = (k - 0.5) / 0.5; pts.push([lerp(p[1][0], p[2][0], q), lerp(p[1][1], p[2][1], q)]); }
  return (
    <svg width={size} height={size} viewBox="-0.5 -0.5 1 1" style={{overflow: 'visible'}}>
      <polyline points={pts.map((pt) => pt.join(',')).join(' ')} fill="none" stroke={color}
        strokeWidth={0.13} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default function Checklist({prog, wordIndex, theme, params, area}: Props) {
  const {items} = params;
  const y0 = ay(area, params.y);
  // rows fill whatever is left below y0, down to a small margin above the area's own bottom
  // — the list stays inside its area whether SPLIT gave it a lot of room or FULL only a strip.
  // Always dividing evenly (never flooring to a minimum) is what keeps that promise: a floor
  // would let enough items, or a `y` started low enough, push the last rows past the area.
  const available = Math.max(0, area.y + area.h - y0 - ah(area, 0.03));
  const rowH = available / items.length;
  const rowW = aw(area, 0.72);

  return (
    <>
      {params.title && (
        <div style={{position: 'absolute', left: area.x, width: area.w, top: y0 - rowH * 0.55 - 28, textAlign: 'center',
          fontFamily: theme.font, fontWeight: 800, fontSize: 40, color: theme.mut}}>{params.title}</div>
      )}
      {items.map((label, i) => {
        let k: number;
        if (params.sync === 'WORDS') k = cl(wordIndex - i + 1);
        else { const t0 = 0.12 + (i / Math.max(1, items.length)) * 0.7; k = cl((prog - t0) / 0.14); }
        const y = y0 + i * rowH;
        const rowH2 = rowH * 0.78;
        return (
          <div key={i} style={{position: 'absolute', left: ax(area, 0.5) - rowW / 2, top: y - rowH2 / 2, width: rowW, height: rowH2,
            opacity: lerp(0.32, 1, easeOut(k)),
            background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
            borderRadius: 24, boxShadow: `0 14px 34px ${rgba(theme.ink, 0.14)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 34px 0 18px',
            direction: 'rtl'}}>
            <span style={{fontFamily: theme.font, fontWeight: 800, fontSize: 42, color: k > 0.3 ? theme.ink : theme.mut}}>{String(label)}</span>
            {k > 0.1 && <Check k={cl((k - 0.1) / 0.6)} color={theme.acc} size={46} />}
          </div>
        );
      })}
    </>
  );
}
