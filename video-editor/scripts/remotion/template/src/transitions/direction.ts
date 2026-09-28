import {choice} from '../options/Param.ts';
import type {Frame} from '../geometry.ts';

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export const direction = (about: string) =>
  choice(['UP', 'DOWN', 'LEFT', 'RIGHT'] as const, {about, default: 'UP' as Direction});

/* The way a change travels, as a vector as long as the frame side it crosses. */
export const travel = (dir: Direction, frame: Frame): [number, number] =>
  dir === 'UP' ? [0, -frame.h] : dir === 'DOWN' ? [0, frame.h] : dir === 'LEFT' ? [-frame.w, 0] : [frame.w, 0];
