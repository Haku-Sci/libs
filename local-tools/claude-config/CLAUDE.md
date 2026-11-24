# Haku-Sci — CLAUDE.md

Scientific collaboration platform. The workspace is `D:\Haku-Sci\services`, which is **not** a git repository: every service in it is its own GitLab repository (`git.haku-sci.com/haku-sci/<name>`, mirrored on GitHub), and `libs`, `Gateway`, `consul` and `neo4j` are sibling repositories in `D:\Haku-Sci`. Most work is per **feature** and touches 2+ repositories: always check `git status` in every repository you edited.

This Claude config (this file, `.claude/`, `.mcp.json`) lives in `../libs/local-tools/claude-config` and is installed into the workspace by its `install.ps1`. Edit it there and commit in libs.

This is the only `CLAUDE.md` of the workspace: per-service notes are in the **Services** section below. Add a `CLAUDE.md` inside a service only for instructions that must apply there and nowhere else.

## Hard rules (the user's, no exception)
- **Never `git commit` and never `git push`**, on any repository, and do not offer to: the user commits and pushes. If an operation needs a clean tree, ask the user to commit or stash.
- Never `npm publish` `@haku-sci/utils` or any package, never bump a version for a publish: say a publish is needed.
- Deploying the graph plugin into the LOCAL Neo4j is allowed without asking, as part of development, and only through the recipe of `libs/.vscode/launch.json` ("[plugin] compile neo4j plugin": in `services/graph/plugins`, `MAX_VISITED_ITEMS=15 mvn clean package; python D:/Haku-Sci/libs/local-tools/containers/start-container.py neo4j --restart`). Never on a remote host, never by another way (no ad hoc `docker cp`).
- On the ssh hosts (`ssh gateway`, `integration`, `front`, `api`, `vault`, `third-party`, `graph`), never inspect secrets or query a production database without the user's authorization for that specific action.
- Always name the service a controller, pattern, handler or hook belongs to ("graph's AppController"), with the file path when possible.

## Roles and workflow (V cycle): whoever builds never verifies
- **Lead** (the main session): receives the user's instructions, plans, writes the contract (HTTP route, `@MessagePattern`, payload and response types), has the user validate it, delegates, routes failures, reports. **The lead does not write production code, review or test.**
- **Developers**: `front-dev` (services/front), `backend-dev` (NestJS services, graph plugin, libs), `data-processing-dev` (services/data-processing). Each gets the contract and its task, writes only in its area.
- **Rules come before the contract, always.** A contract says what to build, never how to break a rule. The developer checks its own code against `rules/*.md` and the service boundaries before reporting, and when the contract asks for something a rule forbids, builds it the compliant way and reports the gap to the lead. The reviewer is a second check, not the first.
- **Tester**: the `tester` agent. Designs the scenarios from the user's instructions and the contract only (never the code), then runs them in the browser through the Playwright MCP.
- **Reviewer**: the `reviewer` agent. Applies the rules, merges the `/code-review` and `/security-review` findings, gives the verdict and **stages** the reviewed files (`git add` with explicit paths, never a commit).

Workflow:
1. The user gives the instructions to the lead; the lead writes the contract and has it validated.
2. The lead delegates in parallel: developers (code) and `tester` phase "design" (scenarios).
3. Once the code is done, `/qa` on the **uncommitted changes only** (never on commits, never on other code): one `reviewer` (contract, rules, correctness, security), with the developer's summary never passed to it. `/qa deep` adds `/code-review` and `/security-review`, run directly by the lead (never wrapped in agents).
4. The reviewer stages the reviewed files when nothing is blocking.
5. `tester` phase "run": starts the stack with `stack.js` if needed, waits for every service, tests.

Reporting to the user: **one message, at the end.**
- When the lead delegates, the only thing it says before the work is done is one line: "OK, demande envoyée à <agents>." No plan recap, no partial result, no comment on an agent's output.
- **Start agents in the foreground** (`run_in_background: false`), and agents that can run in parallel **in a single message**, so that their results all come back in the same turn. Chain the next steps (fixes, re-review, tests) in that same turn, without reporting in between.
- If an agent result still arrives on its own (a background notification) while other agents or steps are pending, do not write to the user: continue the work silently.
- When everything is finished, or when a decision from the user is needed (contract question, loop limit, scope too large), send **one** consolidated message with every result.

