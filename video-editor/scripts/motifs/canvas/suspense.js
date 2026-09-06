/* suspense — expanding concentric accent rings. From compose.reference.html's suspense().
   params: { rings? = 2, x? = 540, y? = 760 } */
'use strict';

module.exports = function suspense(ctx) {
  const {X, prog, params, theme} = ctx;
  const n = params.rings != null ? params.rings : 2;
  const cx = params.x != null ? params.x : 540;
  const cy = params.y != null ? params.y : 760;
  X.save();
  X.strokeStyle = theme.acc;
  X.lineWidth = 5;
  for (let i = 0; i < n; i++) {
    const k = ((prog * 2 - i * 0.55) % 1 + 1) % 1;   // staggered, looping
    if (k <= 0 || k >= 1) continue;
    X.globalAlpha = (1 - k) * 0.14;
    X.beginPath();
    X.arc(cx, cy, 80 + k * 520, 0, 7);
    X.stroke();
  }
  X.restore();
};
