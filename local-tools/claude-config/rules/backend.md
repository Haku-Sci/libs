# Backend rules — NestJS services, graph plugin, data-processing

Applied by `backend-dev` / `data-processing-dev`, checked by `reviewer`. Also see `rules/code.md` and `rules/contracts.md`.

## BACK-1 Never weaken authentication
No option on the shared `AuthGuard` that lets a request through without a valid session (e.g. `allowAnonymous`), and no anonymous endpoint. If something only works anonymously, raise the trade-off and accept losing the case.
Why: a bypass option on a shared guard can be copied onto any route; anonymous endpoints are flooding targets.

## BACK-2 No batch order correlation
In graph batch procedures, never match returned nodes to the submitted array by index. After submission only the result data matters: build follow-up logic from fields on the result itself.

## BACK-3 No invented graph names
In Cypher (or any query on the user's schema), never guess labels, relationship types, property names or directions. Ask, or use explicit placeholders (`-[:REL_TYPE___TO_REPLACE]->`) and say they must be replaced.
Why: a wrong type or direction silently matches nothing.

## BACK-4 Graph hooks are never bypassed
No hook-free load/read path in graph. If a hook gets in the way, remove it and let the data owner handle the data.

## BACK-5 Node changes go through update
A node's properties change only through `update()` of the node. Inside the graph plugin no code calls `setProperties` directly to change a node on behalf of a request or a job.
Example: a task marked done calls `task.update(...)`, never a private patch method.

## BACK-6 Fewest possible external calls
Calls to an external service (Dropbox, OneDrive, Allas, any provider API) must be as few as possible: ONE call for X elements, never X calls of one element each. Use the provider's recursive listing with pagination (cursor) and its batch endpoints; a loop that awaits one external call per element is a finding.
Why: each call costs a network round-trip and counts against the provider's limits, and one failing call among many fails the whole operation. The Dropbox folder listing made one call per folder (~61 calls, 35-40 s) and failed on a single provider 500.
Example: list folders with one recursive `filesListFolder` and `filesListFolderContinue` on `cursor`, not a recursive `getFolders` that awaits one call per folder.
