/* Checks a render plan against every domain, before a render spends minutes on it.

     node --experimental-strip-types check.ts <plan.json> [--work <work dir>]

   Prints one line per problem — where it sits, what is wrong, and which choices are accepted —
   and exits 1 if there is any. remotion.sh runs it right after building the plan, so a wrong
   keyword or parameter stops there instead of halfway through a render. `--work` lets a scene
   look for files in the project (an image that is not there). */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {DOMAINS} from './index.ts';

const args = process.argv.slice(2);
const at = args.indexOf('--work');
const work = at >= 0 ? args[at + 1] : undefined;
const file = args.find((a, i) => !a.startsWith('--') && (at < 0 || i !== at + 1));
if (!file) {
  console.error('usage: check.ts <plan.json> [--work <work dir>]');
  process.exit(2);
}

const plan = JSON.parse(readFileSync(file, 'utf8'));
const env = {exists: (relative: string) => !work || existsSync(join(work, relative))};

const problems = Object.values(DOMAINS).flatMap(domain => domain.audit(plan, env));
for (const problem of problems) console.log(problem);
process.exit(problems.length ? 1 : 0);
