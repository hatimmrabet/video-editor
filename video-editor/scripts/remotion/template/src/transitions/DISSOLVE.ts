import {transition} from './define.ts';

export const DISSOLVE = transition({
  about: 'Cross-fade from the old layout to the new one.',
  when: 'A soft change between two layouts that look alike.',
  duration: 0.42,
  params: {},
  layers: ({from, to, k}) => [
    {rect: from, opacity: 1 - k},
    {rect: to, opacity: k},
  ],
});
