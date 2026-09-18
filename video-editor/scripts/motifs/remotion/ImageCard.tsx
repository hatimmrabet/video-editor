/* image-card — Remotion motif.
   Props: { enter, theme, params }.
   params: { src, caption?, fit? = "contain" } — `src` is a filename inside
   <remotion-dir>/public/images/, synced there by remotion.sh from <work>/config/images/
   (the media-use skill resolves a logo/screenshot/diagram into that folder — issue #154). */
import {Img, staticFile} from 'remotion';
import {W, H} from '../theme';

const SX = W / 1080, SY = H / 1920;

type Params = {src?: string; caption?: string; fit?: 'contain' | 'cover'};
type Props = {enter: number; theme: {ink: string; acc: string; font: string}; params: Params};

const back = (k: number) => { const c = 1.9, s = c + 1; return 1 + s * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const rgba = (hex: string, a: number) => {
  const h = hex.replace('#', '');
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
};

export default function ImageCard({enter, theme, params}: Props) {
  const src = params.src;
  if (!src) return null;
  const pop = lerp(0.88, 1, back(enter));
  const cardW = 640 * SX, cardH = 400 * SY, cy = 384 * SY;

  return (
    <div style={{
      position: 'absolute', left: W / 2, top: cy, width: cardW, height: cardH,
      transform: `translate(-50%,-50%) scale(${pop})`, borderRadius: 30, overflow: 'hidden',
      border: `2.5px solid ${rgba(theme.ink, 0.09)}`, boxShadow: `0 22px 52px ${rgba(theme.ink, 0.28)}`,
      background: rgba(theme.ink, 0.03),
    }}>
      <Img src={staticFile(`images/${src}`)}
        style={{width: '100%', height: '100%', objectFit: params.fit || 'contain'}} />
      {params.caption && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, padding: '14px 26px',
          background: rgba(theme.ink, 0.55), fontFamily: theme.font, fontWeight: 700,
          fontSize: 30, color: '#FFF', textAlign: 'center',
        }}>
          {params.caption}
        </div>
      )}
    </div>
  );
}
