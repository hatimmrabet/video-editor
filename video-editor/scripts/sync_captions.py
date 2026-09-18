# -*- coding: utf-8 -*-
import sys as _sys
try:
    _sys.stdout.reconfigure(encoding="utf-8"); _sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass
"""Re-spaces the words of every sentence whose text was reworded (issue #144).

    uv run scripts/sync_captions.py <work> [--dry]

Reads and writes <work>/timeline.json.

Correcting the transcript (SKILL.md step 5) means editing an entry's `caption.text` and
nothing else. This then rebuilds `caption.words` for exactly those entries — spreading the
new tokens across the entry's own output duration, weighted by token length, and writing
them back as source time. `hot` is preserved for words that survive the rewording.

IT ONLY TOUCHES WHAT CHANGED. An entry whose `text` still matches its `words` is skipped,
so Whisper's real per-word timings — the ones the captions animate against — survive
everywhere except the sentences that were actually rewritten. That is the whole reason this
is a separate pass rather than something build_timeline.py does to everything.

A re-spaced sentence has invented word timings: only its start and end are real. Reword
sparingly, and prefer recovering what was said over rewriting it.
"""
import os
import sys

from lib import timeline as tl


def main(argv):
    work = os.path.abspath(argv[1])
    dry = "--dry" in argv
    t = tl.load(work)

    changed = []
    for e in tl.entries(t, every=True):
        before = [w.get("t", "") for w in ((e.get("caption") or {}).get("words") or [])]
        if tl.sync_words(e):
            changed.append((e["id"], " ".join(before), (e.get("caption") or {}).get("text", "")))

    if not changed:
        print("every sentence already matches its words - nothing to re-space")
        return 0

    print("re-spaced %d sentence(s):" % len(changed))
    for eid, was, now in changed:
        print("  %s" % eid)
        print("    was: %s" % (was or "(no words)"))
        print("    now: %s" % (now or "(empty)"))

    if dry:
        print("(--dry: nothing written)")
        return 0

    problems = tl.validate(t)
    tl.save(work, t)
    for p in problems:
        print("  ! " + p)
    print("\n%d sentence(s) now carry synthesised word timings - only their start and end "
          "are real." % len(changed))
    return 1 if problems else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: sync_captions.py <work> [--dry]")
    sys.exit(main(sys.argv))
