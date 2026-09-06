/* quote — a rounded title pill. Generalized from compose.reference.html's titleChip().
   params: { text, accent? = false, y? = 202 }
   See scripts/motifs/README.md for the ctx contract. */
'use strict';

module.exports = function quote(ctx) {
  const {X, params, theme, fx} = ctx;
  const {rr, T, rgba, onACC} = fx;
  const text = params.text || '';
  if (!text) return;

  const font = theme.font;
  const y = params.y != null ? params.y : 202;
  const accent = !!params.accent;
  const fill = accent ? theme.acc : rgba(theme.ink, 0.07);
  const ink = accent ? onACC(theme.acc) : theme.ink;

  X.save();
  X.font = '800 40px ' + font;
  const w = X.measureText(text).width + 72;
  const h = 80;
  X.fillStyle = fill;
  rr(540 - w / 2, y - h / 2, w, h, h / 2);
  X.fill();
  X.restore();

  T(text, 540, y + 2, '800 40px ' + font, ink);
};
