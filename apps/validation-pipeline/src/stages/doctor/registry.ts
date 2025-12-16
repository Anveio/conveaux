/**
 * Doctor step registry - ordered list of doctor steps to execute.
 *
 * Add new doctor steps to this array to include them in the doctor stage.
 * Steps are executed sequentially in the order they appear.
 */

import type { DoctorStep } from './types.js';

/**
 * Registered doctor steps in execution order.
 */
export const doctorSteps: readonly DoctorStep[] = [
  // Future steps can be added here:
  // sortImportsStep,
  // updateDependenciesStep,
  // securityAuditStep,
];
