/* How an option describes one parameter it accepts.

   That one description is the single source for three things: what an author reads in the
   option's file, the validation of what they wrote, and the defaults the drawing code
   receives. Nothing about a parameter is written anywhere else. */

export type Kind = 'NUMBER' | 'TEXT' | 'FLAG' | 'CHOICE' | 'LIST';

export type Param<T = unknown> = {
  kind: Kind;
  about: string;
  required?: boolean;
  default?: T;
  min?: number;                          // NUMBER: smallest value · LIST: fewest items
  max?: number;                          // NUMBER: largest value  · LIST: most items
  whole?: boolean;                       // NUMBER: integers only
  choices?: readonly string[];           // CHOICE: the allowed UPPERCASE words
  of?: 'TEXT' | 'NUMBER';                // LIST: what each item is
  between?: readonly [number, number];   // LIST of NUMBER: the range of each item
};

type Basics<T> = {about: string; required?: boolean; default?: T};

export const number = (o: Basics<number> & {min?: number; max?: number; whole?: boolean}): Param<number> =>
  ({kind: 'NUMBER', ...o});
export const text = (o: Basics<string>): Param<string> => ({kind: 'TEXT', ...o});
export const flag = (o: Basics<boolean>): Param<boolean> => ({kind: 'FLAG', ...o});
export const choice = <C extends string>(choices: readonly C[], o: Basics<C>): Param<C> =>
  ({kind: 'CHOICE', choices, ...o});
export const texts = (o: Basics<string[]> & {min?: number; max?: number}): Param<string[]> =>
  ({kind: 'LIST', of: 'TEXT', ...o});
export const numbers = (o: Basics<number[]> & {min?: number; max?: number; between?: readonly [number, number]}): Param<number[]> =>
  ({kind: 'LIST', of: 'NUMBER', ...o});

export type ParamSet = Record<string, Param<any>>;
export type Params<S extends ParamSet> = {[K in keyof S]: S[K] extends Param<infer T> ? T : never};

/* What is wrong with `v` as a value for `p`, worded for the author — or '' when nothing is. */
export function problem(p: Param<any>, v: unknown): string {
  switch (p.kind) {
    case 'NUMBER':
      if (typeof v !== 'number' || Number.isNaN(v)) return `must be a number (got ${JSON.stringify(v)})`;
      if (p.whole && !Number.isInteger(v)) return `must be a whole number (got ${v})`;
      if (p.min !== undefined && v < p.min) return `is ${v}, below the minimum ${p.min}`;
      if (p.max !== undefined && v > p.max) return `is ${v}, above the maximum ${p.max}`;
      return '';
    case 'TEXT':
      return typeof v === 'string' ? '' : `must be text (got ${JSON.stringify(v)})`;
    case 'FLAG':
      return typeof v === 'boolean' ? '' : `must be true or false (got ${JSON.stringify(v)})`;
    case 'CHOICE':
      return p.choices!.includes(v as string) ? '' : `is ${JSON.stringify(v)}, choices: ${p.choices!.join(' · ')}`;
    case 'LIST': {
      const item = p.of === 'NUMBER' ? 'numbers' : 'text';
      if (!Array.isArray(v) || v.some(x => (p.of === 'NUMBER' ? typeof x !== 'number' : typeof x !== 'string')))
        return `must be a list of ${item}`;
      if (p.min !== undefined && v.length < p.min) return `has ${v.length} item(s), at least ${p.min} needed`;
      if (p.max !== undefined && v.length > p.max) return `has ${v.length} items, at most ${p.max} fit`;
      if (p.between && v.some(x => x < p.between![0] || x > p.between![1]))
        return `has an item outside ${p.between[0]}-${p.between[1]}`;
      return '';
    }
  }
}
