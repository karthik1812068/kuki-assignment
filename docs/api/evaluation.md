# Evaluation

`GET /evaluation`

Runs the questions in `packages/indexing/src/docs/cases.ts` on `docs/evaluation/fixtures`.

Scoring is 0.5 for the answer text, 0.3 for cited files, 0.2 for the calculated / missing / conflict flags. 0.7 is a pass.

The Evaluation page just renders this payload.
