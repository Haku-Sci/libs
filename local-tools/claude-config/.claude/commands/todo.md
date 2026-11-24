---
description: Create a GitLab issue for a service (usage - /todo <service> <description>)
allowed-tools: Bash(python D:/Haku-Sci/libs/local-tools/todo-agent/create-issue.py *)
---

This command only creates GitLab issues. It never lists, reads, edits or deletes anything.
It uses the same script as the phone agent (`libs/local-tools/todo-agent`), so both behave identically.

Format of the argument: `<service> <description>`

- `<service>` is the first word of `$ARGUMENTS` (e.g. `api`, `vault`, `graph`, `front`, `logs`). It names the GitLab project `haku-sci/<service>`.
- `<description>` is the rest of `$ARGUMENTS`.

Behavior:

1. If `$ARGUMENTS` is empty, or has no description after the service, print the expected format and stop.
2. Translate the description into English (it is the issue description). Create a short English title from it (imperative, under 80 characters).
3. Create the issue with a single Bash call, wrapping each value in single quotes (escape any single quote inside a value as `'\''`):
   ```bash
   python D:/Haku-Sci/libs/local-tools/todo-agent/create-issue.py --service '<service>' --title '<title>' --description '<english description>'
   ```
   The whole call must be exactly this one command, so the permission rule matches. It authenticates with the `GITLAB_TOKEN` environment variable; never print, read or echo it.
4. If the script fails (unknown project, 401/403, network), report its error as-is. Do not retry against another project and do not fall back to anything else.
5. On success, confirm with the issue title, the target project and the URL printed by the script.

Argument: $ARGUMENTS
