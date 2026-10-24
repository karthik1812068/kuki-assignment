# Evaluation

In the app: Evaluation → Run baseline → Run improved.

Questions are in `packages/indexing/src/docs/cases.ts`. Answers come from `answer.ts` against the CSVs in `fixtures/`. If you have your own PDFs, upload them on Documents instead of expecting them in git.

```bash
npm test
```

`bar-raiser.json` is the last saved run. `GET /evaluation` computes the same thing from the fixtures.
