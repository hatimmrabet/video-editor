/* SceneList — draws every active scene of the render plan. Each is read through the scenes
   domain once (a bad choice fails on the first frame, worded for the author), then rendered
   with the container `rise` (enter/exit fade + slide) applied here, so a scene only draws its
   steady state. An `overlay` scene owns its whole appearance and gets no rise. A scene that
   `continues` an already-running `items` list (render_data.py) skips the enter rise — it is
   not a new thing arriving, so it must not fade in over what is already on screen — and one
   whose successor `continuesNext` skips the exit rise, so the list does not fade out from
   under itself the instant before the next segment keeps growing it. A plan with no scene
   simply renders nothing. */
import {T, PLAN_SCENES} from '../theme';
import {clamp01 as cl} from '../geometry.ts';
import {arrangementAt, videoRectAt} from '../stage';
import {SCENE_ENTER, SCENE_EXIT, ease} from '../transitions/index.ts';
import {parseScene} from './index.ts';
import {COMPONENTS} from './components.tsx';
import {BESPOKE_COMPONENTS} from '../bespoke/_registry.tsx';

const dur = (v: any, d: number) => (typeof v === 'number' ? v : (v && typeof v.duration === 'number' ? v.duration : d));

const CHOSEN = PLAN_SCENES.map((sc: any) => parseScene({type: sc.type, ...(sc.params ?? {})}));

export const SceneList: React.FC<{t: number}> = ({t}) => (
  <>
    {PLAN_SCENES.map((sc: any, i: number) => {
      if (t < sc.s || t >= sc.e) return null;
      const {name, option, params} = CHOSEN[i];
      const Scene = (COMPONENTS as Record<string, React.FC<any>>)[name] ?? BESPOKE_COMPONENTS[name];

      const tm = sc.timing || {};
      const inD = Math.max(0.001, dur(tm.in, SCENE_ENTER.duration));
      const outD = Math.max(0.001, dur(tm.out, SCENE_EXIT.duration));
      const enter = cl((t - sc.s) / inD);
      const exit = cl((t - (sc.e - outD)) / outD);
      const words = sc.words || [];
      const wordIndex = words.reduce((n: number, w: any) => (t >= w.s ? n + 1 : n), -1);
      const eA = sc.continues ? 1 : ease((tm.in && tm.in.easing) || SCENE_ENTER.easing)(enter);
      const xA = sc.continuesNext ? 0 : ease((tm.out && tm.out.easing) || SCENE_EXIT.easing)(exit);
      const riseY = sc.continues ? 0 : (1 - eA) * (tm.in && typeof tm.in.y === 'number' ? tm.in.y : SCENE_ENTER.y);
      const prog = cl((t - sc.s) / Math.max(0.001, sc.e - sc.s));
      const wrap = (option as {overlay?: boolean}).overlay ? {} : {opacity: eA * (1 - xA), transform: `translateY(${riseY}px)`};

      return (
        <div key={i} style={{position: 'absolute', inset: 0, ...wrap}}>
          <Scene t={t} prog={prog} dur={sc.e - sc.s} enter={enter} exit={exit} words={words} wordIndex={wordIndex}
            rect={videoRectAt(t)} area={arrangementAt(t).scene} theme={T} params={params} itemReveal={sc.itemReveal} />
        </div>
      );
    })}
  </>
);
