#!/usr/bin/env node
/* Run the headless suite.
 *
 *   node test/run.mjs                 # every *.test.js
 *   node test/run.mjs sound scenes    # only files whose name matches an argument
 *   node test/run.mjs --list          # print the file list and exit
 *
 * Each *.test.js is a standalone Node script that prints "PASS" / "FAIL" and exits 0 / 1.
 * This wrapper runs them one at a time (they each bind a port / launch a browser), applies
 * a per-file timeout, and exits non-zero if any failed. No dependencies.
 */
import { readdirSync } from "node:fs";
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = dirname(fileURLToPath(import.meta.url));
const TIMEOUT_MS = Number(process.env.VE_TEST_TIMEOUT || 180000);

const args = process.argv.slice(2);
const list = args.includes("--list");
const filters = args.filter(a => !a.startsWith("--"));

let files = readdirSync(DIR).filter(f => f.endsWith(".test.js")).sort();
if (filters.length) files = files.filter(f => filters.some(x => f.includes(x)));

if (!files.length) { console.error("no matching *.test.js"); process.exit(2); }
if (list) { files.forEach(f => console.log(f)); process.exit(0); }

function runOne(file) {
  return new Promise(resolve => {
    const started = Date.now();
    const child = spawn(process.execPath, [join(DIR, file)], { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", d => { out += d; process.stdout.write(d); });
    child.stderr.on("data", d => { out += d; process.stderr.write(d); });
    const timer = setTimeout(() => { console.error(`\n  !! ${file} timed out after ${TIMEOUT_MS} ms`); child.kill("SIGKILL"); }, TIMEOUT_MS);
    child.on("close", code => {
      clearTimeout(timer);
      resolve({ file, code, secs: ((Date.now() - started) / 1000).toFixed(0), passed: code === 0 && /\bPASS\b/.test(out) });
    });
  });
}

const results = [];
for (const file of files) {
  console.log(`\n======== ${file} ========`);
  results.push(await runOne(file));
}

console.log("\n──────── summary ────────");
for (const r of results) console.log(`  ${r.passed ? "PASS" : "FAIL"}  ${r.file.padEnd(28)} ${r.secs}s${r.passed ? "" : `  (exit ${r.code})`}`);
const failed = results.filter(r => !r.passed);
console.log(failed.length ? `\n${failed.length}/${results.length} FAILED` : `\nall ${results.length} passed`);
process.exit(failed.length ? 1 : 0);
