-- Lifecycle / integrity tests (Person A)
-- Runs inside a transaction and ROLLS BACK, so it leaves no data behind.
-- Paste the whole file into the Neon SQL Editor and run it. Last query shows PASS/FAIL.

BEGIN;

CREATE TEMP TABLE test_results (test text, result text);

-- helpers (temporary, vanish at rollback)
CREATE FUNCTION pg_temp.fn_new_pet(p_name text, p_species species_type DEFAULT 'dog')
RETURNS int AS $$
DECLARE pid int;
BEGIN
  INSERT INTO pets (name, species, age_months, size, weight_kg)
  VALUES (p_name, p_species, 24, 'medium', 10) RETURNING id INTO pid;
  RETURN pid;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.fn_vaccinate(p_pet int) RETURNS void AS $$
BEGIN
  INSERT INTO vaccinations (pet_id, vaccine_name, vaccinated_on, expires_on)
  SELECT p_pet, rv.vaccine_name, CURRENT_DATE - 30, CURRENT_DATE + 335
  FROM required_vaccines rv JOIN pets ON pets.id = p_pet AND pets.species = rv.species;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.fn_new_user(p_email text, p_role text) RETURNS int AS $$
DECLARE uid int;
BEGIN
  INSERT INTO users (email, password_hash, full_name, role_id)
  VALUES (p_email, 'x', 'Test User', (SELECT id FROM roles WHERE name = p_role))
  RETURNING id INTO uid;
  RETURN uid;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.fn_new_foster(p_email text, p_cap int) RETURNS int AS $$
DECLARE uid int;
BEGIN
  uid := pg_temp.fn_new_user(p_email, 'foster');
  INSERT INTO foster_profiles (user_id, max_capacity) VALUES (uid, p_cap);
  RETURN uid;
END; $$ LANGUAGE plpgsql;

CREATE FUNCTION pg_temp.fn_make_available(p_pet int) RETURNS void AS $$
BEGIN
  PERFORM pg_temp.fn_vaccinate(p_pet);
  UPDATE pets SET status = 'available' WHERE id = p_pet;
END; $$ LANGUAGE plpgsql;

-- T1 illegal transition rejected
DO $$
DECLARE pid int;
BEGIN
  pid := pg_temp.fn_new_pet('TEST_t1');
  BEGIN
    UPDATE pets SET status = 'adopted' WHERE id = pid;
    INSERT INTO test_results VALUES ('T01 illegal transition rejected', 'FAIL - no error');
  EXCEPTION WHEN SQLSTATE 'PT001' THEN
    INSERT INTO test_results VALUES ('T01 illegal transition rejected', 'PASS');
  END;
END $$;

-- T2 valid transition succeeds and is logged
DO $$
DECLARE pid int; n int;
BEGIN
  pid := pg_temp.fn_new_pet('TEST_t2');
  UPDATE pets SET status = 'medical_hold' WHERE id = pid;
  SELECT count(*) INTO n FROM pet_status_history
  WHERE pet_id = pid AND (to_status = 'medical_hold' OR from_status IS NULL);
  INSERT INTO test_results VALUES ('T02 valid transition logged in history',
    CASE WHEN n = 2 THEN 'PASS' ELSE 'FAIL - history rows: ' || n END);
END $$;

-- T3 vaccination gate
DO $$
DECLARE pid int; st pet_status;
BEGIN
  pid := pg_temp.fn_new_pet('TEST_t3');
  BEGIN
    UPDATE pets SET status = 'available' WHERE id = pid;
    INSERT INTO test_results VALUES ('T03a unvaccinated pet blocked from Available', 'FAIL - no error');
  EXCEPTION WHEN SQLSTATE 'PT002' THEN
    INSERT INTO test_results VALUES ('T03a unvaccinated pet blocked from Available', 'PASS');
  END;
  PERFORM pg_temp.fn_vaccinate(pid);
  UPDATE pets SET status = 'available' WHERE id = pid;
  SELECT status INTO st FROM pets WHERE id = pid;
  INSERT INTO test_results VALUES ('T03b vaccinated pet can become Available',
    CASE WHEN st = 'available' THEN 'PASS' ELSE 'FAIL' END);
END $$;

-- T4 future vaccination date rejected
DO $$
DECLARE pid int;
BEGIN
  pid := pg_temp.fn_new_pet('TEST_t4');
  BEGIN
    INSERT INTO vaccinations (pet_id, vaccine_name, vaccinated_on, expires_on)
    VALUES (pid, 'Rabies', CURRENT_DATE + 5, CURRENT_DATE + 400);
    INSERT INTO test_results VALUES ('T04 future vaccination date rejected', 'FAIL - no error');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO test_results VALUES ('T04 future vaccination date rejected', 'PASS');
  END;
END $$;

-- T5 duplicate microchip rejected
DO $$
BEGIN
  INSERT INTO pets (name, species, age_months, size, weight_kg, microchip_no)
  VALUES ('TEST_t5a', 'cat', 12, 'small', 4, 'CHIP-TEST-1');
  BEGIN
    INSERT INTO pets (name, species, age_months, size, weight_kg, microchip_no)
    VALUES ('TEST_t5b', 'cat', 12, 'small', 4, 'CHIP-TEST-1');
    INSERT INTO test_results VALUES ('T05 duplicate microchip rejected', 'FAIL - no error');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO test_results VALUES ('T05 duplicate microchip rejected', 'PASS');
  END;
