# Plugin/Observer Conflict Check

Run this when a reviewed diff touches `di.xml`, `events.xml`, a `Plugin/`
class, or an `Observer/` class — a common source of real Magento bugs is a
second plugin/observer nobody knew existed on the same target.

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
