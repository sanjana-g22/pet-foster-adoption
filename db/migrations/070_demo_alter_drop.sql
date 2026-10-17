-- 070: deliberate ALTER / DROP demo (Person A)

-- ALTER an existing table with a new rule
ALTER TABLE foster_profiles
  ADD CONSTRAINT chk_fp_capacity_max CHECK (max_capacity <= 20);

-- DROP demo: create and drop a throwaway index and table
CREATE INDEX idx_demo_temp ON pets(name);
DROP INDEX idx_demo_temp;

CREATE TABLE demo_scratch (id int PRIMARY KEY, note text);
ALTER TABLE demo_scratch ADD COLUMN created_at timestamptz DEFAULT now();
DROP TABLE demo_scratch;
