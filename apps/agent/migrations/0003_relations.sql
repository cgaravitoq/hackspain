CREATE TABLE relations (
  position INTEGER NOT NULL,
  source TEXT NOT NULL,
  target TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  scope TEXT NOT NULL,
  confidence TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX relations_source ON relations (source);
CREATE INDEX relations_target ON relations (target);

CREATE TABLE relation_nodes (
  company_id TEXT PRIMARY KEY,
  group_id TEXT,
  degree INTEGER NOT NULL,
  role TEXT NOT NULL,
  payload TEXT NOT NULL
);
CREATE INDEX relation_nodes_group_id ON relation_nodes (group_id);
