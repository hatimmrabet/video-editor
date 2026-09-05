# -*- coding: utf-8 -*-
"""rush/ helpers — resolve the input file(s) without assuming a fixed name. `rush/` keeps
whatever name the creator's file already had (file-layout.md, 2026-09-05); scripts that
used to hardcode "src.mov" call find_source() instead."""
import os


def _rush_dir(work):
    rush = os.path.join(work, "rush")
    if not os.path.isdir(rush):
        raise SystemExit(f"rush/ missing at {work} — put the source file there first")
    return rush


def _root_files(rush):
    return sorted(f for f in os.listdir(rush)
                  if os.path.isfile(os.path.join(rush, f)) and f != "bg-audio.mp3")


def find_source(work):
    """The one primary file at rush/'s root — reel-speech mode (one talking-head video)."""
    rush = _rush_dir(work)
    cands = _root_files(rush)
    if len(cands) != 1:
        raise SystemExit(
            f"rush/ must hold exactly one source file for reel-speech (found {len(cands)}): {cands}")
    return os.path.join(rush, cands[0])


def find_clips(work):
    """Every file at rush/'s root, sorted — broll-montage mode (many clips)."""
    rush = _rush_dir(work)
    return [os.path.join(rush, f) for f in _root_files(rush)]


def find_broll(work):
    """Every file under rush/broll/, sorted — always optional, [] if the folder is absent."""
    broll = os.path.join(work, "rush", "broll")
    if not os.path.isdir(broll):
        return []
    return sorted(os.path.join(broll, f) for f in os.listdir(broll)
                  if os.path.isfile(os.path.join(broll, f)))


def background_audio(work):
    """rush/bg-audio.mp3 if the creator supplied one, else None."""
    p = os.path.join(work, "rush", "bg-audio.mp3")
    return p if os.path.exists(p) else None
