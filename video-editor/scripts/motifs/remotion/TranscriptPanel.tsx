/* transcript-panel — Remotion motif. Mirror of motifs/canvas/transcript-panel.js.
   Props: { t, words, theme, params }. */
type W = {t: string; s: number; e: number};
type Props = {t: number; words?: W[]; theme: {acc: string; ink: string; mut: string; font: string};
  params: {title?: string; lines?: string[]}};

const cl = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};

export default function TranscriptPanel({t, words, theme, params}: Props) {
  const px = 150, py = 196, pw = 780, ph = 404;
  const override = Array.isArray(params.lines);
  const src: any[] = override ? params.lines!.map((s, i) => ({t: String(s), s: -1})) : (words || []);
  const shown = override ? src : src.filter((w) => t >= w.s);
  const RH = 62, maxR = 4, off = Math.max(0, shown.length - maxR);

  return (
    <div style={{position: 'absolute', left: px, top: py, width: pw, height: ph, borderRadius: 32,
      background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
      boxShadow: `0 18px 44px ${rgba(theme.ink, 0.2)}`, overflow: 'hidden', fontFamily: theme.font}}>
      <div style={{position: 'absolute', top: 30, right: 34, display: 'flex', gap: 16}}>
        {[0, 1, 2].map((i) => <div key={i} style={{width: 20, height: 20, borderRadius: '50%', background: rgba(theme.ink, 0.22)}} />)}
      </div>
      {params.title && (
        <div style={{position: 'absolute', top: 26, right: 100, fontWeight: 700, fontSize: 34, color: theme.mut}}>{params.title}</div>
      )}
      <div style={{position: 'absolute', top: 86, left: 28, right: 28, borderTop: `2px solid ${rgba(theme.ink, 0.1)}`}} />
      <div style={{position: 'absolute', top: 96, left: 18, right: 18, bottom: 16, overflow: 'hidden'}}>
        {shown.map((w, i) => {
          const k = w.s < 0 ? 1 : cl((t - w.s) / 0.22);
          const y = 24 + (i - off) * RH + (1 - easeOut(k)) * 16;
          if (y < -RH || y > ph - 110) return null;
          return (
            <div key={i} style={{position: 'absolute', top: y, left: 28, right: 28,
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
