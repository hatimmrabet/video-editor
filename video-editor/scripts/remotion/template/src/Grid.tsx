/* The faint background grid. Gives the frame depth and keeps empty areas from reading as
   dead space, while staying light enough not to pull focus. Drawn BEFORE the video, so
   the part behind the video card never shows. 60 px pitch, ink at 7.5%. */
import {T, GRID} from './theme';
import {rgba} from './util';

const PITCH = 60;
export const Grid: React.FC = () => {
  if (!GRID) return null;
  const line = rgba(T.ink, 0.075);
  return (
    <div style={{position:'absolute', inset:0, pointerEvents:'none',
      backgroundImage:`linear-gradient(to right, ${line} 1.5px, transparent 1.5px),`
                    + `linear-gradient(to bottom, ${line} 1.5px, transparent 1.5px)`,
      backgroundSize:`${PITCH}px ${PITCH}px`}} />
  );
};
