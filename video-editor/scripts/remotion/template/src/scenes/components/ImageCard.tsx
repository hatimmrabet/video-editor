/* IMAGE_CARD — a real image on a card. What it does and accepts: ../IMAGE_CARD.ts
   `src` is a file inside <remotion-dir>/public/images/, which remotion.sh syncs from the
   project's config/images/ (the media-use skill resolves a logo, screenshot or diagram there). */
import {Img, staticFile} from 'remotion';
import {lerp} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, aw, ah, rgba} from '../../util';
import {IMAGE_CARD} from '../IMAGE_CARD.ts';

const back = ease('BACK');

type Props = {enter: number; area: Rect; theme: {ink: string; acc: string; font: string}; params: Params<typeof IMAGE_CARD.params>};

export default function ImageCard({enter, theme, params, area}: Props) {
  const pop = lerp(0.88, 1, back(enter));
  const cardW = aw(area, 0.62), cardH = ah(area, 0.62);
  const cx = ax(area, 0.5), cy = ay(area, 0.48);

  return (
    <div style={{
      position: 'absolute', left: cx, top: cy, width: cardW, height: cardH,
      transform: `translate(-50%,-50%) scale(${pop})`, borderRadius: 30, overflow: 'hidden',
      border: `2.5px solid ${rgba(theme.ink, 0.09)}`, boxShadow: `0 22px 52px ${rgba(theme.ink, 0.28)}`,
      background: rgba(theme.ink, 0.03),
    }}>
      <Img src={staticFile(`images/${params.src}`)}
        style={{width: '100%', height: '100%', objectFit: params.fit === 'COVER' ? 'cover' : 'contain'}} />
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
