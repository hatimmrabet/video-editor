/* glitch — an `overlay` motif: horizontal slice bars that jitter, an accent flash, and a
   few crack lines. From compose.reference.html's glitch() (without the video RGB-split —
   both engines do the cheaper, video-independent version so they stay identical).
   params: { intensity? = 1, slices? = 16 } */
'use strict';

module.exports = function glitch(ctx) {
  const {X, t, prog, rect, params, theme, fx} = ctx;
  const {cl} = fx;
  const R = rect || {x: 0, y: 0, w: 1080, h: 1920};
  const amp = (params.intensity != null ? params.intensity : 1) * 70 * (1 - prog);
  const N = params.slices != null ? params.slices : 16;

  if (amp > 0.5) {
    X.save();
    for (let i = 0; i < N; i++) {
      const sy = R.y + i * (R.h / N), hh = R.h / N;
      const r = Math.sin(i * 7.3 + Math.floor(t * 30) * 1.7);
      X.globalAlpha = Math.abs(r) * 0.35 * cl(amp / 70, 0, 1);
      X.fillStyle = theme.acc;
      X.fillRect(R.x + r * amp, sy, R.w, hh * 0.5);
    }
    X.globalAlpha = (1 - prog) * 0.12;
    X.fillStyle = theme.acc;
    X.fillRect(R.x, R.y, R.w, R.h);
    X.restore();
  }

  const ck = cl(prog / 0.35, 0, 1), fo = 1 - cl((prog - 0.5) / 0.4, 0, 1);
  if (ck > 0 && fo > 0) {
    X.save();
    X.globalAlpha = fo * 0.8;
    X.strokeStyle = theme.acc;
    X.lineWidth = 5;
    X.lineCap = 'round';
    X.lineJoin = 'round';
    const seeds = [[0, -1, 0.9], [1, 0.6, 0.75], [-1, 0.75, 0.8]];
    const cx = R.x + R.w / 2, cy = R.y + R.h / 2;
    seeds.forEach((sd, si) => {
      let x = cx, y = cy;
      X.beginPath();
      X.moveTo(x, y);
      for (let i = 1; i <= 9; i++) {
        const kk = cl(ck * 9 - (i - 1), 0, 1);
        if (kk <= 0) break;
        x += sd[0] * 95 * kk + Math.sin(i * 3.1 + si) * 46 * kk;
        y += sd[1] * 115 * kk;
        X.lineTo(x, y);
      }
      X.stroke();
    });
    X.restore();
  }
};