At every step, a failure goes back up: review → developer, then re-review of the delta only (what changed since the staging). Test failure → developer (bug), tester (wrong scenario) or **the user** (contract question). After 3 passes back up, the lead stops and reports to the user. Small change: delegate to a single developer; the roles stay separate.

Token budget (the lead re-reads its whole conversation at every turn, and every agent starts by re-reading rules, diff and app):
- **One feature per session.** Start a new session for the next feature; in a long one, `/compact` after each validated pass.
- **Batch.** Fixes found in one pass go to the developers together and are verified by **one** review and **one** test run, never one cycle per fix.
- **The lead stays thin.** It never reads source files or diffs itself (that is the agents' job) and keeps agent results short; full reports stay in their files.
- **Small scope.** `/qa` reviews only what is uncommitted: commit finished features before starting the next one, so the uncommitted changes are one feature. `/qa` refuses scopes over ~1500 changed lines or 4 repositories and asks to split.
- **Light by default.** The reviewer runs on Sonnet; `/code-review` / `/security-review` only in `/qa deep`. A delta review is always light, and a retest runs only the affected scenarios.

## Rules
Coding rules and design contracts, applied by developers and checked by the reviewer. Global rules in `~/.claude/CLAUDE.md` and `~/.claude/memory/` apply too.
@rules/code.md
@rules/front.md
@rules/backend.md
@rules/contracts.md

The reviewer also reads `rules/review.md` (review calibration). The user teaches both through `/teach-reviewer` or feedback on a `/qa` report: a coding rule goes into the matching `rules/*.md`, a review calibration into `rules/review.md`, always after the user approved the wording.

## Architecture

`libs/` and `Gateway/` are siblings of the workspace: `../libs`, `../Gateway`.

```
services/
├── api/              NestJS HTTP gateway — the only HTTP entry point
├── graph/            NestJS TCP — entity graph in Neo4j (entities, relationships, access), migrations
├── vault/            NestJS TCP + PostgreSQL — users, messages, notifications, KPIs, actions, credentials
├── third-party/      NestJS TCP + PostgreSQL — external integrations (SSO/ORCID, CSL, DOI/search, storages, email, meetings)
├── collab/           NestJS + Hocuspocus (Y.js) over the libs WSS bridge — real-time document state
├── notification/     NestJS TCP + WSS — real-time notifications to the browser
├── logs/             NestJS TCP + SQLite — bug reports (fingerprinted errors from every service)
├── cron/             NestJS application context — scheduled jobs and bots (sends TCP, never listens)
├── test/             NestJS TCP + PostgreSQL — UI test runner driven by the Claude Agent SDK
├── data-processing/  Python TCP — document conversions (docx/pdf/citeproc), handwriting, speech
└── front/            Next.js — Plate.js editor, Hocuspocus client, citation-js
libs/                 @haku-sci/utils — Microservice bootstrap, Consul, TCPService, RabbitMQ, WSS tickets, HakuError
Gateway/              GitLab CI templates (deploy-*.yml) + webhook-receiver (error → GitLab issue, close guard)
```

### Communication
- `front` → `api` (REST, JWT cookie, `X-EntityId` header for the entity context).
- `api` → microservices over **TCP** with `TCPService.sendMessage(service, method, resource, payload)` from `@haku-sci/utils`; services are discovered through **Consul**.
- Broadcasts between services go through RabbitMQ (`HakuSubscribe`).
- WebSockets (`collab`, `notification`): `api` hands out a ticket URL (`GET` → `get/<userId>` on `wss`), the browser connects directly to the service.
- Errors: every service reports to `logs` (`LOG_SERVICE`); `Gateway/webhook-receiver` turns them into GitLab issues labelled `auto-generated`.

### Service boundaries (checked by the `reviewer` agent)
- `api` orchestrates and delegates. No business logic, no data ownership, no direct DB access.
- `graph` owns the Neo4j entity graph; `vault` owns relational business data. Neither calls external APIs.
- `third-party` owns external integrations. It does not manage internal user data.
- `collab` holds real-time document state. No business rules.
- `front` is presentation. It talks only to `api` (REST) and to the WSS URLs `api` returns, never to a TCP microservice.
- `cron` triggers work in other services; the work itself lives in the owning service.
- Shared plumbing goes in `libs`, never copied into a service.

If a request requires a file or service to go beyond its role, raise a warning before proceeding.

## Git workflow
- The user commits and pushes (see Hard rules). Day-to-day commits go to `integration` in each repository; `integration` is merged into `production` through a GitLab merge request.
- `/qa` must run before the user pushes `integration`: a git `pre-push` hook in each repository refuses the push otherwise (`git push --no-verify` bypasses it). Gateway is on `main` and is not gated.
- `.env`, `certificates/`, `*.pem` and `*.key` are never committed.

## Commands
- NestJS services: `npm run start:dev`, `npm run build`.
  - `npm run lint` everywhere except `collab`.
  - `npm run test` (Vitest) everywhere except `collab` and `cron`; `vault` has no tests yet.
  - `npm run test:e2e` in `api`, `graph`, `third-party`.
- `front`: `npm run dev`, `npm run dev-https`, `npm run build`, `npm run lint`. No test suite yet.
- `data-processing`: `cd app && python main.py` (Docker runs `preloader.py` first). No test suite yet.
- `@haku-sci/utils` is built and copied into the services by `../libs/local-tools/build_and_copy_libs.ps1`.
- Starting the local stack is a launch configuration (not a Claude skill).

## Services

### api
- `src/main.ts`: HTTPS in local (`DEBUG=true`), CORS from `CORS_ORIGINS`, `AllExceptionsFilter` (reports to logs; `requestContext()` redacts secrets), `maintenanceMiddleware`.
- `src/auth/`: JWT in the `access_token` cookie (or `Authorization: Bearer`). `AuthGuard(options)` is a factory and also parses multipart bodies.
- One folder per downstream service (`vault/`, `third-party/`, `entity/` → graph, `log/`, `test/`, `user/`): controller + thin service calling `TCPService.sendMessage`.
- `X-EntityId` is passed through, never interpreted here. No global `ValidationPipe`: validate inputs explicitly.
- A new endpoint usually also needs the handler in the owning microservice: change both in the same feature.

### graph
- Business operations are Neo4j procedures called by `AppService.callProcedure`. `src/app/` handles `get`, `post`, `patch`, `delete`, `search/{:type}`, `statistics`.
- The `post`, `patch` and `delete` procedures return the ordered list of actions they performed (`post`/`patch`/`delete` on a node or a relationship, plugin side effects and delete cascades included). `AppService` calls the hooks from that list, never from the command sent. A relationship action carries only the link's data (ids, type, properties).
- `src/utils/hooks`: `POSTPROCESS_REGISTRY` per type or group. `post`, `patch` and `deleted` hooks run after the write, batched per hook and action kind; properties they return are stored by a follow-up `patch`, and the actions their own calls cause go through the hooks too. `preDelete` (before the write, can refuse) exists only for `User`; delete rules such as `canBeDeleted` live in the plugin and are never bypassed. `get` hooks and `METADATA_REGISTRY` are unchanged.
- A schema change needs a new migration in `src/migrations/versions/` (run by `migration.runner.ts`), never a manual Cypher fix.
- The local Neo4j is shared with the `neo4j` MCP: run `/backup neo4j` before destructive experiments.

### vault
- One module per domain in `src/<domain>/` (`user`, `credentials`, `message`, `archive`, `notification`, `kpi`, `action`), entities next to their module; data migrations in `src/migrations/`.
- `STORAGE_ENCRYPTION_DATA_PASSWORD` encrypts stored credentials: never log decrypted values.

### third-party
- `src/identification/` (SSO/OAuth, ORCID), `src/csl-style/` (`CSL_GITHUB_TOKEN`), `src/search/` (OpenAlex, PubMed, Semantic Scholar, Unpaywall, scite), `src/storage/` (external storages + the internal stream server used by `data-processing`), `src/email/`, `src/meeting/` (Zoom, Google Meet, enabled only when their env vars are set).
- API keys and OAuth secrets come from env: never log them, never return them to `api`.

### collab
- `src/main.ts` creates the Hocuspocus server, then `WssMicroservice.bootstrap` (libs) attaches authenticated WebSockets (`userId`, `documentId` from the ticket). `src/servers/hocuspocus.ts`: access levels, document cache, snapshots, persistence. `src/app/`: TCP handlers.
- Saves are debounced: `DEBOUNCE` (default 30000 ms) resets on every edit, `MAX_DEBOUNCE` (default 350000 ms, must stay `>= DEBOUNCE`) forces a save during continuous typing. Also `DOCUMENT_CACHE_TTL`, `SNAPSHOT_INTERVAL`, `REQUEST_MAX_SIZE`.
- No tests: verify a change end to end with two browser sessions on the same document.

### notification
- `src/app/`: TCP handlers and `wss.controller.ts` (ticket URL, socket fan-out). Persisted notifications live in `vault`.

### logs
- SQLite at `LOGS_DATABASE_PATH`. `src/log/`: ingestion (`log.service.ts`), `fingerprint.ts`, bug/occurrence entities, `log.runner.ts`.
- Reports may contain user input: keep the redaction in `api/src/utils/request-context.ts` in sync when adding fields.

### cron
- Never registers in Consul. `src/job/`: `JobService` and one runner per job in `runner/`; `src/bot/`: bot account helpers; `src/report.ts`: reports failures to `LOG_SERVICE`.

### test
- `src/test`, `src/step`, `src/run`, `src/run-step`: CRUD and run lifecycle; entities in `src/entities/`.
- `src/llm/llm.service.ts`: Agent SDK query (`HAKU_TEST_MODEL`, default `haiku`; `HAKU_SKILLS_CWD`, `HAKU_TEST_FRONT_URL`, `TEST_MCP_POSTGRES_URL`); prompts in `src/utils/llm-prompt.ts`.
- The SDK is ESM-only and loaded through a dynamic `import()`; keep it that way.

### data-processing
- Python 3.12, registers in Consul like the NestJS services. `app/main.py` registers the handlers (`labjournal/split`, `document/convert`, `document/journals`, `/handwriting`, …).
- `app/microservice/` mirrors the libs `TCPService` / `TCPClient` / Consul: keep the wire format identical to `@haku-sci/utils`.
- `app/document_processing/`: Slate (Plate) → docx/pdf, citations via pandoc citeproc; called by `third-party` only, reads files through its storage stream.
- `app/handwriting/`, `app/speech/`: weights are preloaded at build (`preloader.py`), `HF_HUB_OFFLINE=1` at runtime. Never fetch weights at runtime.

### front
- `app/` routes (`[path]/` is the entity navigator); `classes/entities/` client entity model (`factory.ts`), `classes/relationship.ts`.
- `context/`: `useEntityContext()` is used almost everywhere: change its shape with care.
- `components/haku-sci/` app components, `components/plate/` Plate.js editor (plugins in `editor/plugins/`, UI in `ui/`), `components/ui/` shadcn.
- `translations/`: UI strings always go through translations; `tHtml()` escapes variables. `dangerouslySetInnerHTML` only with escaped or sanitized HTML.
- Debounces: `DEBOUNCE` local editor save (default 5000 ms, unrelated to collab's), `DEBOUNCE_SAVE_DOCUMENT` (default 50000 ms), `MAX_DEBOUNCE` (default 350000 ms).
- Import cycles exist around `classes/entities/factory.ts` and the Plate discussion/suggestion kits: do not add new ones.

### libs (`../libs`)
- `src/microservice/` (bootstrap, Consul, Postgres helper, exception filter), `src/TCP/` (`TCPService`, `HakuError`, `RestrictSender`), `src/rabbit-mq/` (`HakuSubscribe`), `src/wss/` (`WssMicroservice`, tickets, bridge registry).
- A change affects every service: rebuild with `build_and_copy_libs.ps1` and restart the services using it; update `data-processing/app/microservice/` with any wire-format change.

## Local databases and Claude tooling
- MCP servers (`.mcp.json`): `neo4j`, `postgres` and `postgres-test` start through `mcp-servers/mcp-launch.py`, which reads credentials from `../libs/.env`. `postgres` is **read-only** (`restricted`). Database writes (`postgres-test`, unrestricted, and `neo4j`'s `write_neo4j_cypher`) are pre-approved but **reserved for the `tester`** (test data setup, checks, cleanup): no other agent has these tools, and the lead never uses them. `playwright` (pinned, production origins blocked, persistent logged-in profile) is used by the `tester`.
- Local stack: `node D:/Haku-Sci/services/.claude/scripts/stack.js status | tools | start | wait | stop`, in the background with no window (`spawn_hidden.py`).
  - `tools` runs VS Code's "[Local Tools] start local tools" (consul, neo4j, postgres), starting only what is down.
  - `start` runs `tools`, then the services of "Start all services" in normal mode (no debugger), as configured in `stack.js` (`SKIPPED_SERVICES`, `EXTRA_SERVICES`).
  - `stop` closes only what `tools` / `start` launched; the tester stops what it started at the end of its run. `test` is never started by an agent.
- `/backup`, `/restore`, `/cleanDB <neo4j|postgres>` use `../.local-scripts/mcp-db.sh` (docker exec, not the MCP).
- `/todo <service> <description>` creates a GitLab issue through `../libs/local-tools/todo-agent/create-issue.py`, the same script as the phone agent; it needs `GITLAB_TOKEN` in the user environment.
- To read code, use the Read, Grep and Glob tools, not shell pipelines (`cat | grep`, `Get-ChildItem | % {…}`, `for` loops): those each need the user's approval. To see what changed across repositories, use `node D:/Haku-Sci/services/.claude/scripts/changeset.js [repo ...]` (pre-approved, read-only).
- `/qa`: review of the current feature (see Roles). `/teach-reviewer <feedback>`: turns the user's feedback into a rule.
- Claude hooks in `.claude/hooks/`: protected files, type-check of edited services at the end of each turn, graphify update, `/qa` recording. Git hook: `git-hooks/qa-gate.js`, called from each repository's `pre-push` (installed by `install.ps1`).

## Key environment variables
| Variable | Service | Purpose |
|---|---|---|
| `DEBUG` | api, collab, cron, test | `"true"` enables local TLS via mkcert (`certificates/`) |
| `CORS_ORIGINS` | api | Allowed origins (comma or space separated) |
| `PORT` / `ADDRESS` | all | Listening port and address |
| `SQL_HOST/PORT/USER/PASSWORD/DB` | vault, third-party, test | PostgreSQL connection |
| `NEO4J_URI` / `NEO4J_PASSWORD` | graph | Neo4j connection |
| `INIT` | vault, third-party, test | Truthy → TypeORM `synchronize`. Beware: `Boolean(process.env.INIT)` is true for `"false"` too |
| `LOG_SERVICE` | api, collab, cron | Name of the logs service errors are reported to |
| `CONSUL_WAIT` | all (libs) | Max ms a refreshed Consul lookup waits for a missing service, default 10000 |

Collab and front debounce variables are in their **Services** entries.

## Conventions
- All code, comments and commit messages in English.
- Strict TypeScript everywhere except `api` (`strictNullChecks`/`noImplicitAny` off — do not add new `any`).
- NestJS patterns: modules, controllers, services, guards, filters. Auth guard `AuthGuard()` (factory) in `api`.
- TypeORM entities: `src/<module>/*.entity.ts` (vault) or `src/*/entities/*.entity.ts` (third-party).
- Never hide problems: no `overflow: hidden` / `pointer-events: none` / try-catch-and-ignore to mask a bug (details in `rules/`).

## Important notes
- Never enable `synchronize` (`INIT`) in production — destructive migration risk.
- `api` is the only HTTP entry point; never expose a TCP microservice.

## graphify
Knowledge graph at the Haku-Sci root, `D:/Haku-Sci/graphify-out/` (services, libs, Gateway). Always pass it explicitly, since the workspace has none:
- For codebase questions, first run `graphify query "<question>" --graph D:/Haku-Sci/graphify-out/graph.json`; use `graphify path "<A>" "<B>" --graph …` and `graphify explain "<concept>" --graph …` for focused questions.
- Read `D:/Haku-Sci/graphify-out/GRAPH_REPORT.md` only for broad architecture review.
- The graph is updated automatically (in the background, about 3 minutes) by the Stop hook after edits.

## Files outside services
`services/` holds only the service repositories plus what the tools require at the workspace root (`.claude`, `.mcp.json`, `.vscode`); this file is imported by `D:/Haku-Sci/CLAUDE.md`. Never write anything else there: test scenarios, reports and screenshots go to `D:/Haku-Sci/tests/`, logs to `D:/Haku-Sci/.logs/`, scratch files to the session's scratchpad.