END $$;

-- T6 foster capacity enforced
DO $$
DECLARE f int; p1 int; p2 int;
BEGIN
  f := pg_temp.fn_new_foster('test_t6_foster@test.local', 1);
  p1 := pg_temp.fn_new_pet('TEST_t6a'); PERFORM pg_temp.fn_make_available(p1);
  p2 := pg_temp.fn_new_pet('TEST_t6b'); PERFORM pg_temp.fn_make_available(p2);
  PERFORM sp_place_in_foster(p1, f);
  BEGIN
    PERFORM sp_place_in_foster(p2, f);
    INSERT INTO test_results VALUES ('T06 foster over capacity rejected', 'FAIL - no error');
  EXCEPTION WHEN SQLSTATE 'PT003' THEN
    INSERT INTO test_results VALUES ('T06 foster over capacity rejected', 'PASS');
  END;
END $$;

-- T7 only one active placement per pet
DO $$
DECLARE fa int; fb int; p int;
BEGIN
  fa := pg_temp.fn_new_foster('test_t7_a@test.local', 5);
  fb := pg_temp.fn_new_foster('test_t7_b@test.local', 5);
  p := pg_temp.fn_new_pet('TEST_t7'); PERFORM pg_temp.fn_make_available(p);
  PERFORM sp_place_in_foster(p, fa);
  BEGIN
    INSERT INTO foster_placements (pet_id, foster_user_id) VALUES (p, fb);
    INSERT INTO test_results VALUES ('T07 second active placement rejected', 'FAIL - no error');
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO test_results VALUES ('T07 second active placement rejected', 'PASS');
  END;
END $$;

-- T8 placement end date before start date rejected
DO $$
DECLARE f int; p int;
BEGIN
  f := pg_temp.fn_new_foster('test_t8@test.local', 3);
  p := pg_temp.fn_new_pet('TEST_t8');
  BEGIN
    INSERT INTO foster_placements (pet_id, foster_user_id, start_date, end_date, status)
    VALUES (p, f, CURRENT_DATE, CURRENT_DATE - 5, 'completed');
    INSERT INTO test_results VALUES ('T08 end date before start date rejected', 'FAIL - no error');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO test_results VALUES ('T08 end date before start date rejected', 'PASS');
  END;
END $$;

-- T9 audit log records the actor
DO $$
DECLARE admin_id int; p int; n int;
BEGIN
  admin_id := pg_temp.fn_new_user('test_t9_admin@test.local', 'admin');
  p := pg_temp.fn_new_pet('TEST_t9');
  PERFORM set_config('app.current_user_id', admin_id::text, true);
  UPDATE pets SET description = 'audit check' WHERE id = p;
  SELECT count(*) INTO n FROM audit_log
  WHERE table_name = 'pets' AND record_id = p::text
    AND action = 'UPDATE' AND actor_user_id = admin_id;
  INSERT INTO test_results VALUES ('T09 audit log records actor and change',
    CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL - rows: ' || n END);
END $$;

-- T10 negative weight rejected
DO $$
BEGIN
  BEGIN
    INSERT INTO pets (name, species, age_months, size, weight_kg)
    VALUES ('TEST_t10', 'dog', 12, 'small', -5);
    INSERT INTO test_results VALUES ('T10 negative weight rejected', 'FAIL - no error');
  EXCEPTION WHEN check_violation THEN
    INSERT INTO test_results VALUES ('T10 negative weight rejected', 'PASS');
  END;
END $$;

-- T11 full-text search finds the pet
DO $$
DECLARE p int; n int;
BEGIN
  INSERT INTO pets (name, species, breed, age_months, size, weight_kg, description)
  VALUES ('TEST_t11', 'dog', 'Labrador', 30, 'large', 25, 'A gentle, calm companion who loves walks')
  RETURNING id INTO p;
  SELECT count(*) INTO n FROM pets
  WHERE search_vector @@ plainto_tsquery('english', 'gentle labrador') AND id = p;
  INSERT INTO test_results VALUES ('T11 full-text search finds pet',
    CASE WHEN n = 1 THEN 'PASS' ELSE 'FAIL' END);
END $$;

-- T12 ending a placement returns the pet to available
DO $$
DECLARE f int; p int; pl int; st pet_status;
BEGIN
  f := pg_temp.fn_new_foster('test_t12@test.local', 2);
  p := pg_temp.fn_new_pet('TEST_t12'); PERFORM pg_temp.fn_make_available(p);
  pl := sp_place_in_foster(p, f);
  PERFORM sp_end_placement(pl, 'foster_request');
  SELECT status INTO st FROM pets WHERE id = p;
  INSERT INTO test_results VALUES ('T12 ending placement returns pet to Available',
    CASE WHEN st = 'available' THEN 'PASS' ELSE 'FAIL - ' || st END);
END $$;

SELECT test, result FROM test_results ORDER BY test;

ROLLBACK;
