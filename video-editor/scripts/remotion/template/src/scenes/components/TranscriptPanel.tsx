/* TRANSCRIPT_PANEL — each spoken word drops in on its own line, with its timestamp.
   What it does and accepts: ../TRANSCRIPT_PANEL.ts */
import {clamp01 as cl} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, aw, ah, rgba} from '../../util';
import {TRANSCRIPT_PANEL} from '../TRANSCRIPT_PANEL.ts';

const easeOut = ease('EASE_OUT');

type Word = {t: string; s: number; e: number};
type Props = {t: number; words?: Word[]; area: Rect; theme: {acc: string; ink: string; mut: string; font: string};
  params: Params<typeof TRANSCRIPT_PANEL.params>};

export default function TranscriptPanel({t, words, theme, params, area}: Props) {
  const px = ax(area, 0.08), py = ay(area, 0.10), pw = aw(area, 0.84), ph = ah(area, 0.80);
  const override = Array.isArray(params.lines);
  const src: any[] = override ? params.lines!.map((s) => ({t: String(s), s: -1})) : (words || []);
  const shown = override ? src : src.filter((w) => t >= w.s);
  const RH = ah(area, 0.14), maxR = Math.max(2, Math.floor(ph / RH)), off = Math.max(0, shown.length - maxR);

  return (
    <div style={{position: 'absolute', left: px, top: py, width: pw, height: ph, borderRadius: 32,
      background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
      boxShadow: `0 18px 44px ${rgba(theme.ink, 0.2)}`, overflow: 'hidden', fontFamily: theme.font}}>
      <div style={{position: 'absolute', top: ah(area, 0.03), right: aw(area, 0.03), display: 'flex', gap: 16}}>
        {[0, 1, 2].map((i) => <div key={i} style={{width: 20, height: 20, borderRadius: '50%', background: rgba(theme.ink, 0.22)}} />)}
      </div>
      {params.title && (
        <div style={{position: 'absolute', top: ah(area, 0.025), right: aw(area, 0.09), fontWeight: 700, fontSize: 34, color: theme.mut}}>{params.title}</div>
      )}
      <div style={{position: 'absolute', top: ph * 0.09, left: pw * 0.035, right: pw * 0.035, borderTop: `2px solid ${rgba(theme.ink, 0.1)}`}} />
      <div style={{position: 'absolute', top: ph * 0.1, left: pw * 0.02, right: pw * 0.02, bottom: ph * 0.02, overflow: 'hidden'}}>
        {shown.map((w, i) => {
          const k = w.s < 0 ? 1 : cl((t - w.s) / 0.22);
          const y = 24 + (i - off) * RH + (1 - easeOut(k)) * 16;
          if (y < -RH || y > ph - RH * 1.7) return null;
          return (
            <div key={i} style={{position: 'absolute', top: y, left: pw * 0.03, right: pw * 0.03,
              opacity: easeOut(k) * (i < off ? 0.35 : 1), display: 'flex', justifyContent: 'space-between',
              direction: 'rtl'}}>
              <span style={{fontWeight: 800, fontSize: 44, color: i === shown.length - 1 ? theme.acc : theme.ink}}>{w.t}</span>
              {w.s >= 0 && (
                <span style={{fontWeight: 600, fontSize: 30, color: theme.mut, direction: 'ltr'}}>
                  {String(Math.floor(w.s / 60)).padStart(2, '0')}:{(w.s % 60).toFixed(2).padStart(5, '0')}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
