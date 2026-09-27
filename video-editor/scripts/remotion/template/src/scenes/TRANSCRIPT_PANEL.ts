import {text, texts} from '../options/Param.ts';
import {scene} from './define.ts';

export const TRANSCRIPT_PANEL = scene({
  about: 'A panel where each spoken word drops in on its own line, with its timestamp.',
  when: 'The speaker talks about transcribing, subtitles or text appearing from speech.',
  bottom: 600,
  params: {
    title: text({about: 'Title of the panel.'}),
    lines: texts({about: 'Fixed lines to show instead of the spoken words.', min: 1, max: 12}),
  },
});
