/* quote — Remotion motif. Mirror of motifs/canvas/quote.js.
   Props: { theme, params }. params: { text, accent? = false, y? = 202 }. Self-contained. */

type Props = {theme: {acc: string; ink: string; font: string}; params: {text?: string; accent?: boolean; y?: number}};

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

export default function Quote({theme, params}: Props) {
  const text = params.text || '';
  if (!text) return null;
  const y = params.y != null ? params.y : 202;
  const accent = !!params.accent;
  return (
    <div style={{position: 'absolute', left: 0, right: 0, top: y, transform: 'translateY(-50%)',
      display: 'flex', justifyContent: 'center'}}>
      <div style={{
        background: accent ? theme.acc : rgba(theme.ink, 0.07),
        color: accent ? onAccentInk(theme.acc) : theme.ink,
        fontFamily: theme.font, fontWeight: 800, fontSize: 40,
        height: 80, lineHeight: '80px', padding: '0 36px', borderRadius: 40, whiteSpace: 'nowrap',
      }}>{text}</div>
    </div>
  );
}
