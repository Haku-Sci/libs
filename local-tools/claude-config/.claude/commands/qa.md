---
description: Verification branch of the V cycle for ONE feature - scoped review + staging, then functional tests (usage - /qa [deep] [contract or focus])
---

You act as the **lead**: you orchestrate, you never review, test or fix anything yourself.

**Silence until the end.** Say only "OK, /qa lancé." and then nothing until the whole `/qa` is finished, or until you need the user's decision (contract, scope, loop limit).
- Start the agents in the foreground (`run_in_background: false`), and those of the same step in parallel in one message.
- Chain review → fixes → re-review → tests in the same turn, with no intermediate report and no comment on an agent's output.
- The user gets everything in the single message of step 7.
`/qa` verifies **the uncommitted changes, absolutely nothing else**: index and working tree against HEAD, plus untracked files. Commits, pushed or not, are never reviewed again, and no other code is explored. Its cost grows with the scope and with every agent started, so keep both minimal.

## 1. Contract, feature, mode
- **Contract**: what the feature must do (routes, `@MessagePattern`s, payload and response types, expected behaviour). Take it from `$ARGUMENTS` if given, otherwise from the contract the user validated earlier in this conversation. If there is none, ask the user for it in one question and stop until they answer.
- **Feature id**: a short kebab-case id, reused for the tester's folder `D:/Haku-Sci/tests/<feature>/`.
- **Mode**: `light` by default; `deep` only if `$ARGUMENTS` starts with `deep` (see step 4).

## 2. Scope
1. **Build the scope**:
   - run `node D:/Haku-Sci/services/.claude/scripts/changeset.js`: the repositories with uncommitted changes. That is the scope, as targets `repo`;
   - if `$ARGUMENTS` names repositories or files, keep only those (`repo:path1,path2`);
   - never add anything that is not an uncommitted change.
2. **Measure it**: `node D:/Haku-Sci/services/.claude/scripts/changeset.js <targets…>` prints the changed lines per repository.
3. **Size guard**: above ~1500 changed lines, or above 4 repositories, stop. Tell the user the scope is too large for one `/qa`, propose a split (by repository or by sub-feature), and wait for their choice.

## 3. Scenarios
If `D:/Haku-Sci/tests/<feature>/scenarios.md` does not exist, start the **`tester` agent in phase "design"** now, in parallel with step 4. Give it only the user's instructions, the contract and the feature id.

## 4. Review (reviewer)
1. **`light` (default)**: start **one `reviewer` agent** with the contract and the scope targets (its scope: their uncommitted changes only). It checks contract, rules, correctness and security itself. Do **not** run `/code-review` or `/security-review`.
2. **`deep`** (explicit request only, e.g. before merging to production or for auth / storage / data-access changes):
   - run `/code-review` at `low` effort and `/security-review` **yourself, directly**, on the scoped repositories, one after the other, restricted to their uncommitted changes (discard any finding on committed code);
   - **never** wrap them in a `general-purpose` agent: each wrapper re-reads everything and spawns its own agents;
   - then start the `reviewer` with `model: opus`, the contract, the scope and their raw findings.
3. **Re-review**: add `delta` to the reviewer's prompt, always in `light` mode, whatever the first mode was.
4. Never pass the reviewer a developer's summary or your own explanation of the change.
5. The reviewer returns a short report (F1…Fn), its verdict, and stages the scoped files when nothing is blocking.
6. **Blocking findings** → go back up: delegate each finding to its owner (`front-dev`, `backend-dev`, `data-processing-dev`) with the contract, **one delegation per owner** for the whole batch. When they are done, redo step 4 with `delta`. Do not go to step 5.

## 5. Functional tests (tester)
Start the **`tester` agent in phase "run"** with the feature id (on a retest, with the list of scenarios to run: the failed ones plus those on the same screens). It starts the stack if needed, runs the scenarios and returns its verdict and failures (T1…Tn).

For each FAIL or BLOCKED, go back up according to its `Likely cause`:
- `code` → the owner developer, then step 4 (`delta`), then step 5 again;
- `scenario` → the tester (phase "design"), then step 5 again;
- `contract` → **stop and ask the user**;
- `environment` → report it to the user.

Skip step 5 when the feature has no user-visible behaviour (pure refactor, internal pattern with no UI): say so in the result.

## 6. Limits
- **Loops**: count the passes back up. After **3** for this feature, stop and report to the user what keeps failing.
- **Agents**: one `reviewer` and at most one `tester` per pass. Never start a `general-purpose` agent from `/qa`.
- **Context**: agents return verdicts and failures only; full reports stay in their files (`report.md`, the diff files). Quote a file instead of pasting it.

## 7. Result
1. Record the result as a single command, with `<b>` the blocking findings of the last review and `<f>` the FAIL + BLOCKED tests of the last run (`<f>` = 0 if step 5 was skipped as above, 1 if it was not run for another reason):
   ```bash
   node D:/Haku-Sci/services/.claude/hooks/record-review.js qa <b> <f>
   ```
   The git `pre-push` gate lets the user push `integration` only after a `/qa` with `<b>` = 0 and `<f>` = 0 since the last push.
2. Report to the user, in this **single final message** (the first one since "OK, /qa lancé."), briefly:
   - the review and test verdicts;
   - the remaining findings and failures;
   - what is staged in each repository;
   - the number of passes back up.

   End with: *Reply e.g. "F2 false positive: <why>" or "T3 expected X" to teach the reviewer or the tester.*
3. Feedback on a finding is handled as `/teach-reviewer` does, and written only after the user's approval. Feedback on a scenario: the tester updates `scenarios.md`.

The user commits what is staged; Claude never commits or pushes.

Argument: $ARGUMENTS
