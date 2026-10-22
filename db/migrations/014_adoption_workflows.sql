-- Person B: safe adoption approval and automatic 7/30/90-day follow-ups.
CREATE OR REPLACE FUNCTION fn_schedule_adoption_followups() RETURNS trigger AS $$
BEGIN
  INSERT INTO followups (adoption_id, due_date, day_number)
  VALUES
    (NEW.id, NEW.adopted_at::date + 7, 7),
    (NEW.id, NEW.adopted_at::date + 30, 30),
    (NEW.id, NEW.adopted_at::date + 90, 90)
  ON CONFLICT (adoption_id, day_number) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_schedule_adoption_followups
AFTER INSERT ON adoptions
FOR EACH ROW EXECUTE FUNCTION fn_schedule_adoption_followups();

CREATE OR REPLACE FUNCTION approve_adoption(p_application_id int, p_reviewer_id int)
RETURNS int AS $$
DECLARE
  v_app applications%ROWTYPE;
  v_pet_status pet_status;
  v_adoption_id int;
BEGIN
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
