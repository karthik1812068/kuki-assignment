export type AnswerMode = 'baseline' | 'improved';

export interface Evidence {
  filename: string;
  locator: string;
  value: string;
}

export interface GroundedAnswer {
  answer: string;
  confidence: 'high' | 'low' | 'none';
  evidence: Evidence[];
  calculated: boolean;
  missing: boolean;
  conflict: boolean;
}
