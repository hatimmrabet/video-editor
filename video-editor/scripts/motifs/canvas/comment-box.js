/* comment-box — an Instagram-style comment field that types out a word, then a send
   button pops. From compose.reference.html's commentBox().
   params: { word, placeholder? } */
'use strict';

module.exports = function commentBox(ctx) {
  const {X, t, prog, params, theme, fx} = ctx;
  const {card, rr, sh, nsh, T, rgba, onACC, lerp, back, cl} = fx;
  const font = theme.font, acc = theme.acc, ink = theme.ink;
  const bx = 140, by = 1120, bw = 800, bh = 124;

  card(bx, by, bw, bh, 62, 1);
  X.fillStyle = rgba(ink, 0.10);   // avatar placeholder
  X.beginPath();
  X.arc(bx + bw - 66, by + bh / 2, 42, 0, 7);
  X.fill();

  const full = String(params.word || '');
  const tk = cl((prog - 0.25) / 0.35, 0, 1);
  const shown = full.slice(0, Math.round(tk * full.length));
  const ph = params.placeholder || '…';
  T(shown || ph, bx + bw - 130, by + bh / 2 + 2, '700 46px ' + font, shown ? ink : rgba(ink, 0.30), 'right');

  if (tk > 0 && tk < 1 && Math.floor(t * 6) % 2 === 0) {
    X.font = '700 46px ' + font;
    const w = X.measureText(shown).width;
    X.fillStyle = acc;
    X.fillRect(bx + bw - 134 - w, by + bh / 2 - 26, 4, 52);
  }

  const sk = cl((prog - 0.62) / 0.14, 0, 1);
  if (sk > 0) {
    X.save();
    const s = lerp(0.6, 1, back(sk));
    X.translate(bx + 72, by + bh / 2);
    X.scale(s, s);
    sh(24, 10, 0.22);
    X.fillStyle = acc;
    X.beginPath();
    X.arc(0, 0, 44, 0, 7);
    X.fill();
    nsh();
    X.strokeStyle = onACC(acc);
    X.lineWidth = 6;
    X.lineCap = 'round';
    X.lineJoin = 'round';
    X.beginPath();
    X.moveTo(14, 0); X.lineTo(-14, 0);
    X.moveTo(-14, 0); X.lineTo(-2, -12);
    X.moveTo(-14, 0); X.lineTo(-2, 12);
    X.stroke();
    X.restore();
  }
};
