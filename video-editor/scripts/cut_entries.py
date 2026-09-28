# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Takes sentences out of the video, puts them back, and splits one in two.

    uv run scripts/cut_entries.py <work> show [--all]      # numbered lines, repeats flagged
    uv run scripts/cut_entries.py <work> dupes              # the repeated ones only
    uv run scripts/cut_entries.py <work> drop 7 12 --why "false start"
    uv run scripts/cut_entries.py <work> keep 1 2            # keeps only these
    uv run scripts/cut_entries.py <work> restore 7           # or: restore --all
    uv run scripts/cut_entries.py <work> split 4 "word"       # splits line 4 just before "word"
    uv run scripts/cut_entries.py <work> apply                # from the edited transcript-editable.txt
    (--dry on any editing command: shows the result, writes nothing)

Edits ONE file: <work>/timeline.json. Cutting a sentence sets `on: false` on its segment and
nothing else — the segment stays in the file with its text and its `why`, and every other
segment is untouched. There is nothing to shift, so there is nothing to keep in sync and
nothing to undo: `restore` flips the flag back.

One script covers both "the creator doesn't want this sentence" and "they said it twice,
keep the last take" — both are the same flag, and Claude can equally well set `"on": false`
by hand while correcting the transcript (SKILL.md step 6).

