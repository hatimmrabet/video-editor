/* Per-entry image/logo overlays, drawn on the video card itself — clipped to its rect by
   the parent's overflow:hidden, so they ride the footage through FULL/DOWN/LOWER exactly
   like the card that carries them. Sourced from an entry's `overlay[]` in timeline.json,
   output-resolved by render_data.py into OVERLAYS (theme.ts).

   `pos`/`scale` are fractions of the card's own box, not the frame — an author-placed
   value used verbatim (motifs/README.md's "Orientation" rule), so it stays put across
   FULL/DOWN/LOWER without any W/H scaling here. */
import {Img, staticFile} from 'remotion';
import {OVERLAYS} from './theme';
import {p} from './util';

type Ov = {s: number; e: number; kind: string; src?: string; pos: [number, number]; scale: number};
const OV = OVERLAYS as Ov[];

export const VideoOverlays: React.FC<{t: number}> = ({t}) => (
  <>{OV.filter(o => o.kind === 'image' && o.src && t >= o.s && t < o.e).map((o, i) => {
    const a = Math.min(p(t, o.s, o.s + 0.15), 1 - p(t, o.e - 0.15, o.e));
    const [x, y] = o.pos;
    return (
      <Img key={i} src={staticFile(`images/${o.src}`)} style={{
        position: 'absolute', left: `${x * 100}%`, top: `${y * 100}%`,
        width: `${o.scale * 100}%`, transform: 'translate(-50%,-50%)', opacity: a,
      }} />
    );
  })}</>
);
