-- 050: ALTER pets to add full-text search (also your deliberate ALTER demo)

ALTER TABLE pets ADD COLUMN search_vector tsvector;

CREATE OR REPLACE FUNCTION fn_pets_update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.breed, '') || ' ' || NEW.species::text), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.temperament, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pets_search_vector
  BEFORE INSERT OR UPDATE OF name, breed, species, temperament, description ON pets
  FOR EACH ROW EXECUTE FUNCTION fn_pets_update_search_vector();

-- Backfill existing rows (fires the trigger)
UPDATE pets SET name = name;

CREATE INDEX idx_pets_search_vector ON pets USING GIN (search_vector);
