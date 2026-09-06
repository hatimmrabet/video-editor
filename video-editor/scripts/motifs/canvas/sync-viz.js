/* sync-viz — a waveform bar chart with a progress sweep and pulse markers. From
   compose.reference.html's syncViz().
   params: { title?, bars? = 68, markers? = number[] (0..1 positions; default = evenly from ctx.words) } */
'use strict';

module.exports = function syncViz(ctx) {
  const {X, prog, words, params, theme, fx} = ctx;
  const {rr, card, T, rgba, cl} = fx;
  const font = theme.font, acc = theme.acc, ink = theme.ink;
  const x0 = 110, x1 = 970, yb = 1215;
  const N = params.bars != null ? params.bars : 68;

  if (params.title) {
    card(540 - 260, 1058, 520, 84, 42, 1);
    T(params.title, 540, 1102, '800 38px ' + font, ink);
  }

  for (let i = 0; i < N; i++) {
    const px = x0 + (x1 - x0) * (i / (N - 1));
    const h = 18 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.53)) * 74;
    X.fillStyle = px <= x0 + (x1 - x0) * prog ? acc : rgba(ink, 0.2);
    rr(px - 4, yb - h / 2, 8, h, 4);
    X.fill();
  }

  let marks = params.markers;
  if (!Array.isArray(marks) || !marks.length) {
    const w = words || [];
    marks = w.length ? w.map((_, i) => (i + 0.5) / w.length) : [0.3, 0.6, 0.85];
  }
  marks.forEach((m) => {
    const mx = x0 + (x1 - x0) * m;
    const hit = cl((prog - m) / 0.06, 0, 1);
    if (prog >= m) {
      X.fillStyle = acc;
      X.beginPath();
      X.arc(mx, yb, hit < 1 ? 13 : 10, 0, 7);
      X.fill();
      if (hit < 1) {
        X.save();
        X.globalAlpha *= (1 - hit) * 0.9;
        X.strokeStyle = acc;
        X.lineWidth = 6;
        X.beginPath();
        X.arc(mx, yb, 14 + hit * 54, 0, 7);
        X.stroke();
        X.restore();
      }
    }
  });

  const px = x0 + (x1 - x0) * prog;
  X.strokeStyle = ink;
  X.lineWidth = 4;
  X.beginPath();
  X.moveTo(px, yb - 92);
  X.lineTo(px, yb + 92);
  X.stroke();
  X.fillStyle = ink;
  X.beginPath();
  X.arc(px, yb - 100, 11, 0, 7);
  X.fill();
};
