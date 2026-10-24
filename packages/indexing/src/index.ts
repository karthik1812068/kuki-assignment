export { buildRepositoryIndex, IndexError } from './build';
export type { IndexBuild, IndexedChunk, IndexedFile } from './build';
export { chunkSource } from './chunk';
export type { ChunkDraft, SourceFile } from './chunk';
export { detectProject } from './detect';
export type { IndexDetection } from './detect';
export { INDEX_LIMITS } from './limits';
export { parseFinancialPeriod, periodMatchScore } from './periods';
export type { FinancialPeriod } from './periods';
export { rankChunks } from './rank';
export type { RankCandidate } from './rank';
export { extractSymbols } from './symbols';
export { classifyKind, extractDocument } from './extract-document';
export type { DocumentExtraction, DocumentKind, ExtractedFact } from './extract-document';
export {
  answerQuestion,
  barRaiserReport,
  compactBarRaiser,
  EVAL_CASES,
  loadFixtureDocuments,
} from './docs';
export type { AnswerMode, EvalCase, EvalReport, GroundedAnswer } from './docs';
