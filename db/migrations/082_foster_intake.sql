-- Foster reports are private requests, not publicly available pets.
CREATE TABLE intake_requests (
 id int GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 submitted_by int NOT NULL REFERENCES users(id),
 details jsonb NOT NULL CHECK(jsonb_typeof(details)='object'),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','needs_information','approved','rejected')),
 review_note text,
 reviewed_by int REFERENCES users(id),
 reviewed_at timestamptz,
 pet_id int UNIQUE REFERENCES pets(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='approved') = (pet_id IS NOT NULL))
);
CREATE INDEX ON intake_requests(submitted_by,created_at DESC);
CREATE INDEX ON intake_requests(status,created_at DESC);
CREATE TABLE intake_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 request_id int NOT NULL REFERENCES intake_requests(id) ON DELETE CASCADE,
 actor_id int REFERENCES users(id),
 actor_name text NOT NULL,
 status text NOT NULL,
 note text,
 details jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON intake_events(request_id,id);
ALTER TABLE intake_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE intake_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY intake_read ON intake_requests FOR SELECT USING (
 app_security.is_staff() OR (app_security.actor_role()='foster' AND submitted_by=app_security.actor_id()));
CREATE POLICY intake_event_read ON intake_events FOR SELECT USING (
 EXISTS(SELECT 1 FROM public.intake_requests r WHERE r.id=request_id));
REVOKE ALL ON intake_requests,intake_events FROM PUBLIC,pfa_guest,pfa_adopter,pfa_foster,pfa_staff,pfa_admin;
GRANT SELECT ON intake_requests,intake_events TO pfa_foster,pfa_staff,pfa_admin;

-- No application role can write the request or history directly.
CREATE FUNCTION app_security.log_intake() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 INSERT INTO public.intake_events(request_id,actor_id,actor_name,status,note,details)
 SELECT NEW.id,app_security.actor_id(),coalesce((SELECT full_name FROM public.users WHERE id=app_security.actor_id()),'Maintenance'),NEW.status,NEW.review_note,NEW.details;
 RETURN NEW;
END $$;
CREATE TRIGGER intake_history AFTER INSERT OR UPDATE ON intake_requests
 FOR EACH ROW EXECUTE FUNCTION app_security.log_intake();
CREATE TRIGGER intake_audit AFTER INSERT OR UPDATE OR DELETE ON intake_requests
 FOR EACH ROW EXECUTE FUNCTION fn_audit_row();

CREATE FUNCTION app_security.submit_intake(p_details jsonb,p_id int DEFAULT NULL) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_id int; v public.intake_requests%ROWTYPE;
BEGIN
 IF NOT app_security.approved_foster() THEN
  RAISE EXCEPTION 'An approved foster account is required' USING ERRCODE='42501';
 END IF;
 -- Validate at the database boundary as well as in the HTTP handler.
 IF jsonb_typeof(p_details) IS DISTINCT FROM 'object' OR NOT coalesce(
  length(trim(p_details->>'name')) BETWEEN 1 AND 60
  AND p_details->>'species' IN ('dog','cat','rabbit','other')
  AND p_details->>'sex' IN ('male','female','unknown')
  AND p_details->>'size' IN ('small','medium','large')
  AND (p_details->>'ageMonths')::int BETWEEN 0 AND 360
  AND (p_details->>'weightKg')::numeric > 0 AND (p_details->>'weightKg')::numeric <= 200
  AND (p_details->>'energyLevel')::int BETWEEN 1 AND 5
  AND length(trim(p_details->>'foundLocation')) BETWEEN 1 AND 300
  AND length(trim(p_details->>'healthNotes')) BETWEEN 1 AND 2000
  AND length(trim(p_details->>'vaccineNotes')) BETWEEN 1 AND 2000
  AND (p_details->>'foundDate')::date <= CURRENT_DATE
  AND jsonb_typeof(p_details->'temporarilyCaring')='boolean'
  AND octet_length(p_details::text)<=20000,false) THEN
  RAISE EXCEPTION 'Invalid intake details' USING ERRCODE='23514';
 END IF;
 IF p_id IS NULL THEN
  INSERT INTO public.intake_requests(submitted_by,details) VALUES(app_security.actor_id(),p_details) RETURNING id INTO v_id;
 ELSE
  SELECT * INTO v FROM public.intake_requests WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR v.submitted_by<>app_security.actor_id() THEN
   RAISE EXCEPTION 'Request not found' USING ERRCODE='PT005';
  END IF;
  IF v.status<>'needs_information' THEN
   RAISE EXCEPTION 'Only requests needing information can be resubmitted' USING ERRCODE='PT001';
  END IF;
  UPDATE public.intake_requests SET details=p_details,status='pending',review_note=NULL,
   reviewed_by=NULL,reviewed_at=NULL,updated_at=now() WHERE id=p_id RETURNING id INTO v_id;
 END IF;
 RETURN v_id;
END $$;

CREATE FUNCTION app_security.review_intake(p_id int,p_decision text,p_note text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v public.intake_requests%ROWTYPE; d jsonb; v_pet int;
BEGIN
 PERFORM app_security.assert_staff(app_security.actor_id());
 IF p_decision IS NULL OR p_decision NOT IN ('approved','rejected','needs_information')
 OR p_note IS NULL OR length(trim(p_note)) NOT BETWEEN 3 AND 2000 THEN
  RAISE EXCEPTION 'Choose a valid decision and provide a reason (3-2000 characters)' USING ERRCODE='23514';
 END IF;
 SELECT * INTO v FROM public.intake_requests WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not found' USING ERRCODE='PT005'; END IF;
 IF v.status<>'pending' THEN RAISE EXCEPTION 'Request is no longer pending review' USING ERRCODE='PT001'; END IF;
 IF p_decision='approved' THEN
  d:=v.details;
  INSERT INTO public.pets(name,species,breed,sex,age_months,size,weight_kg,microchip_no,intake_source,
   temperament,description,good_with_kids,good_with_pets,apartment_friendly,house_trained,energy_level,special_needs,photo_url)
  VALUES(d->>'name',(d->>'species')::public.species_type,nullif(d->>'breed',''),(d->>'sex')::public.sex_type,
   (d->>'ageMonths')::int,(d->>'size')::public.size_type,(d->>'weightKg')::numeric,nullif(d->>'microchipNo',''),
   'Foster intake request #'||v.id,d->>'temperament',d->>'description',coalesce((d->>'goodWithKids')::boolean,false),
   coalesce((d->>'goodWithPets')::boolean,false),coalesce((d->>'apartmentFriendly')::boolean,false),
   coalesce((d->>'houseTrained')::boolean,false),(d->>'energyLevel')::int,d->>'specialNeeds',d->>'photoUrl') RETURNING id INTO v_pet;
  -- Submitted vaccine claims stay in the request. Staff enter verified records via
  -- the existing vaccination workflow; the existing availability gate still applies.
 END IF;
 UPDATE public.intake_requests SET status=p_decision,review_note=trim(p_note),reviewed_by=app_security.actor_id(),
  reviewed_at=now(),pet_id=v_pet,updated_at=now() WHERE id=p_id;
 RETURN v_pet;
END $$;
REVOKE ALL ON FUNCTION app_security.log_intake(),app_security.submit_intake(jsonb,int),app_security.review_intake(int,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_security.submit_intake(jsonb,int) TO pfa_foster;
GRANT EXECUTE ON FUNCTION app_security.review_intake(int,text,text) TO pfa_staff,pfa_admin;
