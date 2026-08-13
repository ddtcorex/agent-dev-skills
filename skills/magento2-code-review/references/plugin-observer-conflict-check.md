# Plugin/Observer/Preference Conflict Check

Run this when a reviewed diff touches `di.xml`, `events.xml`, a `Plugin/`
class, or an `Observer/` class — a common source of real Magento bugs is a
second plugin/observer nobody knew existed on the same target. Also run the
preference half whenever the diff adds a `<preference>` node, even without
`events.xml` or a `Plugin/` class in the same diff.

## Find other plugins on the same target class

```bash
grep -rn "type name=\"<TargetClass>\"" --include="di.xml" app/code/*/*/etc app/code/*/*/etc/*/ vendor/*/*/etc 2>/dev/null
```

Replace `<TargetClass>` with the fully-qualified class the new/changed plugin
targets (the `<type name="...">` the `<plugin>` node sits under in `di.xml`).

## Find other observers on the same event

```bash
grep -rn "event name=\"<event_name>\"" --include="events.xml" app/code/*/*/etc app/code/*/*/etc/*/ vendor/*/*/etc 2>/dev/null
```

## Find other preferences for the same class/interface

Preferences have no `sortOrder` or arbitration mechanism at all — unlike
plugins, where at least an explicit `sortOrder` can resolve an ordering
conflict, two `<preference>` declarations for the same `for="..."` class
just silently resolve to whichever module's `di.xml` merges last, with zero
error or warning. Always check for an existing preference before adding a
new one, not just when something looks broken:

```bash
grep -rn "preference for=\"<TargetClass>\"" --include="di.xml" app/code/*/*/etc app/code/*/*/etc/*/ vendor/*/*/etc 2>/dev/null
```

Replace `<TargetClass>` with the fully-qualified class/interface the new
`<preference for="...">` targets. This applies just as much when the target
is a third-party/vendor package's own class (not just Magento core) — a
private Composer package upgrading its internals can silently break a
downstream module's preference on it exactly like a Magento core upgrade
can, with no `<sequence>` or dependency mechanism warning either side.

## What to flag

Report under `M2-ARCH-007` (`magento2-dev-core/references/severity-and-codes.md`) when:

- Two or more `around` plugins target the same method with no explicit,
  documented `sortOrder` — interception order is otherwise undefined.
- A new plugin is added to a method that already has one or more plugins,
  and the diff doesn't set `sortOrder` relative to them.
- A new observer is added to an event that already has observers where
  execution order would matter (observer order is never guaranteed by
  Magento — if order matters, this itself is worth flagging as a design
  issue, not just a missing `sortOrder`).

Not every co-existing plugin/observer is a conflict — most `before`/`after`
plugins on different concerns coexist fine. Only flag when the new code's
behavior actually depends on running before/after the existing one(s) and
that ordering isn't guaranteed or documented.

Report under `M2-ARCH-008` when the grep above finds an existing
`<preference for="<TargetClass>">` in a *different* module from the one the
diff adds/changes. There's no "not a conflict, they coexist fine" case here
the way there is for plugins — two preferences for the same class is always
a real conflict, because only one can ever actually take effect. Flag it
regardless of whether the diff's own preference happens to be the one that
currently wins the merge order; that order is a property of module sequence
and file discovery, not something the diff controls or documents.
