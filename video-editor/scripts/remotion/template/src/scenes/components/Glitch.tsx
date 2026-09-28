/* GLITCH — an overlay: the picture tears into displaced slices, then cracks.
   What it does and accepts: ../GLITCH.ts */
import {H as PH, W as PW} from '../../theme';
import {clamp01 as cl} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {GLITCH} from '../GLITCH.ts';

const SX = PW / 1080, SY = PH / 1920;
type Rect = {x: number; y: number; w: number; h: number};
type Props = {t: number; prog: number; dur: number; rect?: Rect; theme: {acc: string}; params: Params<typeof GLITCH.params>};

// A shock is sudden, not a wash the viewer sits and watches: it peaks by IMPACT_S and is fully
// spent by RECOVER_S, in real seconds — never stretched to fill however long the segment runs.
const IMPACT_S = 0.22, RECOVER_S = 0.6;

export default function Glitch({t, prog, dur, rect, theme, params}: Props) {
  const R = rect || {x: 0, y: 0, w: PW, h: PH};
  const elapsed = prog * dur;
  const shock = elapsed >= RECOVER_S ? 0
    : elapsed < IMPACT_S ? cl(elapsed / IMPACT_S)
    : 1 - cl((elapsed - IMPACT_S) / (RECOVER_S - IMPACT_S));

  // Slices, not a tint: each bar difference-blends against the footage under it, so it reads
  // as the picture itself torn and offset rather than a translucent film laid over it — and
  // gaps between bars (a slice skipped when |r| is small) keep it looking torn, not striped.
  const amp = params.intensity * 90 * SX * shock;
  const N = params.slices;
  const bars: {y: number; h: number; dx: number}[] = [];
  if (amp > 1) {
    for (let i = 0; i < N; i++) {
      const r = Math.sin(i * 7.3 + Math.floor(t * 60) * 2.1);
      if (Math.abs(r) < 0.35) continue;
      bars.push({y: R.y + i * (R.h / N), h: (R.h / N) * (0.55 + 0.35 * Math.abs(r)), dx: r * amp});
    }
  }

  const ck = cl(shock * 1.6);
  const cracks = [[0, -1, 0.9], [1, 0.6, 0.75], [-1, 0.75, 0.8]].map((sd, si) => {
    let x = R.x + R.w / 2, y = R.y + R.h / 2;
    const pts = [`${x},${y}`];
    for (let i = 1; i <= 9; i++) {
      const kk = cl(ck * 9 - (i - 1));
      if (kk <= 0) break;
      x += sd[0] * 95 * SX * kk + Math.sin(i * 3.1 + si) * 46 * SX * kk;
      y += sd[1] * 115 * SY * kk;
      pts.push(`${x},${y}`);
    }
    return pts.join(' ');
  });

  return (
    <>
      {bars.map((b, i) => (
        <div key={i} style={{position: 'absolute', left: R.x + b.dx, top: b.y, width: R.w, height: b.h,
          background: theme.acc, mixBlendMode: 'difference'}} />
      ))}
      {ck > 0 && (
        <svg width={PW} height={PH} style={{position: 'absolute', left: 0, top: 0, opacity: ck * 0.85}}>
          {cracks.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke={theme.acc} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      )}
    </>
  );
}
