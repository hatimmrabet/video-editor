/* comment-box — Remotion motif. Mirror of motifs/canvas/comment-box.js.
   Props: { t, prog, theme, params }. */
type Props = {t: number; prog: number; theme: {acc: string; ink: string; font: string};
  params: {word?: string; placeholder?: string}};

const cl = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const back = (k: number) => { const c = 1.9, s = c + 1; return 1 + s * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
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

export default function CommentBox({t, prog, theme, params}: Props) {
  const bx = 140, by = 1120, bw = 800, bh = 124;
  const full = String(params.word || '');
  const tk = cl((prog - 0.25) / 0.35);
  const shown = full.slice(0, Math.round(tk * full.length));
  const caret = tk > 0 && tk < 1 && Math.floor(t * 6) % 2 === 0;
  const sk = cl((prog - 0.62) / 0.14);

  return (
    <div style={{position: 'absolute', left: bx, top: by, width: bw, height: bh, borderRadius: 62,
      background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
      boxShadow: `0 18px 44px ${rgba(theme.ink, 0.2)}`, fontFamily: theme.font,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', direction: 'rtl'}}>
      {sk > 0 ? (
        <div style={{width: 88, height: 88, borderRadius: '50%', background: theme.acc, flexShrink: 0,
          transform: `scale(${lerp(0.6, 1, back(sk))})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 10px 24px ${rgba(theme.ink, 0.22)}`, color: onAccentInk(theme.acc), fontSize: 44}}>➤</div>
      ) : (
        <div style={{width: 84, height: 84, borderRadius: '50%', background: rgba(theme.ink, 0.1), flexShrink: 0}} />
      )}
      <div style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 46,
        color: shown ? theme.ink : rgba(theme.ink, 0.3)}}>
        {shown || params.placeholder || '…'}
        {caret && <span style={{width: 4, height: 52, background: theme.acc, display: 'inline-block'}} />}
      </div>
    </div>
  );
}