THERE ARE NO IDS. A segment is addressed by its LINE NUMBER — its position in the file,
exactly as `show` prints it (every segment counts, on or off). `drop`/`keep`/`restore`
never change a line number, because they only ever flip `on`. `split` is the one command
that DOES: it turns one line into two, so every line after it shifts by one — re-run `show`
before targeting a line past a split you just made.
"""
import difflib
import json
import os
import sys

from lib import timeline as tl

SCRIPT = os.path.join("build", "transcript-editable.txt")


def words_of(t, seg):
    return [w["t"] for w in tl.words(t, seg)]


def similarity(a, b):
    """How alike two sentences are: shared words, or character-level ratio — whichever is
    higher."""
    if not a or not b:
        return 0.0
    shared = len(set(a) & set(b)) / min(len(a), len(b))
    chars = difflib.SequenceMatcher(None, " ".join(a), " ".join(b)).ratio()
    return max(shared, chars)


def find_dupes(t, segs, window=2, threshold=0.60):
    """Consecutive sentences that look like the same idea said twice. The FIRST of a pair is
    usually the abandoned attempt — but this only reports, it never decides."""
    out = []
    for i in range(len(segs) - 1):
        for j in range(i + 1, min(i + 1 + window, len(segs))):
            r = similarity(words_of(t, segs[i]), words_of(t, segs[j]))
            if r >= threshold:
                out.append((segs[i], segs[j], r))
                break
    return out


def normalise(token):
    """A line number, 1-based, as `show` prints it. `e014`/`14`/`E14` all resolve the same
    way (some habits die hard) — the file itself never has one."""
    token = token.strip().lower().lstrip("e")
    return int(token) if token.isdigit() else None


def line(t, n, seg):
    at = tl.out_start(t, seg)
    mark = "  " if tl.is_on(seg) else "x "
    when = "  --:--  " if at is None else " %02d:%05.2f " % (at // 60, at % 60)
    return "%s%-4d%s%s" % (mark, n, when, seg.get("text", ""))


def show(t, every):
    segs = list(enumerate(t.get("segments") or [], 1))
    if not every:
        segs = [(n, s) for n, s in segs if tl.is_on(s)]
    body = ("# Delete any line you do not want in the video, save, then:\n"
            "#   uv run scripts/cut_entries.py <work> apply\n"
            "# The number at the start of each line is its position - keep it.\n\n"
            + "\n".join(line(t, n, s) for n, s in segs) + "\n")
    print(body)
    print("%.2fs - %d sentence(s) in the video, %d cut"
          % (tl.duration(t), len(tl.segments(t)), len(t["segments"]) - len(tl.segments(t))))
    return body


def report_dupes(t):
    d = find_dupes(t, tl.segments(t))
    if not d:
        return []
    print("\nSentences that look repeated - the first is usually the abandoned attempt:")
    for a, b, r in d:
        na, nb = tl.line_of(t, a), tl.line_of(t, b)
        print("   %d <- %d  (%.0f%% alike)" % (na, nb, r * 100))
        print("      %d: %s" % (na, a.get("text", "")))
        print("      %d: %s" % (nb, b.get("text", "")))
    print("   To cut the first of each pair:  drop " + " ".join(str(tl.line_of(t, a)) for a, _, _ in d))
    return d


def resolve(t, tokens):
    lines, unknown = [], []
    for tok in tokens:
        n = normalise(tok)
        if n and tl.by_line(t, n) is not None:
            lines.append(n)
        else:
            unknown.append(tok)
    if unknown:
        sys.exit("[X] no such line: %s  (run `show` for the numbering)" % ", ".join(unknown))
    return lines


def split_source(spans, at):
    """[[a,b],...], a SOURCE time -> (spans before `at`, spans from `at` on). `at` is always
    a real word's own source start, so it lands exactly on a span boundary or strictly
    inside one — never inside a hole."""
    before, after = [], []
    for a, b in spans:
        if b <= at:
            before.append([a, b])
        elif a >= at:
            after.append([a, b])
        else:
            before.append([a, at])
            after.append([at, b])
    return before, after


def rebuild_text(words):
    return " ".join(("*%s*" % w["t"]) if w["hot"] else w["t"] for w in words)


def do_split(work, t, n, target, dry):
    seg = tl.by_line(t, n)
    if seg is None:
        sys.exit("[X] no such line: %d  (run `show` for the numbering)" % n)
    words = tl.words(t, seg)
    idx = next((i for i, w in enumerate(words) if w["t"] == target), None)
    if idx is None:
        sys.exit("[X] %r is not a word on line %d - copy it exactly from `show`" % (target, n))
    if idx == 0:
        sys.exit("[X] %r is the first word of line %d - nothing to split off before it" % (target, n))
    before_spans, after_spans = split_source(tl.span_list(seg), words[idx]["src"][0])
    if not before_spans or not after_spans:
        sys.exit("[X] line %d has no material on one side of %r - can't split there" % (n, target))
    a = {"source": before_spans, "text": rebuild_text(words[:idx])}
    b = {"source": after_spans, "text": rebuild_text(words[idx:])}
    print("line %d split before %r - it becomes:" % (n, target))
    print("  " + line(t, n, a))
    print("  " + line(t, n + 1, b))
    print("\nNothing else carried over to either half (layout, scene, filter, sfx, overlay, "
          "chapter) - author those fresh on whichever half needs them. Every line after %d "
          "shifted by one: re-run `show` before targeting them." % n)
    if dry:
        print("\n(--dry: nothing written)")
        return
    t["segments"][n - 1:n] = [a, b]
    problems = tl.validate(t)
    tl.save(work, t)
    for p in problems:
        print("  ! " + p)


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

    if cmd == "split":
        if len(args) < 2:
            sys.exit("usage: cut_entries.py <work> split <line> \"<word>\"")
        n = normalise(args[0])
        if n is None:
            sys.exit("[X] %r is not a line number" % args[0])
        do_split(work, t, n, " ".join(args[1:]), dry)
        return 0

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
        targets = [tl.line_of(t, s) for s in t["segments"] if not tl.is_on(s)] if every else resolve(t, args)
        for n in targets:
            seg = tl.by_line(t, n)
            seg.pop("on", None)
            seg.pop("why", None)
        print("Back in the video: %s" % (", ".join(str(n) for n in targets) or "nothing was cut"))

    elif cmd in ("drop", "keep", "apply"):
        if cmd == "drop":
            targets = resolve(t, args)
        elif cmd == "keep":
            kept = set(resolve(t, args))
            targets = [n for n, s in enumerate(t["segments"], 1) if tl.is_on(s) and n not in kept]
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
                    n = normalise(ln.split(None, 1)[0])
                    if n:
                        alive.add(n)
            targets = [n for n, s in enumerate(t["segments"], 1) if tl.is_on(s) and n not in alive]

        targets = [n for n in targets if tl.is_on(tl.by_line(t, n))]
        if not targets:
            print("Nothing to cut - the video is unchanged.")
            return 0
        if len(targets) == len(tl.segments(t)):
            sys.exit("[X] that would cut the whole video - cancelled.")

        before = tl.duration(t)
        print("Cutting:")
        for n in targets:
            seg = tl.by_line(t, n)
            print("  - %d  %s" % (n, seg.get("text", "")))
            seg["on"] = False
            if why:
                seg["why"] = why
        print("%.2fs -> %.2fs  (-%.2fs)" % (before, tl.duration(t), before - tl.duration(t)))

    else:
        sys.exit("Commands: show | dupes | drop | keep | restore | split | apply")

    if dry:
        print("(--dry: nothing written)")
        return 0

    problems = tl.validate(t)
    tl.save(work, t)
    for p in problems:
        print("  ! " + p)
    print("\nRebuild the video:  bash scripts/remotion/remotion.sh %s render" % work)
    print("Put a sentence back: uv run scripts/cut_entries.py %s restore <line>" % work)
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
