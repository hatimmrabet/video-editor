import {text} from '../options/Param.ts';
import {scene} from './define.ts';

export const COMMENT_BOX = scene({
  about: 'A comment box in which a word types itself, then is sent.',
  when: 'A call to comment: "comment the word X below".',
  bottom: 1244,
  params: {
    word: text({about: 'The word that types itself.', required: true}),
    placeholder: text({about: 'Grey text shown in the empty box.', default: '…'}),
  },
});
