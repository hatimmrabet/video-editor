/* SUSPENSE — an overlay: rings pulsing outward from a point on the video card.
   What it does and accepts: ../SUSPENSE.ts */
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {SUSPENSE} from '../SUSPENSE.ts';

type Props = {prog: number; rect?: Rect; theme: {acc: string}; params: Params<typeof SUSPENSE.params>};

export default function Suspense({prog, rect, theme, params}: Props) {
  const R = rect || {x: 0, y: 0, w: 1080, h: 1920, r: 0};
  const scale = Math.min(R.w, R.h) / 1080;   // uniform scale for the ring radius — keeps the rings circular
  const cx = R.x + params.x * R.w, cy = R.y + params.y * R.h;
  const rings: {r: number; o: number}[] = [];
  for (let i = 0; i < params.rings; i++) {
    const k = ((prog * 2 - i * 0.55) % 1 + 1) % 1;
    if (k > 0 && k < 1) rings.push({r: (80 + k * 520) * scale, o: (1 - k) * 0.14});
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
