import {text, texts} from '../options/Param.ts';
import {scene} from './define.ts';

export const FILE_MERGE = scene({
  about: 'Chips fly in and merge into one file card.',
  when: 'The speaker talks about merging, combining or gathering several things into one.',
  bottom: 580,
  params: {
    sources: texts({about: 'One chip per source.', required: true, min: 1, max: 3}),
    targetLabel: text({about: 'Name written on the file card.'}),
    note: text({about: 'A line of text on the card.'}),
    done: text({about: 'What appears once everything has merged.'}),
  },
});
