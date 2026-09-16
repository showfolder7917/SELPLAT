CREATE TABLE AiDesktopCorpusIngestionJob (
  jobId TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('running', 'stopped', 'completed', 'failed')),
  message TEXT NOT NULL,
  lastSucceededAt TEXT NULL,
  retryable INTEGER NOT NULL CHECK (retryable IN (0, 1)),
  updatedAt TEXT NOT NULL
);
