# Gateway Deployment System Setup

This guide explains how to configure the Gateway server for automatic deployments.

## Architecture

```
GitHub Actions
    │
    │ manifest: status="started"
    │ build image → push GHCR
    │ manifest: status="ready"
    │
    ▼
deployment-manifest repo
    │
    │ (Gateway polls every 5 min)
    │
    ▼
Gateway
    │
    │ Wait for all builds to be "ready"
    │ Deploy all services in batch
    │
    ▼
Target Servers
```

## Prerequisites

1. **GitHub Personal Access Token** with permissions:
   - `read:packages` (to pull from GHCR)
   - `repo` (to clone deployment-manifest)

2. **deployment-manifest repository** created on GitHub

## Installation on Gateway

### Step 1: Install Dependencies

```bash
ssh gateway

# Install required packages
sudo apt update
sudo apt install -y jq docker.io git

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker
```

### Step 2: Create Directory Structure

```bash
# Create gateway directories
sudo mkdir -p /opt/gateway/{logs,deployed}
sudo chmod 755 /opt/gateway
```

### Step 3: Upload Configuration Files

From your local machine, upload the config files:

```powershell
# Upload services.json
scp ssh/gateway-services.json gateway:/opt/gateway/services.json

# Upload deploy script
scp ssh/deploy.sh gateway:/opt/gateway/deploy.sh

# Upload watch script
scp ssh/watch-manifest.sh gateway:/opt/gateway/watch-manifest.sh

# Make scripts executable
ssh gateway "chmod +x /opt/gateway/deploy.sh /opt/gateway/watch-manifest.sh"
```

### Step 4: Configure GitHub Authentication

```bash
ssh gateway

# Login to GHCR
docker login ghcr.io -u YOUR_GITHUB_USERNAME
# Password: paste your GitHub Personal Access Token

# Configure Git for manifest repo
git config --global user.email "gateway@yourdomain.com"
git config --global user.name "Gateway Server"

# Clone manifest repo (test)
cd /opt/gateway
git clone https://YOUR_TOKEN@github.com/YOUR-ORG/deployment-manifest.git manifest-repo
```

### Step 5: Update Configuration

Edit `/opt/gateway/services.json` and replace `your-github-org` with your actual organization:

```bash
ssh gateway
sudo nano /opt/gateway/services.json
```

Edit `/opt/gateway/watch-manifest.sh` and update the manifest repo URL:

```bash
sudo nano /opt/gateway/watch-manifest.sh
# Change: MANIFEST_REPO_URL="https://github.com/YOUR-ORG/deployment-manifest.git"
```

### Step 6: Configure Cron Job

```bash
ssh gateway

# Edit crontab
crontab -e

# Add this line to check every 5 minutes:
*/5 * * * * /opt/gateway/watch-manifest.sh >> /opt/gateway/logs/cron.log 2>&1
```

### Step 7: Test the System

```bash
# Test deployment script manually
ssh gateway "/opt/gateway/deploy.sh api latest"

# Test manifest watcher manually
ssh gateway "/opt/gateway/watch-manifest.sh"

# View logs
ssh gateway "tail -f /opt/gateway/logs/watch-$(date +%Y-%m-%d).log"
```

## GitHub Secrets Configuration

In each service repository, add these secrets:

1. **MANIFEST_REPO_TOKEN**: GitHub Personal Access Token with `repo` permission

In GitHub Actions variables, set:

1. **DOCKER_PLATFORM**: `linux/amd64` (or your platform)

## Usage

### Automatic Deployment

Once configured, deployments happen automatically:

1. Push code to a service repository
2. GitHub Actions builds and pushes to GHCR
3. Manifest is updated with `status: "started"` → `status: "ready"`
4. Gateway checks every 5 minutes
5. When all builds are ready, Gateway deploys them

### Manual Deployment

You can still deploy manually:

```powershell
# Deploy a specific version
ssh gateway "/opt/gateway/deploy.sh api main-abc1234"

# Check deployment logs
ssh gateway "tail -f /opt/gateway/logs/deploy-$(date +%Y-%m-%d).log"
```

### Monitoring

```powershell
# Watch the manifest checker
ssh gateway "tail -f /opt/gateway/logs/watch-$(date +%Y-%m-%d).log"

# Check deployed versions
ssh gateway "ls -lah /opt/gateway/deployed/"
ssh gateway "cat /opt/gateway/deployed/api.txt"

# Check cron logs
ssh gateway "tail -f /opt/gateway/logs/cron.log"
```

## Troubleshooting

### Deployment fails with "permission denied"

Check that Gateway can SSH to target servers:
```bash
ssh gateway "ssh root@10.1.0.3 hostname"
```

### Docker pull fails

Check GHCR authentication:
```bash
ssh gateway "docker login ghcr.io"
```

### Manifest not updating

Check Git credentials:
```bash
ssh gateway "cd /opt/gateway/manifest-repo && git pull"
```

### Cron not running

Check cron logs:
```bash
ssh gateway "tail -f /var/log/syslog | grep CRON"
```

## File Locations

| Path | Description |
|------|-------------|
| `/opt/gateway/services.json` | Service configuration |
| `/opt/gateway/deploy.sh` | Deployment script |
| `/opt/gateway/watch-manifest.sh` | Manifest watcher |
| `/opt/gateway/manifest-repo/` | Cloned manifest repository |
| `/opt/gateway/deployed/` | Tracking deployed versions |
| `/opt/gateway/logs/` | All logs |
| `/opt/gateway/logs/deploy-YYYY-MM-DD.log` | Deployment logs |
| `/opt/gateway/logs/watch-YYYY-MM-DD.log` | Watcher logs |
| `/opt/gateway/logs/cron.log` | Cron execution logs |

## Security Notes

- ✅ No ports open on Gateway (except SSH)
- ✅ Gateway pulls from GitHub (outbound only)
- ✅ All deployments logged
- ✅ Service isolation via private network
- ⚠️ GitHub token stored in Git config (consider using SSH keys instead)
- ⚠️ Docker credentials stored in `~/.docker/config.json`
