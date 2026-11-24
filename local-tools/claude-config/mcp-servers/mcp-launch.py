"""Start a local MCP server of D:/Haku-Sci/services/.mcp.json with credentials read from libs/.env.

Local dev tooling only, not part of any service. Keeps secrets out of .mcp.json:
the credentials are passed to the server through its environment, never on its
command line. Usage: python -I mcp-launch.py <neo4j|postgres|postgres-test|postgres-db:<database>|postgres-test-db:<database>>
`postgres` is read-only for every session; `postgres-test` can write and is meant for the tester only.
`postgres-db:<database>` is read-only and connects to one named database (test, third-party, vault).
`postgres-test-db:<database>` is the writable counterpart (tester only), same database whitelist.
"""
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote

ENV_FILE = Path(os.environ.get("HAKU_ENV_FILE", "D:/Haku-Sci/libs/.env"))

# Pinned versions: unpinned uvx pulled a postgres-mcp release incompatible with mcp 2.x.
POSTGRES_MCP = "postgres-mcp==0.3.0"
OVERRIDES = Path(__file__).resolve().parent / "mcp-overrides.txt"
POSTGRES_MCP_SDK = "mcp==1.29.1"
NEO4J_MCP = "mcp-neo4j-cypher==0.6.0"
# Databases of the local PostgreSQL instance reachable through `postgres-db:<database>`.
POSTGRES_DATABASES = ("test", "third-party", "vault")


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        match = re.match(r'\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*"?([^"]*)"?\s*$', line)
        if match:
            values[match.group(1)] = match.group(2)
    return values


def require(values: dict[str, str], *keys: str) -> None:
    missing = [key for key in keys if not values.get(key)]
    if missing:
        sys.exit(f"[mcp-launch] missing in {ENV_FILE}: {', '.join(missing)}")


def main() -> int:
    server = sys.argv[1] if len(sys.argv) > 1 else ""
    values = {**read_env_file(ENV_FILE), **os.environ}
    env = dict(os.environ)

    database = "postgres"
    if server.startswith(("postgres-db:", "postgres-test-db:")):
        prefix, database = server.split(":", 1)
        if database not in POSTGRES_DATABASES:
            sys.exit(f"[mcp-launch] unknown database '{database}', expected one of: {', '.join(POSTGRES_DATABASES)}")
        server = "postgres" if prefix == "postgres-db" else "postgres-test"

    if server in ("postgres", "postgres-test"):
        require(values, "SQL_USER", "SQL_PASSWORD", "SQL_HOST", "SQL_PORT")
        env["DATABASE_URI"] = (
            f"postgresql://{values['SQL_USER']}:{values['SQL_PASSWORD']}"
            f"@{values['SQL_HOST']}:{values['SQL_PORT']}/{quote(database, safe='')}"
        )
        # restricted: read-only transactions with a statement timeout; unrestricted: read and write.
        access = "restricted" if server == "postgres" else "unrestricted"
        command = [
            "uvx", "--overrides", str(OVERRIDES), "--with", POSTGRES_MCP_SDK,
            POSTGRES_MCP, f"--access-mode={access}",
        ]
    elif server == "neo4j":
        require(values, "NEO4J_PASSWORD")
        env["NEO4J_URL"] = values.get("NEO4J_URL", "bolt://localhost:7687")
        env["NEO4J_USERNAME"] = values.get("NEO4J_USERNAME", "neo4j")
        env["NEO4J_PASSWORD"] = values["NEO4J_PASSWORD"]
        command = ["uvx", NEO4J_MCP]
    else:
        sys.exit("Usage: mcp-launch.py <neo4j|postgres|postgres-test|postgres-db:<database>|postgres-test-db:<database>>")

    # Resolve through PATH/PATHEXT (uvx may be a shim on Windows) without a shell,
    # so version specifiers like "<0.4" are never read as redirections.
    executable = shutil.which(command[0])
    if not executable:
        sys.exit(f"[mcp-launch] {command[0]} not found on PATH")
    return subprocess.call([executable, *command[1:]], env=env)


if __name__ == "__main__":
    sys.exit(main())
