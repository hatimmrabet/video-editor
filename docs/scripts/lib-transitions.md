# `lib/transitions.py` + `lib/transitions.js`

`video-editor/scripts/lib/` · python (source of truth) + node (thin subprocess wrapper) · shared

> The reader side of [`scripts/transitions.json`](../../video-editor/scripts/transitions.json).
> Vocabulary: [`docs/design/transitions.md`](../design/transitions.md).

---

## One implementation, not two

`lib/transitions.py` holds the resolver; `lib/transitions.js` shells out to it (via
[`pythonCmd()`](lib-platform.md)) and parses the JSON — same arrangement as
[`lib/config`](lib-config.md), same reasoning. The browser engines
(`compose.html` / `studio.html`) can't shell out, but they only ever deal with the
**object form** of a spec and read an injected copy of the defaults, so they need no
resolver — just an easing registry (`EZ`) and the injected table (`TX`).

## What it does

- **`load()`** → the parsed `scripts/transitions.json` (easings, types, `elementAnim`,
  params, defaults). BOM-tolerant.
- **`resolve(spec, kind)`** → a full `{type, duration, easing, params}` (plus `sfx` if
  set). `spec` is a shorthand string (`"push:0.3:up"`), a dict, or `None`; `kind` is one
  of `sceneToScene` · `sceneEnter` · `sceneExit` · `outro` · `montage` and supplies
  whatever the spec leaves out. Shorthand `type:duration:param` maps the third field onto
  the type's first declared param (`dir` for `wipe`/`push`/`iris`).

```python
from lib import transitions
transitions.resolve("push:0.35:up", "sceneToScene")
# {'type': 'push', 'duration': 0.35, 'easing': 'eio', 'params': {'dir': 'up'}}
```

```js
const t = require('./lib/transitions');
t.load().defaults;                       // injected into the light engine by render_frames.js
t.resolve({type: 'wipe'}, 'sceneToScene');
```

CLI: `python lib/transitions.py` prints the whole table; `python lib/transitions.py <kind> [spec]`
prints one resolved transition.

## Consumers

- **`render_frames.js`** — `load().defaults` is injected into the light engine via
  `window.init({..., transitions})`.
- **`compose.html` / `studio.html`** — read the injected `transitions` (fallback = today's
  exact literals, so an un-injected studio is unchanged); `vrect` reads `sceneToScene`,
  `caption` reads `sceneEnter`/`sceneExit`, and a per-entry `SCENES[i].transition` object
  overrides type/duration/easing for one boundary.
- **`montage_mode.py`** (issue #14) — `resolve()` for `--transition` and the per-cut
  `plan[]` field.
- **Remotion** (issue #13) — `remotion.sh` will copy the resolved defaults into
  `project.json`.
