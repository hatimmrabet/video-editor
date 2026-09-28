import {number, numbers, text} from '../options/Param.ts';
import {scene} from './define.ts';

export const SYNC_VIZ = scene({
  about: 'A waveform with a playhead sweeping across it and markers lighting up.',
  when: 'The speaker talks about syncing, timing or sound.',
  params: {
    title: text({about: 'Title above the waveform.'}),
    bars: number({about: 'How many bars the waveform has.', default: 68, min: 10, max: 120, whole: true}),
    markers: numbers({about: 'Where the markers sit along the waveform, from 0 (start) to 1 (end). Default: one per spoken word.', min: 1, max: 40, between: [0, 1]}),
  },
});
