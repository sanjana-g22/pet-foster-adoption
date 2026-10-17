-- 030: stored procedures / functions (Person A)
-- The API must call these instead of running raw UPDATEs on pets.status.

-- Generic, validated status change (staff manual changes)
CREATE OR REPLACE FUNCTION sp_change_pet_status(
  p_pet_id int, p_to pet_status, p_note text DEFAULT NULL, p_actor int DEFAULT NULL
) RETURNS void AS $$
BEGIN
  IF p_actor IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_actor::text, true);
  END IF;
  IF p_note IS NOT NULL THEN
    PERFORM set_config('app.status_note', p_note, true);
  END IF;

  PERFORM 1 FROM pets WHERE id = p_pet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pet % not found', p_pet_id USING ERRCODE = 'PT005';
  END IF;

  UPDATE pets SET status = p_to WHERE id = p_pet_id;  -- triggers validate the move
END;
$$ LANGUAGE plpgsql;

-- Place an available pet with a foster (locks foster + pet rows)
CREATE OR REPLACE FUNCTION sp_place_in_foster(
  p_pet_id int, p_foster_user_id int,
  p_expected_end date DEFAULT NULL, p_actor int DEFAULT NULL
) RETURNS int AS $$
DECLARE
  v_status pet_status;
  v_ok boolean;
  v_role text;
  v_pid int;
BEGIN
  IF p_actor IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_actor::text, true);
  END IF;

  -- Lock the foster profile first: serialises capacity checks for this foster
  PERFORM 1 FROM foster_profiles WHERE user_id = p_foster_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Foster profile not found for user %', p_foster_user_id
      USING ERRCODE = 'PT004';
  END IF;

  SELECT (u.is_active AND u.is_approved), r.name INTO v_ok, v_role
  FROM users u JOIN roles r ON r.id = u.role_id
  WHERE u.id = p_foster_user_id;
  IF v_role IS DISTINCT FROM 'foster' OR NOT COALESCE(v_ok, false) THEN
    RAISE EXCEPTION 'User % is not an active, approved foster', p_foster_user_id
      USING ERRCODE = 'PT004';
  END IF;

  SELECT status INTO v_status FROM pets WHERE id = p_pet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pet % not found', p_pet_id USING ERRCODE = 'PT005';
  END IF;
  IF v_status <> 'available' THEN
    RAISE EXCEPTION 'Pet must be available to place in foster (current: %)', v_status
      USING ERRCODE = 'PT001';
  END IF;

  INSERT INTO foster_placements (pet_id, foster_user_id, expected_end_date, created_by)
  VALUES (p_pet_id, p_foster_user_id, p_expected_end, p_actor)
  RETURNING id INTO v_pid;

  PERFORM set_config('app.status_note', 'Placed in foster (placement ' || v_pid || ')', true);
  UPDATE pets SET status = 'in_foster' WHERE id = p_pet_id;

  RETURN v_pid;
END;
$$ LANGUAGE plpgsql;

-- End a placement; pet goes back to available unless it was adopted
CREATE OR REPLACE FUNCTION sp_end_placement(
  p_placement_id int, p_reason placement_end_reason, p_actor int DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_pet int;
  v_status placement_status;
  v_pstatus pet_status;
BEGIN
  IF p_actor IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_actor::text, true);
  END IF;

  SELECT pet_id, status INTO v_pet, v_status
  FROM foster_placements WHERE id = p_placement_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Placement % not found', p_placement_id USING ERRCODE = 'PT005';
  END IF;
  IF v_status <> 'active' THEN
    RAISE EXCEPTION 'Placement % is not active', p_placement_id USING ERRCODE = 'PT006';
  END IF;

  SELECT status INTO v_pstatus FROM pets WHERE id = v_pet FOR UPDATE;

  UPDATE foster_placements
  SET status = 'completed', end_date = CURRENT_DATE, end_reason = p_reason
  WHERE id = p_placement_id;

  IF v_pstatus = 'in_foster' AND p_reason <> 'adopted' THEN
    PERFORM set_config('app.status_note', 'Foster placement ended: ' || p_reason, true);
    UPDATE pets SET status = 'available' WHERE id = v_pet;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Process an adoption return
CREATE OR REPLACE FUNCTION sp_process_return(
  p_pet_id int, p_reason text, p_actor int DEFAULT NULL
) RETURNS void AS $$
DECLARE v_status pet_status;
BEGIN
  IF p_actor IS NOT NULL THEN
    PERFORM set_config('app.current_user_id', p_actor::text, true);
  END IF;

  SELECT status INTO v_status FROM pets WHERE id = p_pet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pet % not found', p_pet_id USING ERRCODE = 'PT005';
  END IF;
  IF v_status NOT IN ('adopted', 'follow_up') THEN
    RAISE EXCEPTION 'Only adopted pets can be returned (current: %)', v_status
      USING ERRCODE = 'PT001';
  END IF;

  PERFORM set_config('app.status_note',
                     'Returned: ' || COALESCE(p_reason, 'no reason given'), true);
  UPDATE pets SET status = 'returned' WHERE id = p_pet_id;
END;
$$ LANGUAGE plpgsql;

-- Urgency score (0-100) for the At-Risk board
-- The "no applications" part switches on automatically once Person B's
-- applications table exists.
CREATE OR REPLACE FUNCTION fn_pet_urgency_score(p_pet_id int) RETURNS int AS $$
DECLARE
  p pets%ROWTYPE;
  score int := 0;
  n_apps bigint;
  v_missing boolean;
BEGIN
  SELECT * INTO p FROM pets WHERE id = p_pet_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  score := score + LEAST(40, (CURRENT_DATE - p.intake_date) / 5);

  IF to_regclass('public.applications') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM applications WHERE pet_id = $1'
      INTO n_apps USING p_pet_id;
    IF n_apps = 0 THEN score := score + 20; END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM required_vaccines rv
    WHERE rv.species = p.species
      AND NOT EXISTS (SELECT 1 FROM vaccinations v
                      WHERE v.pet_id = p.id
                        AND v.vaccine_name = rv.vaccine_name
                        AND v.expires_on >= CURRENT_DATE)
  ) INTO v_missing;
  IF v_missing THEN score := score + 15; END IF;

  IF p.age_months >= 96 THEN score := score + 10; END IF;
  IF COALESCE(trim(p.special_needs), '') <> '' THEN score := score + 10; END IF;
  IF p.size = 'large' AND p.energy_level >= 4 THEN score := score + 5; END IF;

  RETURN LEAST(100, score);
END;
$$ LANGUAGE plpgsql STABLE;
