-- 020: lifecycle triggers (Person A)
-- Custom error codes (the API maps these to HTTP 409):
--   PT001 illegal status / transition     PT002 vaccination gate
--   PT003 foster capacity exceeded        PT004 invalid foster account/profile
--   PT005 record not found                PT006 placement not active

-- ---------- allowed transitions (data-driven) ----------
CREATE TABLE pet_status_transitions (
  from_status pet_status NOT NULL,
  to_status   pet_status NOT NULL,
  PRIMARY KEY (from_status, to_status)
);

INSERT INTO pet_status_transitions VALUES
  ('intake','medical_hold'), ('intake','available'),
  ('medical_hold','available'),
  ('available','in_foster'), ('available','adoption_pending'),
  ('in_foster','available'), ('in_foster','adoption_pending'),
  ('adoption_pending','adopted'), ('adoption_pending','available'),
  ('adopted','follow_up'), ('adopted','returned'),
  ('follow_up','closed'), ('follow_up','returned'),
  ('returned','medical_hold'), ('returned','available');

-- ---------- 1. transition validation ----------
CREATE OR REPLACE FUNCTION fn_pets_validate_status() RETURNS trigger AS $$
BEGIN
  IF fn_is_seed_mode() THEN RETURN NEW; END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'intake' THEN
      RAISE EXCEPTION 'New pets must start in intake (got %)', NEW.status
        USING ERRCODE = 'PT001';
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT EXISTS (SELECT 1 FROM pet_status_transitions
                   WHERE from_status = OLD.status AND to_status = NEW.status) THEN
      RAISE EXCEPTION 'Illegal status transition: % -> %', OLD.status, NEW.status
        USING ERRCODE = 'PT001',
              HINT = 'See table pet_status_transitions for allowed moves';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pets_status_transition
  BEFORE INSERT OR UPDATE OF status ON pets
  FOR EACH ROW EXECUTE FUNCTION fn_pets_validate_status();

-- ---------- 2. vaccination gate ----------
CREATE OR REPLACE FUNCTION fn_pets_vaccination_gate() RETURNS trigger AS $$
DECLARE missing text;
BEGIN
  IF fn_is_seed_mode() THEN RETURN NEW; END IF;

  IF NEW.status = 'available'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    SELECT string_agg(rv.vaccine_name, ', ') INTO missing
    FROM required_vaccines rv
    WHERE rv.species = NEW.species
      AND NOT EXISTS (
        SELECT 1 FROM vaccinations v
        WHERE v.pet_id = NEW.id
          AND v.vaccine_name = rv.vaccine_name
          AND v.expires_on >= CURRENT_DATE);
    IF missing IS NOT NULL THEN
      RAISE EXCEPTION 'Cannot mark pet available: missing or expired vaccinations: %', missing
        USING ERRCODE = 'PT002';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pets_status_gate
  BEFORE INSERT OR UPDATE OF status ON pets
  FOR EACH ROW EXECUTE FUNCTION fn_pets_vaccination_gate();

-- ---------- 3. status history ----------
CREATE OR REPLACE FUNCTION fn_pets_log_status() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO pet_status_history (pet_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, NULL, NEW.status, fn_current_actor(), 'Pet record created');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO pet_status_history (pet_id, from_status, to_status, changed_by, note)
    VALUES (NEW.id, OLD.status, NEW.status, fn_current_actor(),
            NULLIF(current_setting('app.status_note', true), ''));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pets_status_history
  AFTER INSERT OR UPDATE OF status ON pets
  FOR EACH ROW EXECUTE FUNCTION fn_pets_log_status();

-- ---------- 4. generic audit trigger ----------
CREATE OR REPLACE FUNCTION fn_audit_row() RETURNS trigger AS $$
DECLARE
  v_old jsonb;
  v_new jsonb;
  v_act audit_action;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW) - 'password_hash' - 'search_vector';
    INSERT INTO audit_log (table_name, record_id, action, new_data, actor_user_id)
    VALUES (TG_TABLE_NAME, v_new->>'id', 'INSERT', v_new, fn_current_actor());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_old := to_jsonb(OLD) - 'password_hash' - 'search_vector';
    v_new := to_jsonb(NEW) - 'password_hash' - 'search_vector';
    IF v_old = v_new THEN RETURN NEW; END IF;
    v_act := (CASE WHEN v_old->>'status' IS DISTINCT FROM v_new->>'status'
                   THEN 'STATUS_CHANGE' ELSE 'UPDATE' END)::audit_action;
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, actor_user_id)
    VALUES (TG_TABLE_NAME, v_new->>'id', v_act, v_old, v_new, fn_current_actor());
    RETURN NEW;
  ELSE
    v_old := to_jsonb(OLD) - 'password_hash' - 'search_vector';
    INSERT INTO audit_log (table_name, record_id, action, old_data, actor_user_id)
    VALUES (TG_TABLE_NAME, v_old->>'id', 'DELETE', v_old, fn_current_actor());
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_pets AFTER INSERT OR UPDATE OR DELETE ON pets
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row();
CREATE TRIGGER trg_audit_users AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row();
CREATE TRIGGER trg_audit_foster_placements AFTER INSERT OR UPDATE OR DELETE ON foster_placements
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row();
CREATE TRIGGER trg_audit_medical_records AFTER INSERT OR UPDATE OR DELETE ON medical_records
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row();
CREATE TRIGGER trg_audit_vaccinations AFTER INSERT OR UPDATE OR DELETE ON vaccinations
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row();
CREATE TRIGGER trg_audit_foster_profiles AFTER INSERT OR UPDATE OR DELETE ON foster_profiles
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

-- ---------- 5. foster capacity ----------
CREATE OR REPLACE FUNCTION fn_placements_capacity() RETURNS trigger AS $$
DECLARE cap int; cur int;
BEGIN
  IF NEW.status = 'active' THEN
    SELECT max_capacity INTO cap FROM foster_profiles WHERE user_id = NEW.foster_user_id;
    IF cap IS NULL THEN
      RAISE EXCEPTION 'User % has no foster profile', NEW.foster_user_id
        USING ERRCODE = 'PT004';
    END IF;
    SELECT count(*) INTO cur FROM foster_placements
    WHERE foster_user_id = NEW.foster_user_id
      AND status = 'active'
      AND id IS DISTINCT FROM NEW.id;
    IF cur >= cap THEN
      RAISE EXCEPTION 'Foster capacity exceeded (% of % slots in use)', cur, cap
        USING ERRCODE = 'PT003';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_placements_capacity
  BEFORE INSERT OR UPDATE OF status, foster_user_id ON foster_placements
  FOR EACH ROW EXECUTE FUNCTION fn_placements_capacity();
