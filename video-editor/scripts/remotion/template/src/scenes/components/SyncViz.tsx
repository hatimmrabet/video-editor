/* SYNC_VIZ — a waveform with a playhead sweeping across it and markers lighting up.
   What it does and accepts: ../SYNC_VIZ.ts */
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ax, ay, aw, ah, rgba} from '../../util';
import {SYNC_VIZ} from '../SYNC_VIZ.ts';

type Word = {s: number};
type Props = {prog: number; words?: Word[]; area: Rect; theme: {acc: string; ink: string; font: string};
  params: Params<typeof SYNC_VIZ.params>};

export default function SyncViz({prog, words, theme, params, area}: Props) {
  const x0 = ax(area, 0.10), x1 = ax(area, 0.90), yb = ay(area, 0.78);
  const N = params.bars;
  const bars = Array.from({length: N}, (_, i) => {
    const px = x0 + (x1 - x0) * (i / (N - 1));
    const h = ah(area, 0.02 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.53)) * 0.08);
    return {px, h, done: px <= x0 + (x1 - x0) * prog};
  });
  let marks = params.markers;
  if (!Array.isArray(marks) || !marks.length) {
    const w = words || [];
    marks = w.length ? w.map((_, i) => (i + 0.5) / w.length) : [0.3, 0.6, 0.85];
  }
  const px = x0 + (x1 - x0) * prog;

  return (
    <>
      {params.title && (
        <div style={{position: 'absolute', left: ax(area, 0.5) - aw(area, 0.24), top: ay(area, 0.5), width: aw(area, 0.48), height: ah(area, 0.09),
          background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`, borderRadius: 42,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: theme.font, fontWeight: 800, fontSize: 38, color: theme.ink}}>{params.title}</div>
      )}
      {bars.map((b, i) => (
        <div key={i} style={{position: 'absolute', left: b.px - 4, top: yb - b.h / 2, width: 8, height: b.h,
          borderRadius: 4, background: b.done ? theme.acc : rgba(theme.ink, 0.2)}} />
      ))}
      {marks.map((m, i) => {
        if (prog < m) return null;
        const mx = x0 + (x1 - x0) * m;
        const hit = Math.max(0, Math.min(1, (prog - m) / 0.06));
        return (
          <div key={i}>
            <div style={{position: 'absolute', left: mx, top: yb, width: hit < 1 ? 26 : 20, height: hit < 1 ? 26 : 20,
              transform: 'translate(-50%,-50%)', borderRadius: '50%', background: theme.acc}} />
            {hit < 1 && (
              <div style={{position: 'absolute', left: mx, top: yb, width: 28 + hit * 108, height: 28 + hit * 108,
                transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `6px solid ${theme.acc}`, opacity: (1 - hit) * 0.9}} />
            )}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: px, top: yb - ah(area, 0.075), width: 4, height: ah(area, 0.15), transform: 'translateX(-50%)', background: theme.ink}} />
      <div style={{position: 'absolute', left: px, top: yb - ah(area, 0.082), width: 22, height: 22, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: theme.ink}} />
    </>
  );
}
