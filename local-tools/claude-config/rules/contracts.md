# Design contracts

Decisions that cross service boundaries. Applied by every developer, checked by `reviewer` against any diff that touches them.

## CONTRACT-1 graph owns entity data
Entity models (Grant, Foundation, Project, Researcher, LabJournal…) are Neo4j classes in `graph/plugins/src/main/groovy/org/haku_sci/models/`. Backend work on an entity field or relationship goes to graph, never to vault or third-party, even when the request comes through a third-party endpoint (e.g. storage import). third-party only lists/imports external files.

## CONTRACT-2 vault keeps personal data
vault holds each user's personal account data (email, toUpdate, tos, expirationDate, actions…), readable only by that user. graph never fetches or merges it; api's `GET /user` merges vault `user/get/{userId}` into the user's own node.

## CONTRACT-3 Relationship names on the wire
Relationships cross the wire only by concept name: the `AHakuRelationship` subclass name in PascalCase (`Parent`, `Owns`, `Share`, `Member`, `Checked`, `Generic`…), never the persisted Neo4j type (`PARENT_OF`, `OWNS`…). Front mirrors them in the string `enum RelationshipType` (`Parent = "Parent"`), always written as `RelationshipType.X`, never a bare string. A new type = a new subclass + the matching enum member. `graph/src/utils/hooks.ts` registries key on that name.

## CONTRACT-4 Three relationship kinds
Neutral generic (`a->b`), `parent` (structural) and `owns` (user owns a node). An `owns` edge and a neutral edge between the same nodes is expected, not a bug.

## CONTRACT-5 Create responses carry no relationships
`post` / `entity/batch` responses return scalar `ownerId` / `parentId` only, no `relationships` array (that comes only from the deep-traversal `GET entity/:id?max=N`). Every non-public creation also adds a User→node `OWNS` edge. Front code must build links from the scalars or refetch.

## CONTRACT-6 canPost semantics
`node.canPost(user)`: `node` is the parent of what gets created, `user` its owner. Users are never parents: no `canPost` on a User class. To restrict who creates a type, throw in that type's `init()`.

## CONTRACT-7 Property patch permissions
Modifying a property requires `canBePatched(user)`; an `isPrivate` property additionally requires `showPrivate(user)`. Plus the existing `lockWhen` / `updatable = false` checks.

## CONTRACT-8 Error reporting
Callees return `HakuError` chains (one stack per layer). Only the originating caller (api for the front, cron runners) reports to `logs`.

## CONTRACT-9 collab access lock
collab is authoritative for document access: the front only sends requests (`setGlobalLevel`, `setUserLevel`, `requestAccess`) and renders `setAccessState`. The lock is write priority, not a hierarchy: wording is "unlock / débloquer", never "granted / accordé". Exactly one owner connection holds the save token.

## CONTRACT-10 front build and Plate pinning
- front `build`, `preview` and `dev` use `--webpack`, and `next` is pinned exact (Turbopack breaks server actions in prod).
- front has no committed lock file: all `platejs` / `@platejs/*` are pinned exact, with `@platejs/core|slate|utils` and `slate`, `slate-dom`, `slate-react` overrides bumped together.

## CONTRACT-11 Services are agnostic of each other
What a service defines (a path or storage layout, a format, an identifier, a name, a rule) is defined only in that service. No other service redefines, parses, rebuilds or duplicates it: a value a service emits is opaque to its consumers, which store it and send it back unchanged.
Test: if service A changes its definition, service B must not have to change.
Only native, universal standards that do not belong to Haku-Sci (a float, a path, a URL, a date) may be interpreted anywhere. Never add or change shared code in `libs` to get around this.
Example: the front never builds a storage path (`<entityId>/haku-sci-internal/<name>`) nor keeps its last segment; only third-party knows the layout, the front keeps the reference it receives and sends it back as is.
Why: a definition copied into another service has to be carried over everywhere, and the copies drift apart (same reason as CODE-10).
