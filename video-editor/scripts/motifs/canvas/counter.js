/* counter — a big number that scrambles, then settles to `to` with a pop, an underline
   and an expanding ring. Generalized from compose.reference.html's price(t).
   params: { title?, from? = 0, to, prefix? = "", suffix? = "", decimals?, settleAt? = 0.55, scramble? = true }
   See scripts/motifs/README.md for the ctx contract. */
'use strict';

module.exports = function counter(ctx) {
  const {X, t, prog, params, theme, fx} = ctx;
  const {rr, T, rgba, lerp, ease, back, cl} = fx;
  const font = theme.font, acc = theme.acc, mut = theme.mut;

  const to = Number(params.to || 0);
  const from = Number(params.from || 0);
  const prefix = params.prefix || '';
  const suffix = params.suffix || '';
  const dec = params.decimals != null ? params.decimals : (String(to).indexOf('.') >= 0 ? 2 : 0);
  const settleAt = params.settleAt != null ? params.settleAt : 0.55;
  const scramble = params.scramble !== false;

  if (params.title) T(params.title, 540, 262, '700 44px ' + font, mut);

  let val, settleK = 0;
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
    settleK = cl((prog - settleAt) / 0.15, 0, 1);
    val = lerp(from, to, ease(settleK));
  }

  const s = prefix + val.toFixed(dec) + suffix;
  const sc = settleK > 0 ? lerp(1.55, 1, back(settleK)) : 1;
  const sy = settleK > 0 ? Math.sin(settleK * Math.PI * 3) * (1 - settleK) * 10 : 0;

  X.save();
  X.direction = 'ltr';
  X.translate(540, 412 + sy);
  X.scale(sc, sc);
  T(s, 0, 0, '900 150px ' + font, settleK > 0 ? acc : rgba(theme.ink, 0.35));
  X.restore();

  if (settleK > 0) {
    const uk = ease(cl((prog - settleAt) / 0.35, 0, 1));
    X.fillStyle = acc;
    rr(540 - 230 * uk, 502, 460 * uk, 10, 5);
    X.fill();
    if (settleK < 1) {
      X.save();
      X.globalAlpha *= (1 - settleK) * 0.4;
      X.strokeStyle = acc;
      X.lineWidth = 7;
      X.beginPath();
      X.arc(540, 412, 120 + settleK * 300, 0, 7);
      X.stroke();
      X.restore();
    }
  }
};
