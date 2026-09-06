/* transcript-panel — a card with a header and lines that appear one per spoken word of the
   ref sentence (with timestamps), the panel scrolling to keep the newest visible. From
   compose.reference.html's transcript().
   params: { title?, lines? = string[] (override; default = ctx.words) } */
'use strict';

module.exports = function transcriptPanel(ctx) {
  const {X, t, words, params, theme, fx} = ctx;
  const {rr, card, T, rgba, ease, pr} = fx;
  const font = theme.font, acc = theme.acc, ink = theme.ink, mut = theme.mut;
  const px = 150, py = 196, pw = 780, ph = 404;

  card(px, py, pw, ph, 32, 1);
  X.fillStyle = rgba(ink, 0.22);
  for (let i = 0; i < 3; i++) { X.beginPath(); X.arc(px + pw - 46 - i * 36, py + 44, 10, 0, 7); X.fill(); }
  if (params.title) T(params.title, px + pw - 160, py + 46, '700 34px ' + font, mut, 'right');
  X.strokeStyle = rgba(ink, 0.10);
  X.lineWidth = 2;
  X.beginPath(); X.moveTo(px + 28, py + 86); X.lineTo(px + pw - 28, py + 86); X.stroke();

  const override = Array.isArray(params.lines) ? params.lines.map((s, i) => ({t: String(s), s: -1, i})) : null;
  const src = override || (words || []);
  const shown = override ? src : src.filter((w) => t >= w.s);
  const RH = 62, maxR = 4, off = Math.max(0, shown.length - maxR);

  X.save();
  X.beginPath();
  X.rect(px + 18, py + 96, pw - 36, ph - 112);
  X.clip();
  shown.forEach((w, i) => {
    const k = w.s < 0 ? 1 : pr(t, w.s, w.s + 0.22);
    const y = py + 120 + (i - off) * RH + (1 - ease(k)) * 16;
    if (y < py + 90 || y > py + ph - 10) return;
    X.save();
    X.globalAlpha *= ease(k) * (i < off ? 0.35 : 1);
    T(w.t, px + pw - 46, y, '800 44px ' + font, i === shown.length - 1 ? acc : ink, 'right');
    if (w.s >= 0) {
      X.save();
      X.direction = 'ltr';
      const mm = String(Math.floor(w.s / 60)).padStart(2, '0');
      const ss = (w.s % 60).toFixed(2).padStart(5, '0');
      T(mm + ':' + ss, px + 46, y, '600 30px ' + font, mut, 'left');
      X.restore();
    }
    X.restore();
  });
  X.restore();
};
