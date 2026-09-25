export type RepairDecision = 'pass' | 'continue' | 'stop';

export function repairDecision(input: {
  failed: boolean;
  repairCount: number;
  repairLimit: number;
  failureHash: string;
  previousHash: string | null;
  modelConfigured: boolean;
  securityViolation: boolean;
  cancelled: boolean;
}): RepairDecision {
  if (input.cancelled || input.securityViolation) {
    return 'stop';
  }
  if (!input.failed) {
    return 'pass';
  }
  if (!input.modelConfigured || input.repairCount >= input.repairLimit) {
    return 'stop';
  }
  if (input.previousHash !== null && input.previousHash === input.failureHash) {
    return 'stop';
  }
  return 'continue';
}
