import {AbsoluteFill, Audio, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {T, VEND, HAS_SFX, GUIDES, FACE_ANCHOR} from './theme';
import {rgba} from './util';
import {videoLayers, videoHidden} from './stage';
import {Badge} from './Chrome';
import {Captions} from './Captions';
import {VideoOverlays} from './VideoOverlays';
import {SceneList} from './SceneList';
import {Outro} from './Outro';
import {Guides} from './Guides';
import {Grid} from './Grid';
import {Background} from './Background';

export const Ad: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const showVideo = t < VEND;
  // HIDDEN entries: no face on screen — Background.tsx fills the frame instead, and the
  // voice needs its own source since OffthreadVideo isn't mounted for this span.
  const hidden = showVideo && videoHidden(t);
  const layers = showVideo && !hidden ? videoLayers(t) : [];

  return (
    <AbsoluteFill style={{background:T.bg, fontFamily:T.font}}>
      <Grid />
      {hidden && <Background t={t} />}
      {layers.map((L, idx) => (
        <div key={idx} style={{position:'absolute', left:L.rect.x, top:L.rect.y, width:L.rect.w, height:L.rect.h,
          borderRadius:L.rect.r, overflow:'hidden', opacity:L.opacity,
          boxShadow: L.rect.r > 0.5 ? `0 26px 64px ${rgba(T.ink,0.26)}` : 'none'}}>
          <OffthreadVideo src={staticFile('video.mp4')}
            style={{width:'100%', height:'100%', objectFit:'cover', objectPosition:`50% ${FACE_ANCHOR*100}%`}} />
          {idx === layers.length - 1 && <VideoOverlays t={t} />}
        </div>
      ))}
      {hidden && <Audio src={staticFile('video.mp4')} />}
      {HAS_SFX && <Audio src={staticFile('sfx.wav')} />}
      <Badge t={t} />
      <SceneList t={t} />
      <Captions t={t} />
      <Outro t={t} />
      {GUIDES && <Guides />}
    </AbsoluteFill>
  );
};
