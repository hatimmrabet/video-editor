/* glitch — Remotion `overlay` motif. Props: { t, prog, rect, theme, params }. */
import {W as PW, H as PH} from '../theme';
const SX = PW / 1080, SY = PH / 1920;
type Rect = {x: number; y: number; w: number; h: number};
type Props = {t: number; prog: number; rect?: Rect; theme: {acc: string}; params: {intensity?: number; slices?: number}};

const cl = (v: number) => Math.max(0, Math.min(1, v));

export default function Glitch({t, prog, rect, theme, params}: Props) {
  const R = rect || {x: 0, y: 0, w: PW, h: PH};
  const amp = (params.intensity != null ? params.intensity : 1) * 70 * SX * (1 - prog);
  const N = params.slices != null ? params.slices : 16;
  const bars: {y: number; dx: number; o: number}[] = [];
  if (amp > 0.5) {
    for (let i = 0; i < N; i++) {
      const r = Math.sin(i * 7.3 + Math.floor(t * 30) * 1.7);
      bars.push({y: R.y + i * (R.h / N), dx: r * amp, o: Math.abs(r) * 0.35 * cl(amp / (70 * SX))});
    }
  }
  const ck = cl(prog / 0.35), fo = 1 - cl((prog - 0.5) / 0.4);
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
        <div key={i} style={{position: 'absolute', left: R.x + b.dx, top: b.y, width: R.w, height: (R.h / N) * 0.5,
          background: theme.acc, opacity: b.o}} />
      ))}
      {amp > 0.5 && (
        <div style={{position: 'absolute', left: R.x, top: R.y, width: R.w, height: R.h, background: theme.acc, opacity: (1 - prog) * 0.12}} />
      )}
      {ck > 0 && fo > 0 && (
        <svg width={PW} height={PH} style={{position: 'absolute', left: 0, top: 0, opacity: fo * 0.8}}>
          {cracks.map((pts, i) => (
            <polyline key={i} points={pts} fill="none" stroke={theme.acc} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          ))}
        </svg>
      )}
    </>
  );
}
