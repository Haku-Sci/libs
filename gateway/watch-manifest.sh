#!/bin/bash

# Gateway manifest watcher
# Polls the deployment-manifest repo and deploys when all builds are ready

set -e

MANIFEST_REPO_URL="https://github.com/YOUR-ORG/deployment-manifest.git"
MANIFEST_DIR="/opt/gateway/manifest-repo"
DEPLOYED_DIR="/opt/gateway/deployed"
LOG_DIR="/opt/gateway/logs"
LOG_FILE="$LOG_DIR/watch-$(date +%Y-%m-%d).log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Ensure directories exist
mkdir -p "$DEPLOYED_DIR" "$LOG_DIR"

log "=== Checking for new deployments ==="

# Clone or pull manifest repo
if [ ! -d "$MANIFEST_DIR" ]; then
    log "Cloning manifest repository..."
    git clone "$MANIFEST_REPO_URL" "$MANIFEST_DIR"
else
    log "Pulling latest manifests..."
    cd "$MANIFEST_DIR"
    git pull
fi

cd "$MANIFEST_DIR"

# Check if manifests directory exists
if [ ! -d "manifests" ]; then
    log "No manifests directory found"
    exit 0
fi

# Count manifests by status
TOTAL_MANIFESTS=$(find manifests -name "*.json" | wc -l)
STARTED_COUNT=0
READY_COUNT=0
SERVICES_TO_DEPLOY=()

log "Found $TOTAL_MANIFESTS manifest(s)"

# Check all manifests
for MANIFEST_FILE in manifests/*.json; do
    if [ ! -f "$MANIFEST_FILE" ]; then
        continue
    fi

    STATUS=$(jq -r '.status' "$MANIFEST_FILE")
    SERVICE_NAME=$(jq -r '.service' "$MANIFEST_FILE")
    TAG=$(jq -r '.tag' "$MANIFEST_FILE")
    WORKFLOW_RUN=$(jq -r '.workflow_run_id' "$MANIFEST_FILE")

    log "  $SERVICE_NAME: $STATUS (tag: $TAG)"

    if [ "$STATUS" = "started" ]; then
        STARTED_COUNT=$((STARTED_COUNT + 1))
    elif [ "$STATUS" = "ready" ]; then
        READY_COUNT=$((READY_COUNT + 1))

        # Check if this version is already deployed
        DEPLOYED_FILE="$DEPLOYED_DIR/${SERVICE_NAME}.txt"
        DEPLOYED_RUN=$(cat "$DEPLOYED_FILE" 2>/dev/null || echo "")

        if [ "$DEPLOYED_RUN" != "$WORKFLOW_RUN" ]; then
            SERVICES_TO_DEPLOY+=("$SERVICE_NAME:$TAG:$WORKFLOW_RUN")
        fi
    fi
done

log "Status: $STARTED_COUNT building, $READY_COUNT ready"

# If any builds are in progress, don't deploy
if [ $STARTED_COUNT -gt 0 ]; then
    log "⏳ Builds in progress. Waiting for all builds to complete..."
    log "=== Check complete - no deployment ==="
    exit 0
fi

# If no services to deploy, exit
if [ ${#SERVICES_TO_DEPLOY[@]} -eq 0 ]; then
    log "✅ All services are up to date"
    log "=== Check complete - no deployment ==="
    exit 0
fi

# All builds are ready and there are services to deploy
log "🚀 All builds ready! Deploying ${#SERVICES_TO_DEPLOY[@]} service(s)..."

# Deploy all services
for SERVICE_INFO in "${SERVICES_TO_DEPLOY[@]}"; do
    IFS=':' read -r SERVICE_NAME TAG WORKFLOW_RUN <<< "$SERVICE_INFO"

    log "Deploying $SERVICE_NAME:$TAG..."

    # Run deployment script
    if /opt/gateway/deploy.sh "$SERVICE_NAME" "$TAG"; then
        # Mark as deployed
        echo "$WORKFLOW_RUN" > "$DEPLOYED_DIR/${SERVICE_NAME}.txt"
        log "✅ $SERVICE_NAME deployed successfully"
    else
        log "❌ Failed to deploy $SERVICE_NAME"
    fi
done

log "=== Deployment batch complete ==="
