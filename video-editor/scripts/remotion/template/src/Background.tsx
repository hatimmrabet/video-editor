/* The face-optional ambient background — shown instead of the speaker's video wherever an
   entry's `video.layout` is "HIDDEN". Purely `theme.*`-driven (no hardcoded colour) so it
   works on any project without being designed per video: it's chrome, like Grid.tsx, not
   a `scene`-authored motif — whatever the entry's own `scene` motif draws (a counter, a
   checklist, ...) still renders on top of it, exactly like it does over the face; this
   only supplies the "something is alive back there" motion.

   Every position is a deterministic function of `t` (sine/cosine, long periods so nothing
   visibly loops inside a normal video) — never a CSS @keyframes tied to wall-clock time,
   same rule as every other animation here: the render must be seek-safe. */
import {T, W, H} from './theme';
import {rgba} from './util';

type Blob = {color: string; size: number; opacity: number; period: number; phase: number; ax: number; ay: number};

const BLOBS: Blob[] = [
  {color: T.acc, size: 0.62, opacity: 0.30, period: 19, phase: 0.0,  ax: 0.30, ay: 0.22},
  {color: T.ink, size: 0.50, opacity: 0.14, period: 27, phase: 0.35, ax: 0.24, ay: 0.18},
  {color: T.clay,size: 0.44, opacity: 0.20, period: 23, phase: 0.65, ax: 0.20, ay: 0.24},
];

export const Background: React.FC<{t: number}> = ({t}) => (
  <div style={{position: 'absolute', inset: 0, overflow: 'hidden', background: T.bg}}>
    {BLOBS.map((b, i) => {
      const k = (t / b.period + b.phase) * Math.PI * 2;
      const cx = 0.5 + Math.sin(k) * b.ax;
      const cy = 0.5 + Math.cos(k * 0.8) * b.ay;
      const d = Math.max(W, H) * b.size;
      return (
        <div key={i} style={{
          position: 'absolute', left: cx * W, top: cy * H, width: d, height: d,
          transform: 'translate(-50%,-50%)', borderRadius: '50%',
          background: `radial-gradient(circle, ${rgba(b.color, b.opacity)} 0%, ${rgba(b.color, 0)} 70%)`,
          filter: 'blur(60px)',
        }} />
      );
    })}
  </div>
);
