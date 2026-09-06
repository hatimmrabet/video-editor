/* file-merge — Remotion motif. Mirror of motifs/canvas/file-merge.js.
   Props: { prog, theme, params }. */
type Props = {prog: number; theme: {acc: string; ink: string; mut: string; clay?: string; font: string};
  params: {sources?: string[]; targetLabel?: string; note?: string; done?: string}};

const cl = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const eio = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};
const onAccentInk = (hex: string) => {
  const h = hex.replace('#', '');
  const l = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] > 0.45 ? '#111' : '#FFF';
};

export default function FileMerge({prog, theme, params}: Props) {
  const sources = Array.isArray(params.sources) ? params.sources : [];
  const px = 170, py = 200, pw = 740, ph = 380;
  const lk = cl((prog - 0.8) / 0.15);

  return (
    <>
      <div style={{position: 'absolute', left: px, top: py, width: pw, height: ph, borderRadius: 34,
        background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
        boxShadow: `0 18px 44px ${rgba(theme.ink, 0.2)}`, fontFamily: theme.font}}>
        {params.targetLabel && (
          <div style={{position: 'absolute', top: 40, right: 60, fontWeight: 900, fontSize: 56, color: theme.ink}}>{params.targetLabel}</div>
        )}
        {params.targetLabel && <div style={{position: 'absolute', top: 142, left: 34, right: 34, borderTop: `2px solid ${rgba(theme.ink, 0.1)}`}} />}
        {params.note && (
          <div style={{position: 'absolute', top: 185, left: 0, right: 0, textAlign: 'center', fontWeight: 700, fontSize: 40, color: theme.mut}}>{params.note}</div>
        )}
      </div>
      {sources.map((label, i) => {
        const n = sources.length;
        const t0 = 0.1 + (i / Math.max(1, n)) * 0.55;
        const k = cl((prog - t0) / 0.3);
        if (k <= 0) return null;
        const e = eio(k);
        const sx = 540 + (i - (n - 1) / 2) * 320;
        const x = lerp(sx, 540, e), y = lerp(1180, py + 300, e), sc = lerp(1, 0.82, e);
        return (
          <div key={i} style={{position: 'absolute', left: x, top: y, transform: `translate(-50%,-50%) scale(${sc})`,
            opacity: k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15,
            background: theme.acc, color: onAccentInk(theme.acc), borderRadius: 999, padding: '18px 32px',
            fontFamily: theme.font, fontWeight: 800, fontSize: 40, whiteSpace: 'nowrap',
            boxShadow: `0 10px 26px ${rgba(theme.ink, 0.2)}`}}>{String(label)}</div>
        );
      })}
      {lk > 0 && params.done && (
        <div style={{position: 'absolute', left: 540, top: py + 300, transform: 'translate(-50%,-50%)',
          opacity: easeOut(lk), background: rgba(theme.acc, 0.14), color: theme.clay || theme.acc,
          borderRadius: 999, padding: '14px 40px', fontFamily: theme.font, fontWeight: 800, fontSize: 44, whiteSpace: 'nowrap'}}>
          {String(params.done)}
        </div>
      )}
    </>
  );
}
