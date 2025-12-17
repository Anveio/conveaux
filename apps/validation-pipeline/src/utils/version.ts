/**
 * Utility for parsing and comparing version strings.
 */

export interface Version {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a version string (e.g., "v22.3.0" or "22.3.0") into components.
 *
 * @param versionString - The version string to parse
 * @returns Parsed version or null if invalid
 */
export function parseVersion(versionString: string): Version | null {
  // Remove leading 'v' if present
  const normalized = versionString.replace(/^v/, '').trim();
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)/);

  if (!match) {
    return null;
  }

  const [, major, minor, patch] = match;
  if (!major || !minor || !patch) {
    return null;
  }
  return {
    major: Number.parseInt(major, 10),
    minor: Number.parseInt(minor, 10),
    patch: Number.parseInt(patch, 10),
  };
}

/**
 * Check if a version meets the minimum required version.
 *
 * @param actual - The actual version to check
 * @param minimum - The minimum required version
 * @returns True if actual >= minimum
 */
export function meetsMinimum(actual: Version, minimum: Version): boolean {
  if (actual.major !== minimum.major) {
    return actual.major > minimum.major;
  }
  if (actual.minor !== minimum.minor) {
    return actual.minor > minimum.minor;
  }
  return actual.patch >= minimum.patch;
}
