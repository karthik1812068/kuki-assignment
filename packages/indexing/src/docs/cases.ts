export interface EvalCase {
  id: string;
  question: string;
  expectedAnswerIncludes: string[];
  expectedFiles: string[];
  calculated: boolean;
  missing: boolean;
  conflict: boolean;
  notes: string;
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: 'adani_amount_roles',
    question:
      'On the Adani electricity bill, what is the current month bill amount versus the total amount payable, and what is payable after the due date?',
    expectedAnswerIncludes: ['4200', '5100', '5355'],
    expectedFiles: ['adani-electricity-bill.csv'],
    calculated: false,
    missing: false,
    conflict: false,
    notes: 'Current month, total payable, and after-due amounts are different roles.',
  },
  {
    id: 'bills_consumption_period',
    question: 'What electricity consumption does each bill report, and for which period?',
    expectedAnswerIncludes: ['140', 'FY 2024-25'],
    expectedFiles: ['adani-electricity-bill.csv'],
    calculated: false,
    missing: false,
    conflict: false,
    notes: 'Each bill row keeps its own period.',
  },
  {
    id: 'form3_date_inconsistency',
    question: 'Is there a date inconsistency on the hazardous waste Form 37?',
    expectedAnswerIncludes: ['yes'],
    expectedFiles: ['form37-hazardous-waste.csv'],
    calculated: false,
    missing: false,
    conflict: true,
    notes: 'Dispatch 2024-04-01 is before generation 2024-04-10.',
  },
  {
    id: 'fy_2024_25_electricity',
    question:
      'For Indian financial year 2024-25, what electricity consumption is evidenced and how complete is the coverage?',
    expectedAnswerIncludes: ['140', 'complete'],
    expectedFiles: ['adani-electricity-bill.csv'],
    calculated: false,
    missing: false,
    conflict: false,
    notes: 'FY 2024-25 is the year ending 31 March 2025.',
  },
  {
    id: 'fy_2025_26_coverage',
    question: 'For Indian FY 2025-26, what evidence exists and how complete is the coverage?',
    expectedAnswerIncludes: ['incomplete'],
    expectedFiles: [],
    calculated: false,
    missing: true,
    conflict: false,
    notes: 'No FY 2025-26 electricity is on file.',
  },
  {
    id: 'missing_diesel',
    question: 'What diesel fuel consumption is recorded in these documents?',
    expectedAnswerIncludes: ['do not contain'],
    expectedFiles: [],
    calculated: false,
    missing: true,
    conflict: false,
    notes: 'Missing diesel must not borrow an electricity number.',
  },
  {
    id: 'org_mismatch',
    question: 'Can we report a single company-wide electricity total from these documents?',
    expectedAnswerIncludes: ['no'],
    expectedFiles: ['adani-electricity-bill.csv', 'torrent-electricity-bill.csv'],
    calculated: false,
    missing: false,
    conflict: true,
    notes: 'Adani Electricity and Torrent Power are different companies.',
  },
  {
    id: 'policy_complaint_deadline',
    question: 'Does the quality policy specify a deadline for resolving customer complaints?',
    expectedAnswerIncludes: ['30'],
    expectedFiles: ['quality-policy.txt'],
    calculated: false,
    missing: false,
    conflict: false,
    notes: 'Deadline is 30 days in the policy text.',
  },
  {
    id: 'water_vs_meter',
    question: 'Does the water consumption match the meter readings for FY 2023-24?',
    expectedAnswerIncludes: ['no'],
    expectedFiles: ['water-bill.csv', 'meter-readings.csv'],
    calculated: false,
    missing: false,
    conflict: true,
    notes: 'Bill 100 kl vs meter 80 kl.',
  },
  {
    id: 'waste_total',
    question: 'What total waste quantity is recorded for FY 2023-24?',
    expectedAnswerIncludes: ['20'],
    expectedFiles: ['waste-log.csv'],
    calculated: true,
    missing: false,
    conflict: false,
    notes: '12 kg + 8 kg is calculated.',
  },
  {
    id: 'workbook_agree',
    question: 'Do the workbook monthly values and annual summaries agree for FY 2023-24?',
    expectedAnswerIncludes: ['yes'],
    expectedFiles: ['monthly-workbook.csv'],
    calculated: true,
    missing: false,
    conflict: false,
    notes: '10+20+30 equals 60.',
  },
  {
    id: 'missing_gas',
    question: 'What gas consumption is reported for FY 2023-24?',
    expectedAnswerIncludes: ['do not contain'],
    expectedFiles: [],
    calculated: false,
    missing: true,
    conflict: false,
    notes: 'Gas is not in these files.',
  },
];
