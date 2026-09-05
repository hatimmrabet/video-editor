/* stamp — Remotion motif. Mirror of motifs/canvas/stamp.js.
   Props (from the #18 dispatcher): { enter, exit, hold, words, wordIndex, rect, theme, params }.
   Self-contained for now — #18 decides how motifs share util.tsx / theme.ts.
   params: { text, lead?, rotation? = -7, ring? = true, at? } · see scripts/motifs/README.md */

type Params = {text?: string; lead?: string; rotation?: number; ring?: boolean; at?: {x: number; y: number}};
type Props = {enter: number; theme: {acc: string; ink: string; font: string}; params: Params};

const back = (k: number) => { const c = 1.9, s = c + 1; return 1 + s * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
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

export default function Stamp({enter, theme, params}: Props) {
  const text = params.text || '';
  const lead = params.lead || '';
  if (!text && !lead) return null;

  const rot = params.rotation == null ? -7 : params.rotation;
  const at = params.at || {x: 540, y: 320};
  const pop = lerp(1.5, 1, back(enter));
  const ink = onAccentInk(theme.acc);

  return (
    <>
      {params.ring !== false && enter < 1 && (
        <div style={{
          position: 'absolute', left: at.x, top: at.y,
          width: 120 + enter * 600, height: 120 + enter * 600,
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          border: `6px solid ${theme.acc}`, opacity: (1 - enter) * 0.45,
        }} />
      )}
      <div style={{
        position: 'absolute', left: at.x, top: at.y,
        transform: `translate(-50%,-50%) rotate(${rot}deg) scale(${pop})`,
        display: 'flex', alignItems: 'center', gap: lead ? 26 : 0,
        background: theme.acc, color: ink, borderRadius: 26, padding: '26px 42px',
        fontFamily: theme.font, fontWeight: 900, whiteSpace: 'nowrap',
        boxShadow: `0 16px 40px ${rgba(theme.ink, 0.26)}`,
      }}>
        {lead && <span dir="ltr" style={{fontSize: 58}}>{lead}</span>}
        <span style={{fontSize: 52}}>{text}</span>
      </div>
    </>
  );
}
