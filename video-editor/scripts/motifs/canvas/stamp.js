/* stamp — an accent pill that pops in rotated, with an optional leading token and an
   expanding ring. Generalized from compose.reference.html's stamp(t).
   params: { text, lead?, rotation? = -7, ring? = true, at? = {x:540,y:320} }
   See scripts/motifs/README.md for the ctx contract. */
'use strict';

module.exports = function stamp(ctx) {
  const { X, params, theme, fx, enter } = ctx;
  const { rr, sh, nsh, T, onACC, back, lerp } = fx;

  const text = params.text || '';
  const lead = params.lead || '';
  if (!text && !lead) return;

  const rot = (params.rotation == null ? -7 : params.rotation) * Math.PI / 180;
  const at = params.at || { x: 540, y: 320 };
  const acc = theme.acc;
  const font = theme.font;
  const ink = onACC(acc);

  const k = enter;                              // raw 0..1 — the motif owns its easing
  const pop = lerp(1.5, 1, back(k));

  X.save();
  X.translate(at.x, at.y);
  X.rotate(rot);
  X.scale(pop, pop);

  X.font = '900 52px ' + font;
  const tw = X.measureText(text).width;
  let lw = 0;
  if (lead) { X.font = '900 58px ' + font; lw = X.measureText(lead).width; }
  const gap = lead ? 26 : 0;
  const w = 84 + lw + gap + tw, h = 112;

  sh(40, 16, 0.26);
  X.fillStyle = acc;
  rr(-w / 2, -h / 2, w, h, 26);
  X.fill();
  nsh();

  if (lead) T(lead, -w / 2 + 42 + lw / 2, 4, '900 58px ' + font, ink, 'center', 'ltr');
  T(text, w / 2 - 42 - tw / 2, 4, '900 52px ' + font, ink);
  X.restore();

  if (params.ring !== false && k < 1) {
    X.save();
    X.globalAlpha *= (1 - k) * 0.45;
    X.strokeStyle = acc;
    X.lineWidth = 6;
    X.beginPath();
    X.arc(at.x, at.y, 60 + k * 300, 0, 7);
    X.stroke();
    X.restore();
  }
};
