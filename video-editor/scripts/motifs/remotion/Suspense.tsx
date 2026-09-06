/* suspense — Remotion motif. Mirror of motifs/canvas/suspense.js. Props: { prog, theme, params }. */
type Props = {prog: number; theme: {acc: string}; params: {rings?: number; x?: number; y?: number}};

export default function Suspense({prog, theme, params}: Props) {
  const n = params.rings != null ? params.rings : 2;
  const cx = params.x != null ? params.x : 540;
  const cy = params.y != null ? params.y : 760;
  const rings: {r: number; o: number}[] = [];
  for (let i = 0; i < n; i++) {
    const k = ((prog * 2 - i * 0.55) % 1 + 1) % 1;
    if (k > 0 && k < 1) rings.push({r: 80 + k * 520, o: (1 - k) * 0.14});
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
