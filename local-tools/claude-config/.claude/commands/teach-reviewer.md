---
description: Turn the user's feedback into a rule for the developers and the reviewer (usage - /teach-reviewer <feedback>)
---

Turn the user's feedback into one written rule. Nothing is written without the user's approval of the exact wording.

Rule files are in `D:/Haku-Sci/libs/local-tools/claude-config/rules/`:
- `code.md` (CODE-n, every service), `front.md` (FRONT-n), `backend.md` (BACK-n), `contracts.md` (CONTRACT-n, decisions crossing services): **coding rules**, applied by the developers and checked by the reviewer;
- `review.md` (REVIEW-n): **review calibration** only (a false positive to ignore, a point to always check, a severity to change), following the format at the top of that file.

The global rules (`~/.claude/CLAUDE.md`, `~/.claude/memory/`) belong to the user: never edit them. If the feedback concerns them, say that the user has to change them.

Steps:
1. If `$ARGUMENTS` is empty and no feedback on a `/qa` finding was just given, ask for the feedback and stop.
2. If the feedback refers to a finding (`F<n>`), take its location and rule id from the last `/qa` report.
3. Classify it: how code must be written → the matching coding-rule file; how to review → `review.md`. A false positive caused by a rule that is too broad is fixed by narrowing that rule, not by an `ignore` entry.
4. Read the target file and the global rules. If an existing rule already says it, or contradicts it, show that rule and propose to amend or replace it instead of adding a new one.
5. Show the user the exact text (next free id, today's date for `review.md`, the `Why:` in the user's own reasons, an example from the code) and the target file. Wait for approval.
6. On approval, write it with the Edit tool. Report the id and the file. The user commits it in libs.

Argument: $ARGUMENTS
