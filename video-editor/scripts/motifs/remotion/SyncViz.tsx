/* sync-viz — Remotion motif. Mirror of motifs/canvas/sync-viz.js.
   Props: { prog, words, theme, params }. */
type W = {s: number};
type Props = {prog: number; words?: W[]; theme: {acc: string; ink: string; font: string};
  params: {title?: string; bars?: number; markers?: number[]}};

const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};
const cl = (v: number) => Math.max(0, Math.min(1, v));

export default function SyncViz({prog, words, theme, params}: Props) {
  const x0 = 110, x1 = 970, yb = 1215;
  const N = params.bars != null ? params.bars : 68;
  const bars = Array.from({length: N}, (_, i) => {
    const px = x0 + (x1 - x0) * (i / (N - 1));
    const h = 18 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.53)) * 74;
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
        <div style={{position: 'absolute', left: 540 - 260, top: 1058, width: 520, height: 84,
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
        const hit = cl((prog - m) / 0.06);
        return (
          <div key={i}>
            <div style={{position: 'absolute', left: mx, top: yb, width: (hit < 1 ? 26 : 20), height: (hit < 1 ? 26 : 20),
              transform: 'translate(-50%,-50%)', borderRadius: '50%', background: theme.acc}} />
            {hit < 1 && (
              <div style={{position: 'absolute', left: mx, top: yb, width: 28 + hit * 108, height: 28 + hit * 108,
                transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `6px solid ${theme.acc}`, opacity: (1 - hit) * 0.9}} />
            )}
          </div>
        );
      })}
      <div style={{position: 'absolute', left: px, top: yb - 92, width: 4, height: 184, transform: 'translateX(-50%)', background: theme.ink}} />
      <div style={{position: 'absolute', left: px, top: yb - 100, width: 22, height: 22, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: theme.ink}} />
    </>
  );
}
