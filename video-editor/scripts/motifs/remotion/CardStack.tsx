/* card-stack — Remotion motif. Mirror of motifs/canvas/card-stack.js.
   Props: { prog, wordIndex, theme, params }. */
type Props = {prog: number; wordIndex: number;
  theme: {acc: string; ink: string; font: string};
  params: {items?: string[]; columns?: number; checkmark?: boolean; flipAt?: number}};

const cl = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
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

export default function CardStack({prog, wordIndex, theme, params}: Props) {
  const items = Array.isArray(params.items) ? params.items : [];
  if (!items.length) return null;
  const cols = params.columns != null ? params.columns : 2;
  const rows = Math.ceil(items.length / cols);
  const cw = 418, ch = 124, gx = 40, gy = 30;
  const gridW = cols * cw + (cols - 1) * gx;
  const gridH = rows * ch + (rows - 1) * gy;
  const cyMid = 384;
  const showCheck = params.checkmark !== false;

  return (
    <>
      {items.map((label, i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const cx = 540 - gridW / 2 + cw / 2 + c * (cw + gx);
        const cy = cyMid - gridH / 2 + ch / 2 + r * (ch + gy);
        const t0 = 0.05 + (i / items.length) * 0.4;
        const k = cl((prog - t0) / 0.14);
        if (k <= 0) return null;
        const flipAt = params.flipAt != null ? params.flipAt : 0.6;
        const fk = !showCheck ? 0 : (wordIndex >= 0 ? cl(wordIndex - i + 1) : cl((prog - flipAt - i * 0.04) / 0.2));
        const acc = fk > 0.5;
        return (
          <div key={i} style={{position: 'absolute', left: cx - cw / 2, top: cy - ch / 2, width: cw, height: ch,
            transform: `scale(${lerp(0.7, 1, back(k))}) rotate(${lerp(-3 * (i % 2 ? -1 : 1), 0, easeOut(k))}deg)`,
            background: acc ? theme.acc : rgba(theme.ink, 0.03),
            border: `2.5px solid ${rgba(theme.ink, 0.09)}`, borderRadius: 34,
            boxShadow: `0 18px 44px ${rgba(theme.ink, acc ? 0.22 : 0.14)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute',
            fontFamily: theme.font, fontWeight: 800, fontSize: 46, color: acc ? onAccentInk(theme.acc) : theme.ink}}>
            {showCheck && fk > 0.15 && (
              <span style={{position: 'absolute', left: 40, fontSize: 40, color: acc ? onAccentInk(theme.acc) : theme.acc}}>✓</span>
            )}
            {String(label)}
          </div>
        );
      })}
    </>
  );
}
