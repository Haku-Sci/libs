# SSH Gateway Configuration

This document describes the configuration of the Gateway server that serves as the single entry point for accessing the infrastructure servers.

## Architecture

```
Internet
    │
    │ Port 22 (SSH) open only on Gateway
    ▼
┌─────────────────────┐
│   GATEWAY SERVER    │
│   IP: 157.180.122.255
│   User: root        │ ← Admin connects here
└─────────────────────┘
    │
    │ ProxyJump SSH
    │
    ├───────────────────────────────────────┐
    │                                       │
    ▼                                       ▼
┌─────────────────┐                 ┌─────────────────┐
│  front          │                 │  graph          │
│  135.181.44.196 │                 │  46.62.129.100  │
└─────────────────┘                 └─────────────────┘
    ...                                     ...
```

### Principle

- The **Gateway** is the only server directly accessible from the Internet via SSH
- All other servers are accessible only through the Gateway (ProxyJump)
- Connections are transparent thanks to local SSH configuration
- Shared SSH key: `~/.ssh/id_ed25519`

## Initial Configuration

<details>
<summary><b>1. SSH Configuration on Gateway</b></summary>

Connect to the Gateway:

```bash
ssh gateway
```

Edit the SSH configuration:

```bash
sudo nano /etc/ssh/sshd_config
```

Verify/add these lines:

```bash
# Enable TCP forwarding (essential for jump host)
AllowTcpForwarding yes

# Enable agent forwarding
AllowAgentForwarding yes

# Security
GatewayPorts no
PasswordAuthentication no
PubkeyAuthentication yes
```

Restart SSH:

```bash
sudo systemctl restart sshd
sudo systemctl status sshd
```

</details>

<details>
<summary><b>2. Firewall Configuration on Gateway</b></summary>

```bash
# Allow SSH from Internet
sudo ufw allow 22/tcp
sudo ufw allow ssh

# Enable firewall
sudo ufw enable

# Verify
sudo ufw status verbose
```

</details>

<details>
<summary><b>3. Firewall Configuration on Other Servers</b></summary>

For each server (front, graph, vault, api, third-party, hubs, collab):

```bash
# Connect to server
ssh <server>

# Allow SSH only from Gateway
sudo ufw allow from 157.180.122.255 to any port 22 proto tcp

# Allow HTTP/HTTPS (for GitHub, Docker registry, etc.)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable

# Verify
sudo ufw status numbered

# Disconnect
exit
```

</details>

<details>
<summary><b>4. Local SSH Configuration (Windows)</b></summary>

The `~/.ssh/config` file (or `C:\Users\<YourName>\.ssh\config`) is configured as follows:

```ssh-config
Host gateway
    HostName 157.180.122.255
    User root
    IdentityFile ~/.ssh/id_ed25519

Host front
  HostName 135.181.44.196
  User root
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump gateway

Host graph
  HostName 46.62.129.100
  User root
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump gateway

Host vault
  HostName 65.108.153.150
  User root
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump gateway

Host api
  HostName 46.62.155.252
  User root
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump gateway

Host third-party
  HostName 46.62.159.243
  User root
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump gateway

Host hubs
  HostName 95.217.181.63
  User root
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump gateway

Host collab
  HostName 157.180.116.127
  User root
  IdentityFile ~/.ssh/id_ed25519
  ProxyJump gateway
```

</details>

## Daily Usage

<details>
<summary><b>Connecting to Servers</b></summary>

```powershell
# Connect to Gateway
ssh gateway

# Connect to a server via Gateway (transparent)
ssh front
ssh graph
ssh vault
# etc.
```

</details>

<details>
<summary><b>Useful Commands</b></summary>

```powershell
# Execute a command on a server
ssh front "docker ps"
ssh graph "systemctl status nginx"

# Copy files
scp file.txt front:/root/
scp vault:/var/log/app.log ./

# Create SSH tunnel (e.g., access a database)
ssh -L 5432:localhost:5432 vault
```

</details>

## Connectivity Tests

<details>
<summary><b>Click to expand test commands</b></summary>

```powershell
# Test Gateway connection
ssh gateway "echo 'Gateway OK'"

# Test connection via ProxyJump
ssh front "echo 'Front via Gateway OK'"

# Verify ProxyJump is being used
ssh -v front 2>&1 | Select-String "ProxyJump"

# Test all servers
ssh graph "hostname"
ssh vault "hostname"
ssh api "hostname"
ssh third-party "hostname"
ssh hubs "hostname"
ssh collab "hostname"
```

</details>

## Server Inventory

| Name | Public IP | Role |
|-----|-------------|------|
| gateway | 157.180.122.255 | SSH entry point |
| front | 135.181.44.196 | Frontend |
| graph | 46.62.129.100 | GraphQL |
| vault | 65.108.153.150 | Vault/Secrets |
| api | 46.62.155.252 | API |
| third-party | 46.62.159.243 | Third-party services |
| hubs | 95.217.181.63 | Hubs |
| collab | 157.180.116.127 | Collaboration |

## Security

### Current Rules

- SSH (port 22): open only on Gateway
- Other servers: SSH accessible only from Gateway
- HTTP/HTTPS (80/443): open on all servers (for GitHub Actions)

### SSH Keys

- Shared key: `~/.ssh/id_ed25519`
- Password authentication: disabled
- No automatic key rotation (for now)

## Troubleshooting

<details>
<summary><b>Connection Refused</b></summary>

```powershell
# Verify Gateway connection
ssh -v gateway

# Verify firewall on target server
ssh gateway
ssh <target_server>
sudo ufw status
```

</details>

<details>
<summary><b>Connection Timeout</b></summary>

- Verify that Gateway server is accessible
- Verify that target server firewall allows Gateway
- Verify that ProxyJump is properly configured in `~/.ssh/config`

</details>

<details>
<summary><b>Permission Denied</b></summary>

- Verify that `id_ed25519.pub` key is in `~/.ssh/authorized_keys` on the server
- Verify permissions: `chmod 600 ~/.ssh/authorized_keys`

</details>

## Next Steps (Phase 2)

- Configure GitHub Actions to deploy via Gateway
- Add webhook listener on Gateway
- Implement deployment dispatcher
- Centralized logs and monitoring
