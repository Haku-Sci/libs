#!/bin/bash

# Usage: ./deploy.sh <service_name> <tag>
# Example: ./deploy.sh api main-abc1234

set -e

SERVICE_NAME=$1
IMAGE_TAG=${2:-latest}
CONFIG_FILE="/opt/gateway/services.json"
LOG_DIR="/opt/gateway/logs"
LOG_FILE="$LOG_DIR/deploy-$(date +%Y-%m-%d).log"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Validate arguments
if [ -z "$SERVICE_NAME" ]; then
    echo "Usage: $0 <service_name> [tag]"
    echo "Example: $0 api main-abc1234"
    exit 1
fi

log "=== Starting deployment of $SERVICE_NAME:$IMAGE_TAG ==="

# Read service config
TARGET_HOST=$(jq -r ".services.\"$SERVICE_NAME\".target_host" "$CONFIG_FILE")
CONTAINER_NAME=$(jq -r ".services.\"$SERVICE_NAME\".container_name" "$CONFIG_FILE")
DOCKER_NETWORK=$(jq -r ".services.\"$SERVICE_NAME\".docker_network // \"\"" "$CONFIG_FILE")
PORT_MAPPING=$(jq -r ".services.\"$SERVICE_NAME\".port_mapping // \"\"" "$CONFIG_FILE")
REGISTRY_ORG=$(jq -r ".registry.organization" "$CONFIG_FILE")

if [ "$TARGET_HOST" == "null" ]; then
    log "ERROR: Service $SERVICE_NAME not found in config"
    exit 1
fi

IMAGE_NAME="ghcr.io/$REGISTRY_ORG/$SERVICE_NAME:$IMAGE_TAG"

log "Target: $TARGET_HOST"
log "Image: $IMAGE_NAME"

# Step 1: Pull image from GHCR
log "Step 1/4: Pulling image from GHCR..."
docker pull "$IMAGE_NAME"

# Step 2: Save image to tar
log "Step 2/4: Saving image to tar..."
TMP_IMAGE="/tmp/${SERVICE_NAME}_${IMAGE_TAG}.tar"
docker save "$IMAGE_NAME" -o "$TMP_IMAGE"

# Step 3: Transfer to target server
log "Step 3/4: Transferring image to $TARGET_HOST..."
cat "$TMP_IMAGE" | ssh -o StrictHostKeyChecking=no root@"$TARGET_HOST" docker load

# Step 4: Deploy on target server
log "Step 4/4: Deploying on target server..."

# Build docker run command
NETWORK_ARG=""
if [ -n "$DOCKER_NETWORK" ] && [ "$DOCKER_NETWORK" != "null" ]; then
    NETWORK_ARG="--network $DOCKER_NETWORK"
fi

PORT_ARG=""
if [ -n "$PORT_MAPPING" ] && [ "$PORT_MAPPING" != "null" ]; then
    PORT_ARG="-p $PORT_MAPPING"
fi

ssh -o StrictHostKeyChecking=no root@"$TARGET_HOST" bash <<EOF
    # Stop and remove old container
    docker rm -f $CONTAINER_NAME || true

    # Create network if needed
    if [ -n "$DOCKER_NETWORK" ] && [ "$DOCKER_NETWORK" != "null" ]; then
        docker network create "$DOCKER_NETWORK" || true
    fi

    # Run new container
    docker run -d --name $CONTAINER_NAME \
        $NETWORK_ARG \
        $PORT_ARG \
        --restart unless-stopped \
        $IMAGE_NAME

    # Cleanup old images
    docker image prune -af
EOF

# Cleanup local tar file
rm -f "$TMP_IMAGE"

log "=== Deployment completed successfully ==="
log ""
