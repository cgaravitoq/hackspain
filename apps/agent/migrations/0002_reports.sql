CREATE TABLE reports (
  company_id TEXT NOT NULL,
  month TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('tesorero', 'financiero', 'ventas')),
  rule_version TEXT NOT NULL,
  body TEXT NOT NULL,
  pdf BLOB,
  created_at TEXT NOT NULL,
  PRIMARY KEY (company_id, month, role, rule_version)
);
