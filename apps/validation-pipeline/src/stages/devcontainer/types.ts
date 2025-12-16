/**
 * Types for devcontainer validation stage.
 */

/**
 * A security check result.
 */
export interface SecurityCheck {
  name: string;
  passed: boolean;
  severity: 'error' | 'warning';
  message: string;
}

/**
 * Parsed devcontainer configuration (subset we care about for security).
 */
export interface DevcontainerConfig {
  name?: string;
  remoteUser?: string;
  containerUser?: string;
  runArgs?: string[];
  mounts?: string[];
  privileged?: boolean;
  capAdd?: string[];
  securityOpt?: string[];
}

/**
 * Result of parsing a JSONC file.
 */
export interface JsoncParseResult {
  success: boolean;
  data?: DevcontainerConfig;
  error?: string;
}
