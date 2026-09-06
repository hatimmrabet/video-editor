/* file-merge — several source chips fly into one central card. From
   compose.reference.html's fileToCloud() / oneFile().
   params: { sources: string[], targetLabel?, note? } */
'use strict';

module.exports = function fileMerge(ctx) {
  const {X, prog, params, theme, fx} = ctx;
  const {card, rr, sh, nsh, T, rgba, onACC, lerp, ease, eio, cl} = fx;
  const font = theme.font, acc = theme.acc, ink = theme.ink, mut = theme.mut;
  const sources = Array.isArray(params.sources) ? params.sources : [];

  const px = 170, py = 200, pw = 740, ph = 380;
  card(px, py, pw, ph, 34, 1);
  if (params.targetLabel) {
    T(params.targetLabel, px + pw - 60, py + 82, '900 56px ' + font, ink, 'right');
    X.strokeStyle = rgba(ink, 0.10);
    X.lineWidth = 2;
    X.beginPath(); X.moveTo(px + 34, py + 142); X.lineTo(px + pw - 34, py + 142); X.stroke();
  }
  if (params.note) T(params.note, 540, py + 205, '700 40px ' + font, mut);

  sources.forEach((label, i) => {
    const n = sources.length;
    const t0 = 0.1 + (i / Math.max(1, n)) * 0.55;
    const k = cl((prog - t0) / 0.3, 0, 1);
    if (k <= 0) return;
    const e = eio(k);
    const sx = 540 + (i - (n - 1) / 2) * 320;
    const sy = 1180;
    const x = lerp(sx, 540, e), y = lerp(sy, py + 300, e), sc = lerp(1, 0.82, e);
    X.save();
    X.globalAlpha *= k < 0.85 ? 1 : 1 - (k - 0.85) / 0.15;
    X.translate(x, y);
    X.scale(sc, sc);
    X.font = '800 40px ' + font;
    const w = X.measureText(String(label)).width + 64, h = 78;
    sh(26, 10, 0.2);
    X.fillStyle = acc;
    rr(-w / 2, -h / 2, w, h, h / 2);
    X.fill();
    nsh();
    T(String(label), 0, 3, '800 40px ' + font, onACC(acc));
    X.restore();
  });

  const lk = cl((prog - 0.8) / 0.15, 0, 1);
  if (lk > 0 && params.done) {
    X.save();
    X.globalAlpha *= ease(lk);
    X.font = '800 44px ' + font;
    const w = X.measureText(String(params.done)).width + 80;
    const y = py + 300;
    X.fillStyle = rgba(acc, 0.14);
    rr(540 - w / 2, y - 42, w, 84, 42);
    X.fill();
    T(String(params.done), 540, y + 2, '800 44px ' + font, theme.clay || acc);
    X.restore();
  }
};
