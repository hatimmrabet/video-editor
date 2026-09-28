import {choice, text} from '../options/Param.ts';
import {scene} from './define.ts';

export const IMAGE_CARD = scene({
  about: 'A real image — a logo, a screenshot, a diagram — shown on a card.',
  when: 'The speaker names a real tool, brand, website, app, place or person.',
  params: {
    src: text({about: 'File name inside the project\'s config/images/ folder.', required: true}),
    caption: text({about: 'Line written along the bottom of the card.'}),
    fit: choice(['CONTAIN', 'COVER'] as const, {
      about: 'CONTAIN shows the whole image; COVER fills the card and crops.',
      default: 'CONTAIN',
    }),
  },
  check: ({src}, env) => (env.exists(`config/images/${src}`) ? [] : [`IMAGE_CARD: "${src}" is not in the project's config/images/ folder`]),
});
