/* A domain: the options of one business context, kept together with everything that belongs to
   them. Layouts, transitions, scenes and filters each are a domain in their own folder; this
   file is only what they have in common — how an option is declared, and how the author's
   choice is read and checked.

   An option is a plain object: `about`, optional `when`, `params`, plus whatever behaviour its
   domain needs (a layout arranges, a filter yields CSS...). It lives in a file named after its
   UPPERCASE keyword, and that file is the whole reference: to know which values a key accepts,
   list the domain's folder and read the file. Nothing else describes them, so nothing else can
   go out of date. */
import {problem} from './Param.ts';
import type {ParamSet} from './Param.ts';

export type Definition = {about: string; when?: string; params: ParamSet};

/* What an author writes to choose an option: the bare UPPERCASE keyword (every default), or
   {type: KEYWORD, ...parameters}. Every domain reads its choices this one way. */
export type Spec = string | ({type: string} & Record<string, unknown>);

/* What an audit may ask of the outside world without importing it. */
export type Env = {exists(pathInWorkDir: string): boolean};

/* Checks the part of the render plan a domain is responsible for; returns the problems. */
export type Audit = (plan: any, env: Env) => string[];

/* Where in the montage a plan item sits, for an error message: "line 4 @ 12.3s" — the line
   is the segment's 1-based position in timeline.json, exactly as `cut_entries.py show`
   prints it (there are no ids). */
export const locate = (item: {line?: number; s?: number; o?: number}) =>
  `line ${item.line ?? '?'} @ ${(item.s ?? item.o ?? 0).toFixed(1)}s`;

function distance(a: string, b: string): number {
  const d = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

export function defineDomain<O extends Record<string, Definition>>(
  kind: string,
  definitions: O,
  config: {fallback?: keyof O & string; audit?: Audit} = {},
) {
  type Name = keyof O & string;
  const names = Object.keys(definitions) as Name[];
  const options = Object.fromEntries(names.map(name => [name, {...definitions[name], name}])) as unknown as
    {[N in Name]: O[N] & {name: N}};

  /* The author's choice -> the option, every parameter with its default applied, and every
     problem worded so it can be fixed without reading any code. */
  function resolve(spec: Spec | null | undefined) {
    const given: Record<string, unknown> = typeof spec === 'object' && spec ? {...spec} : {};
    const word = spec == null ? config.fallback
      : typeof spec === 'string' ? spec
      : given.type === undefined ? undefined : String(given.type);
    delete given.type;
    const errors: string[] = [];
    const option = word !== undefined ? options[word as Name] : undefined;
    if (!option) {
      const near = word && names.find(n => distance(n, word) <= 2);
      errors.push(word === undefined
        ? `a ${kind} is required (choices: ${names.join(' · ')})`
        : `unknown ${kind} "${word}"${near ? ` - did you mean ${near}?` : ''} (choices: ${names.join(' · ')})`);
      return {name: word as string, option: undefined, params: {} as Record<string, any>, errors};
    }
    const params: Record<string, any> = {};
    for (const [key, p] of Object.entries(option.params)) {
      const v = given[key] !== undefined ? given[key] : p.default;
      delete given[key];
      if (v === undefined) { if (p.required) errors.push(`${word}: "${key}" is required - ${p.about}`); continue; }
      const bad = problem(p, v);
      if (bad) errors.push(`${word}: "${key}" ${bad}`);
      params[key] = v;
    }
    for (const key of Object.keys(given))
      errors.push(`${word}: unknown parameter "${key}" (parameters: ${Object.keys(option.params).join(' · ') || 'none'})`);
    return {name: word as Name, option, params, errors};
  }

  /* The same, for the drawing code: throws with every problem, so a bad choice can never be
     drawn as something else. */
  function parse(spec: Spec | null | undefined) {
    const r = resolve(spec);
    if (r.errors.length) throw new Error(r.errors.map(e => `${kind} ${e}`).join('\n'));
    return {name: r.name as Name, option: r.option!, params: r.params};
  }

  return {
    kind, names, options, fallback: config.fallback, resolve, parse,
    /* The problems with one choice, each prefixed with where it sits. */
    problems: (spec: Spec | null | undefined, where: string) =>
      resolve(spec).errors.map(e => `${where}: ${kind} ${e}`),
    audit: config.audit ?? (() => [] as string[]),
  };
}
