/* counter — Remotion motif. Mirror of motifs/canvas/counter.js.
   Props: { t, prog, theme, params }. Self-contained. */

type Params = {title?: string; from?: number; to?: number; prefix?: string; suffix?: string;
  decimals?: number; settleAt?: number; scramble?: boolean};
type Props = {t: number; prog: number; theme: {acc: string; ink: string; mut: string; font: string}; params: Params};

const cl = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);
const back = (k: number) => { const c = 1.9, s = c + 1; return 1 + s * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};

export default function Counter({t, prog, theme, params}: Props) {
  const to = Number(params.to || 0);
  const from = Number(params.from || 0);
  const prefix = params.prefix || '';
  const suffix = params.suffix || '';
  const dec = params.decimals != null ? params.decimals : (String(to).indexOf('.') >= 0 ? 2 : 0);
  const settleAt = params.settleAt != null ? params.settleAt : 0.55;
  const scramble = params.scramble !== false;

  let val: number, settleK = 0;
  if (prog < settleAt) {
    if (scramble) {
      const r = Math.sin(Math.floor(t * 30) * 12.9898) * 43758.5453;
      const noise = Math.abs(r - Math.floor(r));
      const span = Math.abs(to - from) || 90;
      val = Math.min(from, to) + noise * span;
    } else {
      val = from;
    }
  } else {
    settleK = cl((prog - settleAt) / 0.15);
    val = lerp(from, to, easeOut(settleK));
  }

  const s = prefix + val.toFixed(dec) + suffix;
  const sc = settleK > 0 ? lerp(1.55, 1, back(settleK)) : 1;
  const sy = settleK > 0 ? Math.sin(settleK * Math.PI * 3) * (1 - settleK) * 10 : 0;
  const uk = settleK > 0 ? easeOut(cl((prog - settleAt) / 0.35)) : 0;

  return (
    <>
      {params.title && (
        <div style={{position: 'absolute', left: 0, right: 0, top: 262 - 22, textAlign: 'center',
          fontFamily: theme.font, fontWeight: 700, fontSize: 44, color: theme.mut}}>{params.title}</div>
      )}
      <div dir="ltr" style={{position: 'absolute', left: 540, top: 412 + sy,
        transform: `translate(-50%,-50%) scale(${sc})`, fontFamily: theme.font, fontWeight: 900,
        fontSize: 150, color: settleK > 0 ? theme.acc : rgba(theme.ink, 0.35), whiteSpace: 'nowrap'}}>{s}</div>
      {uk > 0 && (
        <div style={{position: 'absolute', left: 540, top: 502, width: 460 * uk, height: 10,
          transform: 'translateX(-50%)', background: theme.acc, borderRadius: 5}} />
      )}
      {settleK > 0 && settleK < 1 && (
        <div style={{position: 'absolute', left: 540, top: 412,
          width: 240 + settleK * 600, height: 240 + settleK * 600, transform: 'translate(-50%,-50%)',
          borderRadius: '50%', border: `7px solid ${theme.acc}`, opacity: (1 - settleK) * 0.4}} />
      )}
    </>
  );
}
