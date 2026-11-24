# Front rules — services/front

Applied by `front-dev`, checked by `reviewer`. Also see `rules/code.md`.

## FRONT-1 Tailwind first
Style with Tailwind classes only, using arbitrary values (`w-[42px]`) before anything else. No `style={{}}`, no CSS modules, no custom CSS unless Tailwind truly cannot express it (dynamic CSS variables, canvas); then ask first.

## FRONT-2 Overriding the global button rule
`globals.css` has `button { border: 0; background-color: var(--haku-sci-blue); color: white }` and `button:hover { background-color: #0056b3 }` outside any `@layer`, so they beat Tailwind utilities. Every overridden property needs `!`: `!border-2 !border-solid !border-<color>` (all three), `!bg-…`, `!text-…`, `hover:!bg-…`.

## FRONT-3 Icons are the buttons; no className on `<button>`
An interactive icon (Lucide) gets `onClick` directly, never a `<button>` wrapper. No `className` on `<button>` unless explicitly asked.

## FRONT-4 Never `overflow: hidden` to fix layout
No `overflow(-x|-y): hidden` to fix scroll, overlap or toolbar issues, not even temporarily. Trace the height chain (flex → wrappers → target) and fix `flex`, `min-h`, `h-full`, `height`.
Why: it clips tooltips, dropdowns and floating toolbars and hides the real problem.

## FRONT-5 File naming and placement
Mobile files start with `mobile-` (`mobile-protocol-element.tsx`, not `…-mobile.tsx`). Feature components live in `components/haku-sci/<Feature>/`, not in `components/plate/ui/`.

## FRONT-6 Dropdown API: data out, no render slots
`components/dropdown.tsx` exports matches through `onQueryChanged(query, foundContents)`. Custom menu UI is injected as a data item (`searchText` = current query, `selectable: false`). Never add ReactNode props to Dropdown.

## FRONT-7 ProjectDropdown only
Project selection always goes through `components/haku-sci/entity/Project/dropdown.tsx`; no custom pickers. Keep ProjectDropdown untouched (its only extension point is `onQueryChanged`); caller-specific behaviour (e.g. deferred creation) lives in the caller. No new props without asking.

## FRONT-8 Translation keys
- Search all namespaces (`action`, `general`, `entity.*`…) before adding a key; reuse when the meaning matches; prefer fixing the TSX to use an existing key.
- Namespace by concept, not by screen (`chooseProject` goes in `project` even inside a presentation form).
- Key names never mention UI elements (`col`, `list`, `input`, `button`, `label`, `row`); keys describe data (`action.status`, `entity.project.typeName`).

## FRONT-9 Time helpers in `lib/utils-time.ts`
Every date/time/duration/timezone helper lives there (`secondsToDisplay(seconds, "units" | "clock")`…). Extend it with generic names; never a local copy.

## FRONT-10 Stores live in `context/`
The `entityStore` singleton sits in `context/entity-context.tsx` next to its Provider. `lib/` keeps only pure helpers.

## FRONT-11 `API_URL` only inside `sendApiRequest`
No other file reads `API_URL` to build a fetch URL. If a raw fetch seems needed (e.g. a Blob), flag it and ask; the known exception is `classes/entities/document.tsx` `getMedia()`.

## FRONT-12 Generic editor code stays agnostic
Never branch on entity type (`entityType === "Protocol"`) in `getEditorKit`, the fixed toolbar, the passage plugin or `DocumentEditor`. Each page builds an `EditorExtension` next to it and passes it as `<DocumentEditor extension={…}>`; extend that interface instead.

## FRONT-13 No disabled inputs at creation
`updatable: false` means not patchable after creation; during creation every input is enabled. Never derive `disabled`/read-only from `updatable` in a create form or row.

## FRONT-14 UI refactors one page at a time
A refactor touching several pages' layout is split per page, each checked visually in the browser before the next. `tsc` cannot catch layout regressions.
Why: a multi-page EntityDropdown/List unification had to be fully reverted.
