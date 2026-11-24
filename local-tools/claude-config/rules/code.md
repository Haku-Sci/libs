# Code rules — every service

Applied by the developers, checked by `reviewer`. Each rule has an id the review cites.
Global rules in `~/.claude/CLAUDE.md` and `~/.claude/memory/` also apply (English only, never hide problems, respect structure and boundaries, UTC everywhere except display).

## CODE-1 Comment length
Ceilings, not targets; no comment is often better.
- Class: 4 lines max. Function: 2 lines max. Type, interface or a statement inside a block: 1 line max.
- Never comment a variable/constant definition or a type field: the name carries the intent.
- An entity property declaration (e.g. a Groovy `@Property`): 1 line, stating what the value is, never why. Rationale goes where the value is used.
- A function gets a comment only when its name does not say everything it does: `getStringLength()` needs none; if it skips special characters, one line says so.
Why: long doc blocks were repeatedly rejected as hard to scan.

## CODE-2 Comment scope
A comment describes only the code right below it. Never who calls it, what happens downstream, or which other service owns later steps.
A comment names what the code does, never the concrete shape of a path, identifier, pattern or format that the code itself builds or parses (`<id>/internal/<name>`, a column list, a regex). The code is the one place where that shape lives.
Example: `legacyReferenceName` says it "returns the plain attachment name of a legacy reference", not the legacy path layout.
Why: caller information goes stale and bloats comments; a repeated shape makes every comment that restates it false when the shape changes, and nobody finds them.

## CODE-3 No comments on bug fixes
A bug-fix diff adds no comment, not even one line. The explanation goes in the chat.

