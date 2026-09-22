# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Takes sentences out of the video, and puts them back.

    uv run scripts/cut_entries.py <work> show [--all]      # numbered sentences, repeats flagged
    uv run scripts/cut_entries.py <work> dupes             # the repeated ones only
    uv run scripts/cut_entries.py <work> drop e007 e012 --why "false start"
    uv run scripts/cut_entries.py <work> keep e001 e002    # keeps only these
    uv run scripts/cut_entries.py <work> restore e007      # or: restore --all
    uv run scripts/cut_entries.py <work> apply             # from the edited transcript-editable.txt
    (--dry on any editing command: shows the result, writes nothing)

Edits ONE file: <work>/timeline.json. Cutting a sentence sets `on: false` on its entry and
nothing else — the entry stays in the file with its text and its `why`, and every other
entry is untouched. There is nothing to shift, so there is nothing to keep in sync and
nothing to undo: `restore` flips the flag back.

One script covers both "the creator doesn't want this sentence" and "they said it twice,
keep the last take" — both are the same flag, and Claude can equally well set `"on": false`
by hand while correcting the transcript (SKILL.md step 6).

An id is `e014`. A bare number means the same thing: `drop 14` == `drop e014`. Ids never
renumber when something is cut.
"""
import difflib
import json
import os
import sys

from lib import timeline as tl

SCRIPT = os.path.join("build", "transcript-editable.txt")


def text_of(entry):
    return (entry.get("caption") or {}).get("text", "")


def words_of(entry):
    return [w.get("t", "") for w in ((entry.get("caption") or {}).get("words") or [])]


def similarity(a, b):
    """How alike two sentences are: shared words, or character-level ratio — whichever is
    higher."""
    if not a or not b:
        return 0.0
    shared = len(set(a) & set(b)) / min(len(a), len(b))
    chars = difflib.SequenceMatcher(None, " ".join(a), " ".join(b)).ratio()
    return max(shared, chars)


def find_dupes(entries, window=2, threshold=0.60):
    """Consecutive sentences that look like the same idea said twice. The FIRST of a pair is
    usually the abandoned attempt — but this only reports, it never decides."""
    out = []
    for i in range(len(entries) - 1):
        for j in range(i + 1, min(i + 1 + window, len(entries))):
            r = similarity(words_of(entries[i]), words_of(entries[j]))
            if r >= threshold:
                out.append((entries[i], entries[j], r))
                break
    return out


def normalise(token):
    """`e014`, `14` and `E14` all mean the same entry."""
    token = token.strip().lower()
    if token.startswith("e"):
        token = token[1:]
    return "e%03d" % int(token) if token.isdigit() else None


def line(t, entry):
    at = tl.out_start(t, entry)
    mark = "  " if tl.is_on(entry) else "x "
    when = "  --:--  " if at is None else " %02d:%05.2f " % (at // 60, at % 60)
    return "%s%s %s %s" % (mark, entry.get("id"), when, text_of(entry))


def show(t, every):
    entries = tl.entries(t, every=every)
    body = ("# Delete any line you do not want in the video, save, then:\n"
            "#   uv run scripts/cut_entries.py <work> apply\n"
            "# The id at the start of each line is what ties it to its sentence - keep it.\n\n"
            + "\n".join(line(t, e) for e in entries) + "\n")
    print(body)
    print("%.2fs - %d sentence(s) in the video, %d cut"
          % (tl.duration(t), len(tl.entries(t)), len(t["timeline"]) - len(tl.entries(t))))
    return body


def report_dupes(t):
    d = find_dupes(tl.entries(t))
    if not d:
        return []
    print("\nSentences that look repeated - the first is usually the abandoned attempt:")
    for a, b, r in d:
        print("   %s <- %s  (%.0f%% alike)" % (a["id"], b["id"], r * 100))
        print("      %s: %s" % (a["id"], text_of(a)))
        print("      %s: %s" % (b["id"], text_of(b)))
    print("   To cut the first of each pair:  drop " + " ".join(a["id"] for a, _, _ in d))
    return d


def resolve(t, tokens):
    ids, unknown = [], []
    for tok in tokens:
        eid = normalise(tok)
        if eid and tl.by_id(t, eid) is not None:
            ids.append(eid)
        else:
            unknown.append(tok)
    if unknown:
        sys.exit("[X] no such sentence: %s  (run `show` for the ids)" % ", ".join(unknown))
    return ids


def main(argv):
    if len(argv) < 2:
        sys.exit(__doc__)
    work = os.path.abspath(argv[1])
    cmd = argv[2] if len(argv) > 2 else "show"
    dry = "--dry" in argv
    every = "--all" in argv
    why = None
    if "--why" in argv:
        i = argv.index("--why")
        why = argv[i + 1] if i + 1 < len(argv) else None
    args = [a for a in argv[3:] if not a.startswith("--") and a != why]

    t = tl.load(work)

    if cmd == "show":
        body = show(t, every)
        report_dupes(t)
        if not dry:
            os.makedirs(os.path.join(work, "build"), exist_ok=True)
            with open(os.path.join(work, SCRIPT), "w", encoding="utf-8") as f:
                f.write(body)
        return 0

    if cmd == "dupes":
        if not report_dupes(t):
            print("No repeated sentences.")
        return 0

    if cmd == "restore":
        targets = [e["id"] for e in t["timeline"] if not tl.is_on(e)] if every else resolve(t, args)
        for eid in targets:
            e = tl.by_id(t, eid)
            e.pop("on", None)
            e.pop("why", None)
        print("Back in the video: %s" % (", ".join(targets) or "nothing was cut"))

    elif cmd in ("drop", "keep", "apply"):
        if cmd == "drop":
            targets = resolve(t, args)
        elif cmd == "keep":
            kept = set(resolve(t, args))
            targets = [e["id"] for e in tl.entries(t) if e["id"] not in kept]
        else:
            path = os.path.join(work, SCRIPT)
            if not os.path.exists(path):
                sys.exit("[X] no build/transcript-editable.txt - run `show` first")
            alive = set()
            with open(path, encoding="utf-8") as f:
                for ln in f:
                    ln = ln.strip().lstrip("x").strip()
                    if not ln or ln.startswith("#"):
                        continue
                    eid = normalise(ln.split(None, 1)[0])
                    if eid:
                        alive.add(eid)
            targets = [e["id"] for e in tl.entries(t) if e["id"] not in alive]

        targets = [eid for eid in targets if tl.is_on(tl.by_id(t, eid))]
        if not targets:
            print("Nothing to cut - the video is unchanged.")
            return 0
        if len(targets) == len(tl.entries(t)):
            sys.exit("[X] that would cut the whole video - cancelled.")

        before = tl.duration(t)
        print("Cutting:")
        for eid in targets:
            e = tl.by_id(t, eid)
            print("  - %s  %s" % (eid, text_of(e)))
            e["on"] = False
            if why:
                e["why"] = why
        print("%.2fs -> %.2fs  (-%.2fs)" % (before, tl.duration(t), before - tl.duration(t)))

    else:
        sys.exit("Commands: show | dupes | drop | keep | restore | apply")

    if dry:
        print("(--dry: nothing written)")
        return 0

    problems = tl.validate(t)
    tl.save(work, t)
    for p in problems:
        print("  ! " + p)
    print("\nRebuild the video:  bash scripts/remotion/remotion.sh %s render" % work)
    print("Put a sentence back: uv run scripts/cut_entries.py %s restore <id>" % work)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
