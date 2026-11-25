# Transcripts

Drop plain `.md` or `.txt` transcript files in this directory, then run:

```bash
pnpm --filter website topic-research extract:transcripts
pnpm --filter website topic-research collect:transcripts
```

Transcripts are treated as an editorial signal, not as market demand:

- `extract:transcripts` produces candidate phrases in `../transcripts-candidates.json` for manual review. Promoted phrases are added the next time `seed` runs.
- `collect:transcripts` counts seed keyword mentions for the backlog's `editorialMultiplier`.

Everything in this directory except this README is gitignored.
