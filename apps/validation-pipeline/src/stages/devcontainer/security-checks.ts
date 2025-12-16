/**
 * Security checks for devcontainer configuration.
 *
 * These checks align with the devcontainer-sandboxing skill's audit checklist.
 */

import type { DevcontainerConfig, SecurityCheck } from './types.js';

/**
 * Check that remoteUser is non-root.
 */
function checkNonRootUser(config: DevcontainerConfig): SecurityCheck {
  const user = config.remoteUser ?? config.containerUser;

  if (!user) {
    return {
      name: 'non-root-user',
      passed: false,
      severity: 'warning',
      message: 'No remoteUser or containerUser specified (defaults to root)',
    };
  }

  if (user === 'root') {
    return {
      name: 'non-root-user',
      passed: false,
      severity: 'error',
      message: 'Container runs as root user',
    };
  }

  return {
    name: 'non-root-user',
    passed: true,
    severity: 'error',
    message: `Container runs as non-root user: ${user}`,
  };
}

/**
 * Check for privileged mode.
 */
function checkNoPrivileged(config: DevcontainerConfig): SecurityCheck {
  // Check explicit privileged flag
  if (config.privileged === true) {
    return {
      name: 'no-privileged',
      passed: false,
      severity: 'error',
      message: 'Container runs in privileged mode (full host access)',
    };
  }

  // Check runArgs for --privileged
  const hasPrivilegedArg = config.runArgs?.some(
    (arg) => arg === '--privileged' || arg.startsWith('--privileged=')
  );

  if (hasPrivilegedArg) {
    return {
      name: 'no-privileged',
      passed: false,
      severity: 'error',
      message: 'Container runs with --privileged flag',
    };
  }

  return {
    name: 'no-privileged',
    passed: true,
    severity: 'error',
    message: 'Container does not use privileged mode',
  };
}

/**
 * Check for Docker socket mount.
 */
function checkNoDockerSocket(config: DevcontainerConfig): SecurityCheck {
  const dockerSocketPatterns = ['/var/run/docker.sock', 'docker.sock'];

  // Check mounts array
  const hasMountedSocket = config.mounts?.some((mount) =>
    dockerSocketPatterns.some((pattern) => mount.includes(pattern))
  );

  // Check runArgs for -v mounts (handles both `-v path` and `-v=path` formats)
  // Also check all args since `-v` and the path might be separate array elements
  const hasVolumeSocket = config.runArgs?.some((arg) =>
    dockerSocketPatterns.some((pattern) => arg.includes(pattern))
  );

  if (hasMountedSocket || hasVolumeSocket) {
    return {
      name: 'no-docker-socket',
      passed: false,
      severity: 'error',
      message: 'Docker socket is mounted (root-equivalent host access)',
    };
  }

  return {
    name: 'no-docker-socket',
    passed: true,
    severity: 'error',
    message: 'Docker socket is not mounted',
  };
}

/**
 * Check for security hardening options.
 */
function checkSecurityHardening(config: DevcontainerConfig): SecurityCheck {
  const hasCapDrop = config.runArgs?.some(
    (arg) => arg.startsWith('--cap-drop') || arg === '--cap-drop=ALL'
  );

  const hasNoNewPrivs = config.runArgs?.some(
    (arg) => arg.includes('no-new-privileges') || config.securityOpt?.includes('no-new-privileges')
  );

  if (!(hasCapDrop || hasNoNewPrivs)) {
    return {
      name: 'security-hardening',
      passed: false,
      severity: 'warning',
      message: 'No security hardening (consider --cap-drop=ALL, --security-opt=no-new-privileges)',
    };
  }

  const applied: string[] = [];
  if (hasCapDrop) applied.push('cap-drop');
  if (hasNoNewPrivs) applied.push('no-new-privileges');

  return {
    name: 'security-hardening',
    passed: true,
    severity: 'warning',
    message: `Security hardening applied: ${applied.join(', ')}`,
  };
}

/**
 * Check for dangerous capability additions.
 */
function checkNoSensitiveCaps(config: DevcontainerConfig): SecurityCheck {
  const sensitiveCaps = ['SYS_ADMIN', 'SYS_PTRACE', 'NET_ADMIN', 'ALL'];

  // Check capAdd
  const addedSensitive = config.capAdd?.filter((cap) => sensitiveCaps.includes(cap)) ?? [];

  // Check runArgs for --cap-add
  const runArgCaps =
    config.runArgs
      ?.filter((arg) => arg.startsWith('--cap-add'))
      .flatMap((arg) => {
        const value = arg.split('=')[1] ?? '';
        return value.split(',');
      })
      .filter((cap) => sensitiveCaps.includes(cap)) ?? [];

  const allSensitive = [...addedSensitive, ...runArgCaps];

  if (allSensitive.length > 0) {
    return {
      name: 'no-sensitive-caps',
      passed: false,
      severity: 'error',
      message: `Sensitive capabilities added: ${allSensitive.join(', ')}`,
    };
  }

  return {
    name: 'no-sensitive-caps',
    passed: true,
    severity: 'error',
    message: 'No sensitive capabilities added',
  };
}

/**
 * Run all security checks on a devcontainer config.
 */
export function runSecurityChecks(config: DevcontainerConfig): SecurityCheck[] {
  return [
    checkNonRootUser(config),
    checkNoPrivileged(config),
    checkNoDockerSocket(config),
    checkSecurityHardening(config),
    checkNoSensitiveCaps(config),
  ];
}
