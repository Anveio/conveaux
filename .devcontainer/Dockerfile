FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

# Non-root user (created by base image, but we ensure it exists)
ARG USERNAME=developer
ARG USER_UID=1000
ARG USER_GID=$USER_UID

RUN groupadd --gid $USER_GID $USERNAME || true \
    && useradd --uid $USER_UID --gid $USER_GID -m $USERNAME || true \
    && apt-get update \
    && apt-get install -y sudo \
    && echo $USERNAME ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/$USERNAME \
    && chmod 0440 /etc/sudoers.d/$USERNAME

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Clean up
RUN apt-get autoremove -y && apt-get clean -y

USER $USERNAME
WORKDIR /workspace
