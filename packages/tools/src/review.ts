import type { ReviewFinding } from './proposal';

const RULES: ReadonlyArray<{
  pattern: RegExp;
  severity: ReviewFinding['severity'];
  problem: string;
  explanation: string;
  recommendation: string;
}> = [
  {
    pattern: /\beval\s*\(/u,
    severity: 'high',
    problem: 'eval call',
    explanation: 'eval executes a string as code.',
    recommendation: 'Remove eval and call a fixed function.',
  },
  {
    pattern: /child_process\.(?:exec|execSync)\s*\(/u,
    severity: 'high',
    problem: 'shell execution',
    explanation: 'exec runs a shell command.',
    recommendation: 'Use a fixed argument list without a shell.',
  },
  {
    pattern: /\binnerHTML\b/u,
    severity: 'medium',
    problem: 'HTML injection sink',
    explanation: 'innerHTML can insert untrusted markup.',
    recommendation: 'Insert text instead of HTML.',
  },
  {
    pattern: /BEGIN (?:RSA |OPENSSH )?PRIVATE KEY/u,
    severity: 'high',
    problem: 'private key material',
    explanation: 'A private key is present in a source file.',
    recommendation: 'Remove the key from the repository.',
  },
  {
    pattern: /169\.254\.169\.254/u,
    severity: 'high',
    problem: 'metadata address',
    explanation: 'This address is used to reach cloud instance metadata.',
    recommendation: 'Remove the address.',
  },
];

export function scanSource(
  files: ReadonlyArray<{ path: string; content: string }>,
): ReviewFinding[] {
  const findings: ReviewFinding[] = [];
  for (const file of files) {
    const lines = file.content.split('\n');
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index] ?? '';
      for (const rule of RULES) {
        if (!rule.pattern.test(line)) {
          continue;
        }
        findings.push({
          severity: rule.severity,
          path: file.path,
          line: index + 1,
          problem: rule.problem,
          explanation: rule.explanation,
          recommendation: rule.recommendation,
          source: 'static',
        });
        if (findings.length >= 50) {
          return findings;
        }
      }
    }
  }
  return findings;
}
