import type {FC} from 'react';
import {SCENES} from './index.ts';
import CardStack from './components/CardStack.tsx';
import Checklist from './components/Checklist.tsx';
import CommentBox from './components/CommentBox.tsx';
import Counter from './components/Counter.tsx';
import FileMerge from './components/FileMerge.tsx';
import Glitch from './components/Glitch.tsx';
import ImageCard from './components/ImageCard.tsx';
import Quote from './components/Quote.tsx';
import Stamp from './components/Stamp.tsx';
import Suspense from './components/Suspense.tsx';
import SyncViz from './components/SyncViz.tsx';
import TranscriptPanel from './components/TranscriptPanel.tsx';

/* One component per scene keyword. The type checker holds the two lists together: a keyword
   without a component, or a component without a keyword, does not compile. */
export const COMPONENTS: Record<keyof typeof SCENES.options, FC<any>> = {
  CARD_STACK: CardStack,
  CHECKLIST: Checklist,
  COMMENT_BOX: CommentBox,
  COUNTER: Counter,
  FILE_MERGE: FileMerge,
  GLITCH: Glitch,
  IMAGE_CARD: ImageCard,
  QUOTE: Quote,
  STAMP: Stamp,
  SUSPENSE: Suspense,
  SYNC_VIZ: SyncViz,
  TRANSCRIPT_PANEL: TranscriptPanel,
};
