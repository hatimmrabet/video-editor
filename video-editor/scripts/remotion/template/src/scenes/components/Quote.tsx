/* QUOTE — a short title chip at the top of the screen. What it does and accepts: ../QUOTE.ts */
import type {Rect} from '../../geometry.ts';
import type {Params} from '../../options/Param.ts';
import {ax, ay, onACC, rgba} from '../../util';
import {QUOTE} from '../QUOTE.ts';

type Props = {area: Rect; theme: {acc: string; ink: string; font: string}; params: Params<typeof QUOTE.params>};

export default function Quote({theme, params, area}: Props) {
  return (
    <div style={{position: 'absolute', left: ax(area, 0.5), top: ay(area, params.y), transform: 'translate(-50%,-50%)',
      display: 'flex', justifyContent: 'center'}}>
      <div style={{
        background: params.accent ? theme.acc : rgba(theme.ink, 0.07),
        color: params.accent ? onACC(theme.acc) : theme.ink,
        fontFamily: theme.font, fontWeight: 800, fontSize: 40,
        height: 80, lineHeight: '80px', padding: '0 36px', borderRadius: 40, whiteSpace: 'nowrap',
      }}>{params.text}</div>
    </div>
  );
}
