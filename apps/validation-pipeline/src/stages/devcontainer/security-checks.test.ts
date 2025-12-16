/**
 * Tests for devcontainer security checks.
 */

import { describe, expect, it } from 'vitest';

import { runSecurityChecks } from './security-checks.js';
import type { DevcontainerConfig } from './types.js';

describe('devcontainer security checks', () => {
  describe('non-root user check', () => {
    it('passes when remoteUser is non-root', () => {
      const config: DevcontainerConfig = { remoteUser: 'developer' };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'non-root-user');
      expect(check?.passed).toBe(true);
    });

    it('fails when remoteUser is root', () => {
      const config: DevcontainerConfig = { remoteUser: 'root' };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'non-root-user');
      expect(check?.passed).toBe(false);
      expect(check?.severity).toBe('error');
    });

    it('warns when no user specified', () => {
      const config: DevcontainerConfig = {};
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'non-root-user');
      expect(check?.passed).toBe(false);
      expect(check?.severity).toBe('warning');
    });
  });

  describe('privileged mode check', () => {
    it('passes when not privileged', () => {
      const config: DevcontainerConfig = { privileged: false };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-privileged');
      expect(check?.passed).toBe(true);
    });

    it('fails when privileged: true', () => {
      const config: DevcontainerConfig = { privileged: true };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-privileged');
      expect(check?.passed).toBe(false);
    });

    it('fails when --privileged in runArgs', () => {
      const config: DevcontainerConfig = { runArgs: ['--privileged'] };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-privileged');
      expect(check?.passed).toBe(false);
    });
  });

  describe('docker socket check', () => {
    it('passes when no docker socket mounted', () => {
      const config: DevcontainerConfig = { mounts: [] };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-docker-socket');
      expect(check?.passed).toBe(true);
    });

    it('fails when docker socket in mounts', () => {
      const config: DevcontainerConfig = {
        mounts: ['source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind'],
      };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-docker-socket');
      expect(check?.passed).toBe(false);
    });

    it('fails when docker socket in runArgs -v', () => {
      const config: DevcontainerConfig = {
        runArgs: ['-v', '/var/run/docker.sock:/var/run/docker.sock'],
      };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-docker-socket');
      expect(check?.passed).toBe(false);
    });
  });

  describe('security hardening check', () => {
    it('passes when cap-drop is present', () => {
      const config: DevcontainerConfig = {
        runArgs: ['--cap-drop=ALL'],
      };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'security-hardening');
      expect(check?.passed).toBe(true);
    });

    it('passes when no-new-privileges is present', () => {
      const config: DevcontainerConfig = {
        runArgs: ['--security-opt=no-new-privileges:true'],
      };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'security-hardening');
      expect(check?.passed).toBe(true);
    });

    it('warns when no hardening options', () => {
      const config: DevcontainerConfig = { runArgs: [] };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'security-hardening');
      expect(check?.passed).toBe(false);
      expect(check?.severity).toBe('warning');
    });
  });

  describe('sensitive capabilities check', () => {
    it('passes when no sensitive caps added', () => {
      const config: DevcontainerConfig = { capAdd: [] };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-sensitive-caps');
      expect(check?.passed).toBe(true);
    });

    it('fails when SYS_ADMIN capability added', () => {
      const config: DevcontainerConfig = { capAdd: ['SYS_ADMIN'] };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-sensitive-caps');
      expect(check?.passed).toBe(false);
    });

    it('fails when --cap-add=SYS_PTRACE in runArgs', () => {
      const config: DevcontainerConfig = {
        runArgs: ['--cap-add=SYS_PTRACE'],
      };
      const results = runSecurityChecks(config);
      const check = results.find((r) => r.name === 'no-sensitive-caps');
      expect(check?.passed).toBe(false);
    });
  });

  describe('secure config scenario', () => {
    it('passes all checks for properly hardened config', () => {
      const config: DevcontainerConfig = {
        name: 'secure-dev',
        remoteUser: 'developer',
        runArgs: [
          '--cap-drop=ALL',
          '--security-opt=no-new-privileges:true',
          '--memory=2g',
          '--cpus=2',
        ],
      };

      const results = runSecurityChecks(config);
      const errors = results.filter((r) => !r.passed && r.severity === 'error');

      expect(errors).toHaveLength(0);
    });
  });

  describe('insecure config scenario', () => {
    it('fails multiple checks for insecure config', () => {
      const config: DevcontainerConfig = {
        remoteUser: 'root',
        privileged: true,
        mounts: ['source=/var/run/docker.sock,target=/var/run/docker.sock,type=bind'],
        capAdd: ['SYS_ADMIN'],
      };

      const results = runSecurityChecks(config);
      const errors = results.filter((r) => !r.passed && r.severity === 'error');

      // Should fail: non-root, privileged, docker socket, sensitive caps
      expect(errors.length).toBeGreaterThanOrEqual(4);
    });
  });
});
