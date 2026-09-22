/* suspense — Remotion motif. Props: { prog, theme, params }. */
import {W, H} from '../theme';
type Props = {prog: number; theme: {acc: string}; params: {rings?: number; x?: number; y?: number}};

export default function Suspense({prog, theme, params}: Props) {
  const sy = H / 1920;   // uniform scale for the ring radius — keeps the rings circular, not stretched
  const n = params.rings != null ? params.rings : 2;
  // params.x/y are author-placed (an entry's scene.params, tuned live at the real composition
  // size) and used verbatim; only the codebase default scales with the frame.
  const cx = params.x != null ? params.x : W / 2;
  const cy = params.y != null ? params.y : 760 * sy;
  const rings: {r: number; o: number}[] = [];
  for (let i = 0; i < n; i++) {
    const k = ((prog * 2 - i * 0.55) % 1 + 1) % 1;
    if (k > 0 && k < 1) rings.push({r: (80 + k * 520) * sy, o: (1 - k) * 0.14});
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
