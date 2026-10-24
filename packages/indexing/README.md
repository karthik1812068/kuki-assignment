# `@codepilot/indexing`

Two jobs in this package:

1. Index a cloned repo (chunk, local hash embed, pgvector, rank).
2. Extract facts from uploaded documents and answer questions with citations.

Repo search never calls a hosted embedding API.

## Files

```
src/index.ts             public exports
src/build.ts             walk clone → chunks → embeddings
src/chunk.ts             symbols first, then line windows
src/detect.ts            language / package manager
src/limits.ts            file + chunk caps
src/periods.ts           Indian FY parsing
src/rank.ts              keyword / symbol / period rerank
src/symbols.ts           line scanner
src/extract-document.ts  csv / txt / pdf / xlsx
src/docs/                Q&A used by Documents + Evaluation
  index.ts               re-exports
  answer.ts              baseline vs improved
  handlers.ts            bill roles, dates, coverage, totals
  facts.ts               flatten extract rows
  cases.ts               the 12 eval questions
  suite.ts               scoring
```
