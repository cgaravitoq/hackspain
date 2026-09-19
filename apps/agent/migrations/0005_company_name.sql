ALTER TABLE companies ADD COLUMN name TEXT NOT NULL DEFAULT '';
CREATE INDEX companies_name ON companies (name);
