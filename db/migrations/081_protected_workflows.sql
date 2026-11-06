-- Existing workflow behaviour plus database authorization checks.
-- 030: stored procedures / functions (Person A)
-- The API must call these instead of running raw UPDATEs on pets.status.

-- Generic, validated status change (staff manual changes)
CREATE OR REPLACE FUNCTION sp_change_pet_status(
  p_pet_id int, p_to pet_status, p_note text DEFAULT NULL, p_actor int DEFAULT NULL
) RETURNS void AS $$
BEGIN
  PERFORM app_security.assert_staff(p_actor);
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
  PERFORM app_security.assert_staff(p_actor);
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
  PERFORM app_security.assert_staff(p_actor);
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
  PERFORM app_security.assert_staff(p_actor);
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

CREATE OR REPLACE FUNCTION approve_adoption(p_application_id int, p_reviewer_id int)
RETURNS int AS $$
DECLARE
  v_app applications%ROWTYPE;
  v_pet_status pet_status;
  v_adoption_id int;
BEGIN
  PERFORM app_security.assert_staff(p_reviewer_id);
  SELECT * INTO v_app FROM applications WHERE id = p_application_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Application % not found', p_application_id USING ERRCODE = 'P0002';
  END IF;
  IF v_app.status NOT IN ('submitted','under_review') THEN
    RAISE EXCEPTION 'Application is not pending review' USING ERRCODE = 'P0001';
  END IF;

  SELECT status INTO v_pet_status FROM pets WHERE id = v_app.pet_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pet not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_pet_status NOT IN ('available','in_foster') THEN
    RAISE EXCEPTION 'Pet is not eligible for adoption (status: %)', v_pet_status USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM adoptions WHERE pet_id = v_app.pet_id) THEN
    RAISE EXCEPTION 'This pet already has an approved adoption' USING ERRCODE = '23505';
  END IF;

  INSERT INTO adoptions (pet_id, application_id, adopter_user_id, approved_by)
  VALUES (v_app.pet_id, v_app.id, v_app.adopter_user_id, p_reviewer_id)
  RETURNING id INTO v_adoption_id;

  UPDATE applications
  SET status = 'approved', reviewer_user_id = p_reviewer_id, reviewed_at = now(), updated_at = now()
  WHERE id = v_app.id;

  UPDATE applications
  SET status = 'auto_rejected', reviewer_user_id = p_reviewer_id,
      reviewed_at = now(), review_note = 'Another application was approved for this pet',
      updated_at = now()
  WHERE pet_id = v_app.pet_id AND id <> v_app.id
    AND status IN ('submitted','under_review');

  -- Respect the existing lifecycle trigger; the caller's transaction rolls back
  -- if Person A's schema does not permit this transition from the current status.
  UPDATE pets SET status = 'adoption_pending' WHERE id = v_app.pet_id AND status IN ('available','in_foster');
  UPDATE pets SET status = 'adopted' WHERE id = v_app.pet_id AND status = 'adoption_pending';

  RETURN v_adoption_id;
END;
$$ LANGUAGE plpgsql;
