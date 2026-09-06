/* checklist — a stack of rows, each a card that fades up (0.32 → 1) with a checkmark
   ticking in. Generalized from compose.reference.html's rtlFix() row reveal.
   params: { title?, items: string[], tick? = "even" ("even" | "words"), y? }
   With tick:"words" each row lights up on the corresponding spoken word of the ref
   sentence (ctx.wordIndex). See scripts/motifs/README.md. */
'use strict';

module.exports = function checklist(ctx) {
  const {X, prog, wordIndex, params, theme, fx} = ctx;
  const {card, iCheck, T, lerp, ease, cl} = fx;
  const items = Array.isArray(params.items) ? params.items : [];
  if (!items.length) return;

  const font = theme.font, acc = theme.acc, ink = theme.ink, mut = theme.mut;
  const rowH = 100;
  const y0 = params.y != null ? params.y : 340;

  if (params.title) T(params.title, 540, y0 - 130, '800 40px ' + font, mut);

  items.forEach((label, i) => {
    // k = 0..1 reveal for this row
    let k;
    if (params.tick === 'words') {
      k = cl(wordIndex - i + 1, 0, 1);          // row i lights when wordIndex reaches i
    } else {
      const t0 = 0.12 + (i / Math.max(1, items.length)) * 0.7;
      k = cl((prog - t0) / 0.14, 0, 1);
    }
    const y = y0 + i * rowH;

    X.save();
    X.globalAlpha *= lerp(0.32, 1, ease(k));
    card(250, y - 40, 580, 80, 24, 1);
    T(String(label), 790, y + 2, '800 42px ' + font, k > 0.3 ? ink : mut, 'right');
    if (k > 0.1) iCheck(310, y, 46, acc, cl((k - 0.1) / 0.6, 0, 1));
    X.restore();
  });
};
