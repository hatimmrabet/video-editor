/* COMMENT_BOX — a comment box in which a word types itself, then is sent.
   What it does and accepts: ../COMMENT_BOX.ts */
import {clamp01 as cl, lerp} from '../../geometry.ts';
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ease} from '../../transitions/index.ts';
import {ax, ay, aw, ah, onACC, rgba} from '../../util';
import {COMMENT_BOX} from '../COMMENT_BOX.ts';

const back = ease('BACK');

type Props = {t: number; prog: number; area: Rect; theme: {acc: string; ink: string; font: string};
  params: Params<typeof COMMENT_BOX.params>};

export default function CommentBox({t, prog, theme, params, area}: Props) {
  const bw = aw(area, 0.74), bh = ah(area, 0.16);
  const bx = ax(area, 0.5) - bw / 2, by = ay(area, 0.78) - bh / 2;
  const full = params.word;
  const tk = cl((prog - 0.25) / 0.35);
  const shown = full.slice(0, Math.round(tk * full.length));
  const caret = tk > 0 && tk < 1 && Math.floor(t * 6) % 2 === 0;
  const sk = cl((prog - 0.62) / 0.14);
  const dot = bh * 0.72;

  return (
    <div style={{position: 'absolute', left: bx, top: by, width: bw, height: bh, borderRadius: bh * 0.5,
      background: rgba(theme.ink, 0.03), border: `2.5px solid ${rgba(theme.ink, 0.09)}`,
      boxShadow: `0 18px 44px ${rgba(theme.ink, 0.2)}`, fontFamily: theme.font,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', direction: 'rtl'}}>
      {sk > 0 ? (
        <div style={{width: dot, height: dot, borderRadius: '50%', background: theme.acc, flexShrink: 0,
          transform: `scale(${lerp(0.6, 1, back(sk))})`, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 10px 24px ${rgba(theme.ink, 0.22)}`, color: onACC(theme.acc), fontSize: dot * 0.5}}>➤</div>
      ) : (
        <div style={{width: dot * 0.95, height: dot * 0.95, borderRadius: '50%', background: rgba(theme.ink, 0.1), flexShrink: 0}} />
      )}
      <div style={{display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: 46,
        color: shown ? theme.ink : rgba(theme.ink, 0.3)}}>
        {shown || params.placeholder}
        {caret && <span style={{width: 4, height: 52, background: theme.acc, display: 'inline-block'}} />}
      </div>
    </div>
  );
}
