CREATE TABLE companies (
  company_id TEXT PRIMARY KEY,
  group_id TEXT,
  scorable INTEGER NOT NULL,
  month TEXT,
  score REAL,
  state TEXT NOT NULL,
  summary TEXT NOT NULL,
  detail TEXT NOT NULL
);
CREATE INDEX companies_group_id ON companies (group_id);
CREATE INDEX companies_state ON companies (state);

CREATE TABLE alerts (
  position INTEGER PRIMARY KEY,
  company_id TEXT NOT NULL,
  group_id TEXT,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE groups (
  group_id TEXT PRIMARY KEY,
  tension INTEGER NOT NULL,
  payload TEXT NOT NULL
);

CREATE TABLE documents (
  name TEXT PRIMARY KEY,
  payload TEXT NOT NULL
);
