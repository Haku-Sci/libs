@echo off
setlocal

echo [gitlab-cleanup] Connecting to gateway...

ssh gateway "bash -s" <<'REMOTE'
set -e

echo ""
echo "=== Disk usage before cleanup ==="
df -h /

echo ""
echo "=== Docker usage ==="
docker system df

echo ""
echo "=== Truncating GitLab container log ==="
GITLAB_ID=$(docker inspect gitlab --format '{{.Id}}')
LOG_PATH="/var/lib/docker/containers/${GITLAB_ID}/${GITLAB_ID}-json.log"
LOG_SIZE=$(du -sh "$LOG_PATH" | cut -f1)
echo "Log size before: $LOG_SIZE"
truncate -s 0 "$LOG_PATH"
echo "Log truncated."

echo ""
echo "=== Pruning unused Docker images ==="
docker image prune -a -f

echo ""
echo "=== Pruning Docker build cache ==="
docker buildx prune -f

echo ""
echo "=== Disk usage after cleanup ==="
df -h /
REMOTE

if %ERRORLEVEL% NEQ 0 (
    echo [gitlab-cleanup] ERROR: SSH command failed.
    exit /b 1
)

echo.
echo [gitlab-cleanup] Done.
endlocal
