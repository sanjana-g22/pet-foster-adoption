-- EXPLAIN ANALYZE evidence (Person A). Take screenshots of BEFORE and AFTER.
-- Run these AFTER seeding ~100+ pets. On tiny tables Postgres may prefer a
-- sequential scan; if the plan does not change, add rows in a Neon BRANCH first:
--   INSERT INTO pets (name, species, age_months, size, weight_kg, status)
--   SELECT 'bulk'||g, 'dog', 24, 'medium', 10, 'adopted' FROM generate_series(1,20000) g;
--   (this needs: SET app.seed_mode = 'on';  in the same session)
-- Never do the bulk insert on the shared production branch.

-- ===== Query 1: public browse (partial index idx_pets_available_partial) =====
EXPLAIN ANALYZE
SELECT id, name FROM pets
WHERE status = 'available' AND species = 'dog' AND size = 'medium';

-- BEFORE: drop the index inside a transaction, explain, then roll back (safe).
BEGIN;
DROP INDEX idx_pets_available_partial;
DROP INDEX idx_pets_species_size_status;
DROP INDEX idx_pets_status;
EXPLAIN ANALYZE
SELECT id, name FROM pets
WHERE status = 'available' AND species = 'dog' AND size = 'medium';
ROLLBACK;

-- ===== Query 2: full-text search (GIN index idx_pets_search_vector) =====
EXPLAIN ANALYZE
SELECT id, name, ts_rank(search_vector, q) AS rank
FROM pets, plainto_tsquery('english', 'gentle dog kids') q
WHERE search_vector @@ q
ORDER BY rank DESC LIMIT 10;

BEGIN;
DROP INDEX idx_pets_search_vector;
EXPLAIN ANALYZE
SELECT id, name, ts_rank(search_vector, q) AS rank
FROM pets, plainto_tsquery('english', 'gentle dog kids') q
WHERE search_vector @@ q
ORDER BY rank DESC LIMIT 10;
ROLLBACK;

-- ===== Query 3: vaccination lookups (idx_vacc_pet_vaccine_expiry) =====
EXPLAIN ANALYZE
SELECT * FROM v_overdue_vaccinations;

BEGIN;
DROP INDEX idx_vacc_pet_vaccine_expiry;
EXPLAIN ANALYZE
SELECT * FROM v_overdue_vaccinations;
ROLLBACK;
