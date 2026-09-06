/* checklist — Remotion motif. Mirror of motifs/canvas/checklist.js.
   Props: { prog, wordIndex, theme, params }. params: { title?, items: string[], tick?, y? } */

type Props = {prog: number; wordIndex: number;
  theme: {acc: string; ink: string; mut: string; font: string};
  params: {title?: string; items?: string[]; tick?: string; y?: number}};

const cl = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};

const Check = ({k, color}: {k: number; color: string}) => {
  // two-segment tick, drawn as an SVG polyline revealed by k
  const p = [[-0.32, 0.02], [-0.08, 0.26], [0.34, -0.26]];
  const pts: number[][] = [p[0]];
  if (k < 0.5) { const q = k / 0.5; pts.push([lerp(p[0][0], p[1][0], q), lerp(p[0][1], p[1][1], q)]); }
  else { pts.push(p[1]); const q = (k - 0.5) / 0.5; pts.push([lerp(p[1][0], p[2][0], q), lerp(p[1][1], p[2][1], q)]); }
  const s = 46;
  return (
    <svg width={s} height={s} viewBox="-0.5 -0.5 1 1" style={{overflow: 'visible'}}>
      <polyline points={pts.map((pt) => pt.join(',')).join(' ')} fill="none" stroke={color}
        strokeWidth={0.13} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default function Checklist({prog, wordIndex, theme, params}: Props) {
  const items = Array.isArray(params.items) ? params.items : [];
  if (!items.length) return null;
  const rowH = 100;
  const y0 = params.y != null ? params.y : 340;

  return (
    <>
      {params.title && (
        <div style={{position: 'absolute', left: 0, right: 0, top: y0 - 130 - 20, textAlign: 'center',
          fontFamily: theme.font, fontWeight: 800, fontSize: 40, color: theme.mut}}>{params.title}</div>
      )}
      {items.map((label, i) => {
        let k: number;
        if (params.tick === 'words') k = cl(wordIndex - i + 1, 0, 1);
        else { const t0 = 0.12 + (i / Math.max(1, items.length)) * 0.7; k = cl((prog - t0) / 0.14); }
        const y = y0 + i * rowH;
        return (
          <div key={i} style={{position: 'absolute', left: 250, top: y - 40, width: 580, height: 80,
            opacity: lerp(0.32, 1, easeOut(k)),
            background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
            borderRadius: 24, boxShadow: `0 14px 34px ${rgba(theme.ink, 0.14)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 34px 0 18px',
            direction: 'rtl'}}>
            <span style={{fontFamily: theme.font, fontWeight: 800, fontSize: 42, color: k > 0.3 ? theme.ink : theme.mut}}>{String(label)}</span>
            {k > 0.1 && <Check k={cl((k - 0.1) / 0.6)} color={theme.acc} />}
          </div>
        );
      })}
    </>
  );
}
