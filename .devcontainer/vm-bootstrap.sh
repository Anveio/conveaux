#!/bin/bash
# Bootstrap script for Ubuntu VM to run 20 parallel Claude Code instances
# Run as root: sudo bash vm-bootstrap.sh

set -euo pipefail

echo "=== VM Bootstrap for Claude Code Development ==="

# System updates
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $SUDO_USER

# Install Node.js 22 (for running Claude Code outside containers too)
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# Install Claude Code CLI globally
npm install -g @anthropic-ai/claude-code

# Install devcontainer CLI
npm install -g @devcontainers/cli

# System tuning for many parallel processes
cat >> /etc/sysctl.conf << 'EOF'
# Increase file descriptors for many parallel agents
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288
fs.inotify.max_user_instances = 1024

# Network tuning
net.core.somaxconn = 65535
EOF
sysctl -p

# Increase limits for the user
cat >> /etc/security/limits.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
* soft nproc 65535
* hard nproc 65535
EOF

# Create workspace directory
mkdir -p /home/$SUDO_USER/workspaces
chown -R $SUDO_USER:$SUDO_USER /home/$SUDO_USER/workspaces

echo ""
echo "=== Bootstrap Complete ==="
echo ""
echo "Next steps:"
echo "1. Log out and back in (for docker group)"
echo "2. Set ANTHROPIC_API_KEY in ~/.bashrc"
echo "3. Clone your repo to ~/workspaces/"
echo "4. cd into repo and run: devcontainer up --workspace-folder ."
echo "5. Enter container: devcontainer exec --workspace-folder . bash"
echo "6. Run agents: ./devcontainer/run-parallel-agents.sh 20"
echo ""
echo "Or run Claude Code directly with:"
echo "  claude --dangerously-skip-permissions"
