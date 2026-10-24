export interface EvaluationCaseRow {
  id: string;
  question: string;
  notes: string;
  baselinePass: boolean;
  improvedPass: boolean;
  baselineScore: number;
  improvedScore: number;
  delta: number;
}

export interface EvaluationReport {
  command: string;
  cases: number;
  baselinePassed: number;
  improvedPassed: number;
  baselinePassRate: number;
  improvedPassRate: number;
  baselineAvg: number;
  improvedAvg: number;
  weakness: string;
  improvement: string;
  unresolved: string;
  details: EvaluationCaseRow[];
}
