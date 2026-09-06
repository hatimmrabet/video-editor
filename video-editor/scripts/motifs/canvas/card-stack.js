/* card-stack — a grid of labeled cards that pop in staggered, each optionally flipping to
   the accent colour with a checkmark. From compose.reference.html's chips() / cardStack().
   params: { items: string[], columns? = 2, checkmark? = true, flipAt? = 0.6 } */
'use strict';

module.exports = function cardStack(ctx) {
  const {X, prog, wordIndex, params, theme, fx} = ctx;
  const {card, rr, sh, nsh, iCheck, T, onACC, lerp, ease, back, cl} = fx;
  const items = Array.isArray(params.items) ? params.items : [];
  if (!items.length) return;

  const font = theme.font, acc = theme.acc, ink = theme.ink;
  const cols = params.columns != null ? params.columns : 2;
  const rows = Math.ceil(items.length / cols);
  const cw = 418, ch = 124, gx = 40, gy = 30;
  const gridW = cols * cw + (cols - 1) * gx;
  const gridH = rows * ch + (rows - 1) * gy;
  const cyMid = 384;   // grid vertical centre

  items.forEach((label, i) => {
    const c = i % cols, r = Math.floor(i / cols);
    const cx = 540 - gridW / 2 + cw / 2 + c * (cw + gx);
    const cy = cyMid - gridH / 2 + ch / 2 + r * (ch + gy);

    const t0 = 0.05 + (i / items.length) * 0.4;
    const k = cl((prog - t0) / 0.14, 0, 1);
    if (k <= 0) return;

    let fk = 0;
    if (params.checkmark !== false) {
      const flipAt = params.flipAt != null ? params.flipAt : 0.6;
      fk = wordIndex >= 0 ? cl(wordIndex - i + 1, 0, 1) : cl((prog - flipAt - i * 0.04) / 0.2, 0, 1);
    }

    X.save();
    X.translate(cx, cy);
    X.scale(lerp(0.7, 1, back(k)), lerp(0.7, 1, back(k)));
    X.rotate(lerp(-0.05 * (i % 2 ? -1 : 1), 0, ease(k)));
    X.translate(-cx, -cy);
    card(cx - cw / 2, cy - ch / 2, cw, ch, 34, ease(k));
    if (fk > 0) {
      X.save();
      X.globalAlpha *= fk;
      sh(34, 14, 0.22);
      X.fillStyle = acc;
      rr(cx - cw / 2, cy - ch / 2, cw, ch, 34);
      X.fill();
      nsh();
      X.restore();
    }
    T(String(label), cx - 16, cy + 3, '800 46px ' + font, fk > 0.55 ? onACC(acc) : ink, 'center');
    if (params.checkmark !== false && fk > 0.15) {
      iCheck(cx - cw / 2 + 58, cy, 46, fk > 0.55 ? onACC(acc) : acc, cl((fk - 0.15) / 0.5, 0, 1));
    }
    X.restore();
  });
};
