#!/usr/bin/env bash

# Launch all Haku-Sci services in the correct startup order.
# Run from the libs/ directory: bash launch-server.sh

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"

# Load shared .env
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
else
  echo "[warn] No .env file found at $ENV_FILE"
fi

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ── 1. Local tools (neo4j + postgres) ────────────────────────────────────────
log "Starting local tools (neo4j + postgres)..."
python "$SCRIPT_DIR/local-tools/start-local-tools.py" neo4j postgres &
LOCAL_TOOLS_PID=$!

log "Waiting 15s for databases to be ready..."
sleep 15

# ── 2. Api ────────────────────────────────────────────────────────────────────
log "Starting Api..."
GATEWAY_HOST=localhost \
PORT=443 \
ADDRESS=api.haku-test.com \
CORS_ORIGINS="https://www.haku-test.com https://haku-test.com" \
CONSUL_URL=http://hubs.haku-test.com:8500 \
npm run start:dev --prefix "$SCRIPT_DIR/../services/api" &
API_PID=$!

sleep 5

# ── 3. Vault ──────────────────────────────────────────────────────────────────
log "Starting Vault..."
SQL_DB=vault \
SQL_HOST=localhost \
TEMP_USER_HOURS_DURATION=48 \
NOTIFICATION_READ_RETENTION_DAYS=1 \
npm run start:dev --prefix "$SCRIPT_DIR/../services/vault" &
VAULT_PID=$!

# ── 4. Graph ──────────────────────────────────────────────────────────────────
log "Starting Graph..."
NEO4J_URI=neo4j://localhost:7687 \
NEO4J_USER=neo4j \
SUPER_ADMIN_LOGIN=SuperAdmin@haku-sci.com \
npm run start:dev --prefix "$SCRIPT_DIR/../services/graph" &
GRAPH_PID=$!

sleep 5

# ── 5. Collab ─────────────────────────────────────────────────────────────────
log "Starting Collab..."
PORT=4000 \
API_URL=https://api.haku-test.com \
ADDRESS=collab.haku-test.com \
NODE_TLS_REJECT_UNAUTHORIZED=0 \
DEBOUNCE=5000 \
npm run dev --prefix "$SCRIPT_DIR/../services/collab" &
COLLAB_PID=$!

# ── 6. Third-party ────────────────────────────────────────────────────────────
log "Starting Third-party..."
SQL_DB=third-party \
SQL_HOST=localhost \
SMTP_PORT=587 \
FROM_USERNAME=Haku-Sci \
UNPAYWALL_URL=https://api.unpaywall.org/v2 \
SEMANTIC_SCHOLAR_URL=https://api.semanticscholar.org/graph/v1/paper/search \
OPEN_ALEX_URL=https://api.openalex.org/works \
PUBMED_ESEARCH_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi \
PUBMED_EFETCH_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi \
PUBMED_ABSTRACT_URL=https://pubmed.ncbi.nlm.nih.gov \
DOI_URL=https://doi.org \
ALLAS_OPENSTACK_ENDPOINT=https://pouta.csc.fi:5001/v3 \
SIGNED_URL_DURATION=1 \
npm run start:dev --prefix "$SCRIPT_DIR/../services/third-party" &
THIRD_PARTY_PID=$!

# ── 7. Front ──────────────────────────────────────────────────────────────────
log "Starting Front..."
PORT=443 \
HOST=haku-test.com \
API_URL=https://api.haku-test.com \
DOI_ENDPOINT=https://doi.org/ \
FEEDBACK_EMAIL=feedback@haku-sci.com \
npm run dev-https --prefix "$SCRIPT_DIR/../services/front" &
FRONT_PID=$!

log "All services started."
log "PIDs — local-tools: $LOCAL_TOOLS_PID | api: $API_PID | vault: $VAULT_PID | graph: $GRAPH_PID | collab: $COLLAB_PID | third-party: $THIRD_PARTY_PID | front: $FRONT_PID"

# Keep script alive and forward Ctrl+C to all children
trap 'log "Shutting down..."; kill $LOCAL_TOOLS_PID $API_PID $VAULT_PID $GRAPH_PID $COLLAB_PID $THIRD_PARTY_PID $FRONT_PID 2>/dev/null' EXIT
wait