## CODE-4 No try/catch by default
No `try/catch` and no swallowing `.catch(() => {})` unless the user approved it for that case with a concrete justification (what throws, why it can't be prevented, why handling it there is right). Fix the cause instead (ordering, guards, awaiting the right promise). Re-throwing or surfacing an error needs no approval.
Why: a catch that hides an error looks like a fix but isn't (e.g. collab `yjs.destroy()` race, really an ordering bug).

## CODE-5 Surface failures through the Logger
A justified catch logs with the service's `Logger`: `logger.error` for real failures, `logger.warn` for degraded but handled, with the id/context and the message. Hot paths are not exempt; only routine success stays unlogged.

## CODE-6 No meaning encoded in identifiers
No prefixes/suffixes on ids or type strings that code later parses (`startsWith`, `split`). To tell records apart, the caller sends the types it knows and the data owner filters, or add an explicit column.
Why: rejected `llm-` prefix on vault `credentials.type`.

## CODE-7 No single-call wrappers
A function that only forwards to one other function, adding nothing, is a wrapper that just packages the call: its body belongs in the caller. Extract only when the code is reused or isolates a real concern.
A function that has a use of its own is not a wrapper: for example a default implementation that subclasses override.
Why: a wrapper adds a name to read and a hop to follow for no gain.

## CODE-8 Generic entry points only dispatch
A generic hook or receiver (Hocuspocus `onStateless`, any message/event entry) forwards to the one dispatcher that routes by type. A new message type is a new case in that dispatcher, never a feature-specific pre-check in the hook.

## CODE-9 Services are host-agnostic
No code, comment, README or Dockerfile ties a service to its host or to a co-located service ("logs runs next to Consul"). Placement is a deployment fact. Consul discovery through `@haku-sci/utils` is fine.

## CODE-10 Reuse and unify before writing
Before writing a utility, look in `libs` (`@haku-sci/utils`) and, in front, `lib/` (e.g. the existing color function, `lib/utils-time.ts`). Reuse what already exists there; extend a helper of the service itself rather than adding a local copy, but never extend `libs`: changes to `libs` are avoided at all cost.
Two pieces of code doing the same thing become one, parameterised only by what really differs.
Why: every change to duplicated code has to be carried over everywhere, and the copies are confusing.

## CODE-11 One general rule, no exceptions
Before writing an `if/else`, look for the rule that works in every case. Never add a branch to patch one input the general logic gets wrong: fix the general logic.
A flag whose only job is to stop some code from running in one situation (`initializing`, `skipHook`, `isImport`) is the same exception in disguise, and a red flag. It almost always comes with a duplicate (CODE-10): the disabled code is rebuilt elsewhere for that situation. Make the shared code correct in that situation instead, so that it is the only place doing the work.
Check: every boolean field or parameter you add, or find in a function you touch, and every place that rebuilds what a generic function already produces. Both are reported, not extended (CODE-15).
Example: `setProperties` records the one standard action, "post" or "patch" according to the node's state; `init()` must not set an `initializing` flag to silence it and then build its own copy of the action.
Why: one exception in general code breeds more, and makes the code harder to analyse: the impact of one specific case has to be searched everywhere. The flag and the duplicate hide each other, so neither is noticed alone.

## CODE-12 Special cases stay out of generic code
Generic code never handles a particular case. The particular case is its own function, called where that case arises, and it may use the generic one.
Example: `getStringLength()` returns the length; a caller that needs the word count calls a separate `getWordCount()`, never a flag or a branch inside `getStringLength()`. CODE-8 applies this rule to entry points.
Why: same as CODE-11.

## CODE-13 Name a function for what it does, and do only that
A function's name says what it does, never the context it is called from (`getStringLength`, not `getSidebarTitleLength`). It does that and nothing else: no side effect outside its name (recording an action, logging a business event, notifying), even when it is convenient to put it there. The side effect belongs to the operation that owns it, which calls the function.
Why: the calling context changes with the caller and its reasons; the function must be understood for what it is. Context, when needed, is given at the call site. A hidden side effect is run by every caller, whether it wants it or not, and forces flags to switch it off (CODE-11).
Example: `setProperties` writes properties into the graph; the operation that creates or patches the node records its action.

## CODE-14 Name a variable for what it is used for
A variable, parameter or prop is named for the role its value plays, not for its type: a quantity is `quantity`, not `number`. Never a generic name (`data`, `item`, `it`, `obj`, `v`, `f`) or an abbreviation (`lc`, `cats`) when a precise one exists. Rename existing vague names in the code you touch.
Example: a `List` callback parameter holding the row's Inventory is `inventory`, not `data`; the colour shown for a low stock is `lowStockColor`, not `lc`.
Why: it makes the code easier to read.

## CODE-15 Never extend code that breaks a rule
When code you have to touch already breaks a project rule, do not extend it or copy it. Report it (file and line) to the lead, with one of three proposals: remove it, correct it, or open a todo issue. The user decides.
Why: extending a violation spreads it and makes its removal harder.

## CODE-16 No fallback for a value the contract guarantees
When a value is guaranteed by the contract of a call (a returned reference, an id, a required field), its absence is an error: fail with a clear message naming what is missing. Never substitute a default or a similar value (`a ?? b`) to keep going.
Why: the fallback hides the broken contract, and the wrong value is stored or used downstream, where the cause is much harder to find.

## CODE-17 A base function is never bypassed
A base function (an operation on an entity, an auth guard, a hook runner) is the only way to do what it does, and its checks are part of it. No caller skips them through another function, a lower-level call, a flag or an option, even an internal or trusted caller. If a legitimate caller is rejected by the checks, the checks or the caller are wrong: report the case (CODE-15), do not open a second path.
Why: security. A second path to the same change escapes the rules that protect the data, drifts from the first (CODE-10), and is copied by the next caller.
Example: BACK-1 (no anonymous option on `AuthGuard`), BACK-4 (no hook-free read in graph) and BACK-5 are applications of this rule.

## CODE-18 Generic code knows no particular case
A generic function or component (a list, a form, a hook runner, a base class method) handles all items the same way and never names a particular field, type or value (for example a field called `storageType`, or the type `Note`). The particular case lives with the thing it concerns (the entity class, its base class or its subclass) and is exposed through a neutral hook that the generic code calls for every item. An exception is acceptable only where the code is global by nature and has both a global and a specific view (for example the data importer).
Why: every special case added to a generic function is run by every other caller, forces the next case to be added next to it, and hides the real owner of the rule (here the entity that has a storage), which breaks CODE-13 and CODE-15.
Example: `ownsStorageType` in `create.tsx` and a `StorageType` filter in `list.tsx` put the storage rule in generic code; the rule belongs to the entity that has a storage.

## CODE-19 Use the standard and the native
Use the standard and native mechanism of the language, the platform or the tool (a PATH lookup, an environment variable, a library's default) and never add configuration, a fallback lookup or a custom path that the standard mechanism makes unnecessary. If the standard mechanism fails in an environment, the environment is fixed, not the code.
Why: extra configuration is code to maintain and hides an environment problem; here a fallback search for `soffice` in `Program Files` was rejected because `soffice` must be found through PATH like any other tool.
Example: `docx_pdf.py` launches `soffice` by its name (`SOFFICE_PATH` or PATH), without searching the install folders.
