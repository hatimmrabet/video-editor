/* FILE_MERGE — chips fly in and merge into one file card. What it does and accepts: ../FILE_MERGE.ts */
import {clamp01 as cl, lerp} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, aw, ah, onACC, rgba} from '../../util';
import {FILE_MERGE} from '../FILE_MERGE.ts';

const eio = ease('EASE_IN_OUT');
const easeOut = ease('EASE_OUT');

type Props = {prog: number; area: Rect; theme: {acc: string; ink: string; mut: string; clay?: string; font: string};
  params: Params<typeof FILE_MERGE.params>};

export default function FileMerge({prog, theme, params, area}: Props) {
  const {sources} = params;
  const px = ax(area, 0.14), py = ay(area, 0.06), pw = aw(area, 0.72), ph = ah(area, 0.66);
  const lk = cl((prog - 0.8) / 0.15);
  const targetX = ax(area, 0.5), targetY = py + ph * 0.75;
  const fromY = area.y + area.h - ah(area, 0.02);   // the chips fly in from just below the area

  return (
    <>
      <div style={{position: 'absolute', left: px, top: py, width: pw, height: ph, borderRadius: 34,
        background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
        boxShadow: `0 18px 44px ${rgba(theme.ink, 0.2)}`, fontFamily: theme.font}}>
        {params.targetLabel && (
          <div style={{position: 'absolute', top: ph * 0.1, right: pw * 0.08, fontWeight: 900, fontSize: 56, color: theme.ink}}>{params.targetLabel}</div>
        )}
        {params.targetLabel && <div style={{position: 'absolute', top: ph * 0.35, left: pw * 0.045, right: pw * 0.045, borderTop: `2px solid ${rgba(theme.ink, 0.1)}`}} />}
        {params.note && (
          <div style={{position: 'absolute', top: ph * 0.46, left: 0, right: 0, textAlign: 'center', fontWeight: 700, fontSize: 40, color: theme.mut}}>{params.note}</div>
        )}
      </div>
      {sources.map((label, i) => {
        const n = sources.length;
        const t0 = 0.1 + (i / Math.max(1, n)) * 0.55;
        const k = cl((prog - t0) / 0.3);
        if (k <= 0) return null;
        const e = eio(k);
        const sx = targetX + (i - (n - 1) / 2) * aw(area, 0.30);
        const x = lerp(sx, targetX, e), y = lerp(fromY, targetY, e), sc = lerp(1, 0.82, e);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${sc})`,
            opacity: k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15,
            background: theme.acc, color: onACC(theme.acc), borderRadius: 999, padding: '18px 32px',
            fontFamily: theme.font, fontWeight: 800, fontSize: 40, whiteSpace: 'nowrap',
            boxShadow: `0 10px 26px ${rgba(theme.ink, 0.2)}`}}>{String(label)}</div>
        );
      })}
      {lk > 0 && params.done && (
        <div style={{position: 'absolute', left: targetX, top: targetY, transform: 'translate(-50%,-50%)',
          opacity: easeOut(lk), background: rgba(theme.acc, 0.14), color: theme.clay || theme.acc,
          borderRadius: 999, padding: '14px 40px', fontFamily: theme.font, fontWeight: 800, fontSize: 44, whiteSpace: 'nowrap'}}>
          {String(params.done)}
        </div>
      )}
    </>
  );
}
