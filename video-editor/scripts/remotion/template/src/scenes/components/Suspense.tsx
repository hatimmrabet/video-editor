/* SUSPENSE — an overlay: rings pulsing outward from a point on the video card.
   What it does and accepts: ../SUSPENSE.ts */
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {SUSPENSE} from '../SUSPENSE.ts';

// A ring completes one pulse in this many real seconds — fixed, never a share of `prog`: tied
// to the scene's own progress, a segment several seconds long pulses proportionally slower
// (a full minute-long segment would take a full minute per pulse), reading as static rather
// than "building tension". theme.acc alone, at a low opacity, also read as barely there —
// PEAK_O is high enough that a ring is unmistakably a ring, not a faint smudge.
const CYCLE_S = 1.6, PEAK_O = 0.5;

type Props = {t: number; rect?: Rect; theme: {acc: string}; params: Params<typeof SUSPENSE.params>};

export default function Suspense({t, rect, theme, params}: Props) {
  const R = rect || {x: 0, y: 0, w: 1080, h: 1920, r: 0};
  const scale = Math.min(R.w, R.h) / 1080;   // uniform scale for the ring radius — keeps the rings circular
  const cx = R.x + params.x * R.w, cy = R.y + params.y * R.h;
  const rings: {r: number; o: number}[] = [];
  for (let i = 0; i < params.rings; i++) {
    const k = ((t / CYCLE_S - i / params.rings) % 1 + 1) % 1;
    rings.push({r: (80 + k * 520) * scale, o: (1 - k) * PEAK_O});
  }
  return (
    <>
      {rings.map((rg, i) => (
        <div key={i} style={{position: 'absolute', left: cx, top: cy, width: rg.r * 2, height: rg.r * 2,
          transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `5px solid ${theme.acc}`, opacity: rg.o}} />
      ))}
    </>
  );
}
