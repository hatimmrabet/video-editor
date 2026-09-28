import {filter} from './define.ts';

/* The look the project-wide `grade: true` setting (config/project.config.json) gives every
   piece that has no filter of its own. */
export const GRADE = filter({
  about: 'A light colour grade: a touch more contrast and brightness, slightly less saturation.',
  when: 'Only when the creator asks for a graded look, or complains the image looks cold or washed out.',
  params: {},
  css: () => 'brightness(1.015) contrast(1.05) saturate(0.96)',
});
