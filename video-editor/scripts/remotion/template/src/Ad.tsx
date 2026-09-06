import {AbsoluteFill, Audio, OffthreadVideo, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {T, VEND, HAS_SFX, GUIDES, SCENES} from './theme';
import {rgba} from './util';
import {videoLayers} from './stage';
import {Badge, Bar} from './Chrome';
import {Captions} from './Captions';
import {Scenes, VideoOverlay} from './Scenes';
import {SceneList} from './SceneList';
import {Outro} from './Outro';
import {Guides} from './Guides';

export const Ad: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;
  const showVideo = t < VEND;
  const layers = showVideo ? videoLayers(t) : [];

  return (
    <AbsoluteFill style={{background:T.bg, fontFamily:T.font}}>
      {layers.map((L, idx) => (
        <div key={idx} style={{position:'absolute', left:L.rect.x, top:L.rect.y, width:L.rect.w, height:L.rect.h,
          borderRadius:L.rect.r, overflow:'hidden', opacity:L.opacity,
          boxShadow: L.rect.r > 0.5 ? `0 26px 64px ${rgba(T.ink,0.26)}` : 'none'}}>
          <OffthreadVideo src={staticFile('video.mp4')}
            style={{width:'100%', height:'100%', objectFit:'cover', objectPosition:'50% 26%'}} />
          {idx === layers.length - 1 && <VideoOverlay t={t} />}
        </div>
      ))}
      {HAS_SFX && <Audio src={staticFile('sfx.wav')} />}
      <Badge t={t} />
      <Bar t={t} />
      {SCENES ? <SceneList t={t} /> : <Scenes t={t} />}
      <Captions t={t} />
      <Outro t={t} />
      {GUIDES && <Guides />}
    </AbsoluteFill>
  );
};
