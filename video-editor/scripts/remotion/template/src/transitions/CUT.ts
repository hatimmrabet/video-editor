import type {Layer, Move} from './types.ts';

export const CUT = {
  about: 'No transition: the new layout appears at once.',
  when: 'A hard, deliberate jump — the punchiest change.',
  params: {},
  layers: ({to}: Move): Layer[] => [{rect: to}],
};
