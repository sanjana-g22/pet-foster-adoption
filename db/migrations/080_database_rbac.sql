-- PostgreSQL 15+; run as the schema owner using DATABASE_URL_DIRECT.
-- Additive: no existing application records are removed.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
DO $$
DECLARE n text;
BEGIN
  FOREACH n IN ARRAY ARRAY['pfa_guest','pfa_adopter','pfa_foster','pfa_staff','pfa_admin'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=n) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS', n);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=n AND
      (rolcanlogin OR rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)) THEN
      RAISE EXCEPTION 'Existing role % is not a safe PFA group role', n;
    END IF;
  END LOOP;
END $$;
CREATE SCHEMA app_security;
REVOKE ALL ON SCHEMA app_security FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE app_security.context_key (
  singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
  secret text NOT NULL CHECK(length(secret)>=64)
);
REVOKE ALL ON ALL TABLES IN SCHEMA app_security FROM PUBLIC;

-- The backend signs user_id:transaction_id. A plain SET of a user id is not identity.
-- The key is installed by db:rbac:setup and is never granted to runtime logins.
CREATE FUNCTION app_security.actor_id() RETURNS int
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE uid text; sig text; k text;
BEGIN
  uid := current_setting('app.current_user_id', true);
  sig := current_setting('app.context_signature', true);
  IF uid IS NULL OR uid !~ '^[1-9][0-9]{0,9}$' OR sig IS NULL THEN RETURN NULL; END IF;
  SELECT secret INTO k FROM app_security.context_key WHERE singleton;
  IF k IS NULL OR sig <> encode(public.hmac(uid || ':' || txid_current()::text,k,'sha256'),'hex') THEN
    RETURN NULL;
  END IF;
  RETURN (SELECT id FROM public.users WHERE id=uid::bigint AND is_active);
END $$;
CREATE FUNCTION app_security.actor_role() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT coalesce((SELECT r.name FROM public.users u JOIN public.roles r ON r.id=u.role_id
   WHERE u.id=app_security.actor_id() AND u.is_active), 'guest')
$$;
CREATE FUNCTION app_security.approved_foster() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.users u JOIN public.roles r ON r.id=u.role_id
 WHERE u.id=app_security.actor_id() AND u.is_active AND u.is_approved AND r.name='foster')
$$;
CREATE FUNCTION app_security.is_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$ SELECT app_security.actor_role() IN ('staff','admin') $$;
CREATE FUNCTION app_security.assert_staff(p_actor int) RETURNS void
LANGUAGE plpgsql STABLE SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
 IF NOT app_security.is_staff() OR p_actor IS DISTINCT FROM app_security.actor_id() THEN
   RAISE EXCEPTION 'Staff/admin permission and authenticated actor required' USING ERRCODE='42501';
 END IF;
END $$;
CREATE FUNCTION app_security.maintenance_session() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
 SELECT pg_has_role(session_user, c.relowner, 'MEMBER')
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE n.nspname='app_security' AND c.relname='context_key'
$$;
CREATE OR REPLACE FUNCTION public.fn_current_actor() RETURNS int
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF app_security.maintenance_session() THEN
   RETURN nullif(current_setting('app.current_user_id',true),'')::int;
 END IF;
 RETURN app_security.actor_id();
END $$;
CREATE OR REPLACE FUNCTION public.fn_is_seed_mode() RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_security.maintenance_session() AND coalesce(current_setting('app.seed_mode',true),'')='on'
$$;

-- Authentication returns no password hashes. bcryptjs $2b$ hashes use the same
-- algorithm as pgcrypto's $2a$ for passwords accepted by the existing app.
CREATE FUNCTION app_security.login(p_email text, p_password text)
RETURNS TABLE(id int, full_name text, is_active boolean, is_approved boolean, role text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE u public.users%ROWTYPE; h text;
BEGIN
 SELECT * INTO u FROM public.users WHERE email=lower(trim(p_email));
 h := CASE WHEN u.id IS NULL THEN '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'
           ELSE regexp_replace(u.password_hash, '^\$2b\$', '$2a$') END;
 IF public.crypt(p_password,h) IS DISTINCT FROM h OR u.id IS NULL THEN RETURN; END IF;
 RETURN QUERY SELECT u.id,u.full_name,u.is_active,u.is_approved,r.name FROM public.roles r WHERE r.id=u.role_id;
END $$;
CREATE FUNCTION app_security.register(p_email text,p_hash text,p_name text,p_phone text,p_role text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE uid int;
BEGIN
 IF p_role NOT IN ('adopter','foster') OR p_role IS NULL THEN
   RAISE EXCEPTION 'Self-registration only permits adopter/foster' USING ERRCODE='42501';
 END IF;
 IF p_hash IS NULL OR p_hash !~ '^\$2[ab]\$10\$[./A-Za-z0-9]{53}$' OR length(trim(p_name))<2 THEN
   RAISE EXCEPTION 'Invalid registration details' USING ERRCODE='23514';
 END IF;
 INSERT INTO public.users(email,password_hash,full_name,phone,role_id,is_approved)
 VALUES(lower(trim(p_email)),p_hash,p_name,p_phone,(SELECT id FROM public.roles WHERE name=p_role),p_role='adopter')
 RETURNING id INTO uid;
 IF p_role='foster' THEN INSERT INTO public.foster_profiles(user_id) VALUES(uid); END IF;
 RETURN uid;
END $$;

-- Non-recursive helpers for policies involving parent tables.
CREATE FUNCTION app_security.owns_placement(pid int, active_only boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_security.approved_foster() AND EXISTS(SELECT 1 FROM public.foster_placements
 WHERE id=pid AND foster_user_id=app_security.actor_id() AND (NOT active_only OR status='active'))
$$;
CREATE FUNCTION app_security.cares_for_pet(pid int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_security.approved_foster() AND EXISTS(SELECT 1 FROM public.foster_placements
 WHERE pet_id=pid AND foster_user_id=app_security.actor_id() AND status='active')
$$;
CREATE FUNCTION app_security.owns_adoption(aid int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_security.actor_role()='adopter' AND EXISTS(SELECT 1 FROM public.adoptions
 WHERE id=aid AND adopter_user_id=app_security.actor_id())
$$;
CREATE FUNCTION app_security.can_read_pet(pid int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_security.is_staff() OR app_security.cares_for_pet(pid)
 OR EXISTS(SELECT 1 FROM public.pets WHERE id=pid AND status IN ('available','in_foster','adoption_pending'))
 OR (app_security.actor_role()='adopter' AND EXISTS(SELECT 1 FROM public.applications
 WHERE pet_id=pid AND adopter_user_id=app_security.actor_id()))
$$;

-- RLS protects every business table, even if a caller switches to a more powerful
-- group role. The restrictive policy requires that role to match the signed user.
DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY['users','roles','pets','medical_records','required_vaccines','vaccinations',
 'foster_profiles','foster_placements','foster_updates','adopter_profiles','applications',
 'adoptions','followups','pet_embeddings','adopter_embeddings','pet_status_history','audit_log','pet_status_transitions'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY identity_guard ON public.%I AS RESTRICTIVE FOR ALL TO pfa_guest,pfa_adopter,pfa_foster,pfa_staff,pfa_admin USING (current_user::text = ''pfa_'' || app_security.actor_role()) WITH CHECK (current_user::text = ''pfa_'' || app_security.actor_role())',t);
 END LOOP;
END $$;
CREATE POLICY users_read ON users FOR SELECT USING(id=app_security.actor_id() OR app_security.is_staff());
CREATE POLICY users_admin_update ON users FOR UPDATE USING(app_security.actor_role()='admin') WITH CHECK(app_security.actor_role()='admin');
CREATE POLICY users_foster_approval ON users FOR UPDATE USING(app_security.is_staff() AND role_id=(SELECT id FROM roles WHERE name='foster')) WITH CHECK(app_security.is_staff() AND role_id=(SELECT id FROM roles WHERE name='foster'));
CREATE POLICY roles_read ON roles FOR SELECT USING(true);
CREATE POLICY vaccine_requirements_read ON required_vaccines FOR SELECT USING(true);
CREATE POLICY transitions_read ON pet_status_transitions FOR SELECT USING(true);
CREATE POLICY pets_read ON pets FOR SELECT USING(app_security.can_read_pet(id));
CREATE POLICY pets_staff_write ON pets FOR ALL USING(app_security.is_staff()) WITH CHECK(app_security.is_staff());
CREATE POLICY medical_read ON medical_records FOR SELECT USING(app_security.is_staff() OR app_security.cares_for_pet(pet_id));
CREATE POLICY medical_staff_write ON medical_records FOR ALL USING(app_security.is_staff()) WITH CHECK(app_security.is_staff());
CREATE POLICY vaccinations_read ON vaccinations FOR SELECT USING(app_security.is_staff() OR app_security.cares_for_pet(pet_id));
CREATE POLICY vaccinations_staff_write ON vaccinations FOR ALL USING(app_security.is_staff()) WITH CHECK(app_security.is_staff());
CREATE POLICY foster_profile_read ON foster_profiles FOR SELECT USING(app_security.is_staff() OR user_id=app_security.actor_id());
CREATE POLICY foster_profile_staff ON foster_profiles FOR ALL USING(app_security.is_staff()) WITH CHECK(app_security.is_staff());
CREATE POLICY placements_read ON foster_placements FOR SELECT USING(app_security.is_staff() OR app_security.owns_placement(id));
CREATE POLICY placements_staff ON foster_placements FOR ALL USING(app_security.is_staff()) WITH CHECK(app_security.is_staff());
CREATE POLICY updates_read ON foster_updates FOR SELECT USING(app_security.is_staff() OR app_security.owns_placement(placement_id));
CREATE POLICY updates_insert ON foster_updates FOR INSERT WITH CHECK(created_by=app_security.actor_id() AND
 (app_security.is_staff() OR app_security.owns_placement(placement_id,true)) AND EXISTS(SELECT 1 FROM foster_placements WHERE id=placement_id AND status='active'));
CREATE POLICY adopter_profile_own ON adopter_profiles FOR ALL USING(app_security.actor_role()='adopter' AND user_id=app_security.actor_id()) WITH CHECK(app_security.actor_role()='adopter' AND user_id=app_security.actor_id());
CREATE POLICY adopter_profile_staff_read ON adopter_profiles FOR SELECT USING(app_security.is_staff());
CREATE POLICY applications_read ON applications FOR SELECT USING(app_security.is_staff() OR (app_security.actor_role()='adopter' AND adopter_user_id=app_security.actor_id()));
CREATE POLICY applications_staff_update ON applications FOR UPDATE USING(app_security.is_staff()) WITH CHECK(app_security.is_staff());
CREATE POLICY adoptions_read ON adoptions FOR SELECT USING(app_security.is_staff() OR (app_security.actor_role()='adopter' AND adopter_user_id=app_security.actor_id()));
CREATE POLICY adoptions_staff_insert ON adoptions FOR INSERT WITH CHECK(app_security.is_staff() AND approved_by=app_security.actor_id());
CREATE POLICY followups_read ON followups FOR SELECT USING(app_security.is_staff() OR app_security.owns_adoption(adoption_id));
CREATE POLICY followups_staff_insert ON followups FOR INSERT WITH CHECK(app_security.is_staff());
CREATE POLICY followups_own_update ON followups FOR UPDATE USING(app_security.owns_adoption(adoption_id) AND status IN ('scheduled','overdue')) WITH CHECK(app_security.owns_adoption(adoption_id) AND status='completed' AND completed_at IS NOT NULL);
CREATE POLICY pet_vectors_read ON pet_embeddings FOR SELECT USING(app_security.can_read_pet(pet_id));
CREATE POLICY adopter_vectors_own ON adopter_embeddings FOR ALL USING(app_security.actor_role()='adopter' AND user_id=app_security.actor_id()) WITH CHECK(app_security.actor_role()='adopter' AND user_id=app_security.actor_id());
CREATE POLICY history_read ON pet_status_history FOR SELECT USING(app_security.is_staff() OR app_security.cares_for_pet(pet_id));
CREATE POLICY audit_admin_read ON audit_log FOR SELECT USING(app_security.actor_role()='admin');

-- Existing trigger writes run with the trusted owner so users cannot forge audit
-- records simply to make legitimate writes work. No runtime owns these functions.
ALTER FUNCTION fn_audit_row() SECURITY DEFINER;
ALTER FUNCTION fn_audit_row() SET search_path=pg_catalog,public,pg_temp;
ALTER FUNCTION fn_pets_log_status() SECURITY DEFINER;
ALTER FUNCTION fn_pets_log_status() SET search_path=pg_catalog,public,pg_temp;

-- Public pages receive only public timeline fields and vaccination summary.
CREATE FUNCTION app_security.public_timeline(pid int)
RETURNS TABLE(pet_id int,history_id int,from_status pet_status,to_status pet_status,changed_at timestamptz,changed_by_name text,note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT h.pet_id,h.id,h.from_status,h.to_status,h.changed_at,
 CASE WHEN app_security.is_staff() THEN u.full_name END,
 CASE WHEN app_security.is_staff() THEN h.note END
 FROM public.pet_status_history h LEFT JOIN public.users u ON u.id=h.changed_by
 WHERE h.pet_id=pid AND app_security.can_read_pet(pid)
$$;
CREATE FUNCTION app_security.fully_vaccinated(pid int) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_security.can_read_pet(pid) AND NOT EXISTS(
 SELECT 1 FROM public.required_vaccines rv JOIN public.pets p ON p.species=rv.species
 WHERE p.id=pid AND NOT EXISTS(SELECT 1 FROM public.vaccinations v
 WHERE v.pet_id=pid AND v.vaccine_name=rv.vaccine_name AND v.expires_on>=CURRENT_DATE))
$$;
-- Adoption submission requires a pet lock but does not give adopters UPDATE pets.
CREATE FUNCTION app_security.submit_application(pid int,msg text)
RETURNS TABLE(id int,pet_id int,status application_status,submitted_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE uid int := app_security.actor_id(); st pet_status;
BEGIN
 IF app_security.actor_role()<>'adopter' OR uid IS NULL THEN
  RAISE EXCEPTION 'Adopter permission required' USING ERRCODE='42501';
 END IF;
 SELECT p.status INTO st FROM public.pets p WHERE p.id=pid FOR UPDATE;
 IF st IS NULL THEN RAISE EXCEPTION 'Pet not found' USING ERRCODE='PT005'; END IF;
 IF st NOT IN ('available','in_foster') THEN RAISE EXCEPTION 'Pet is not accepting applications' USING ERRCODE='PT001'; END IF;
 RETURN QUERY INSERT INTO public.applications AS a(pet_id,adopter_user_id,message)
 VALUES(pid,uid,msg)
 ON CONFLICT ON CONSTRAINT uq_applications_pet_adopter DO UPDATE
 SET message=EXCLUDED.message,status='submitted',reviewer_user_id=NULL,review_note=NULL,reviewed_at=NULL,submitted_at=now(),updated_at=now()
 WHERE a.status IN ('rejected','withdrawn')
 RETURNING a.id,a.pet_id,a.status,a.submitted_at;
END $$;

-- Review all existing views under the caller's permissions, never the owner.
DO $$ DECLARE v record; BEGIN
 FOR v IN SELECT viewname FROM pg_views WHERE schemaname='public' LOOP
  EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',v.viewname);
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC;
-- Revoke application functions only; leave extension operators/functions intact.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND NOT EXISTS(SELECT 1 FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC',f.sig);
 END LOOP;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_security FROM PUBLIC;
GRANT USAGE ON SCHEMA public,app_security TO pfa_guest,pfa_adopter,pfa_foster,pfa_staff,pfa_admin;
GRANT EXECUTE ON FUNCTION app_security.actor_id(),app_security.actor_role(),app_security.approved_foster(),app_security.is_staff(),app_security.owns_placement(int,boolean),app_security.cares_for_pet(int),app_security.owns_adoption(int),app_security.can_read_pet(int),app_security.public_timeline(int),app_security.fully_vaccinated(int) TO pfa_guest,pfa_adopter,pfa_foster,pfa_staff,pfa_admin;
GRANT EXECUTE ON FUNCTION app_security.login(text,text),app_security.register(text,text,text,text,text) TO pfa_guest;
GRANT EXECUTE ON FUNCTION app_security.submit_application(int,text) TO pfa_adopter;
GRANT SELECT ON roles,required_vaccines,pet_status_transitions,pets,v_available_pets TO pfa_guest,pfa_adopter,pfa_foster,pfa_staff,pfa_admin;
GRANT SELECT(id,email,full_name,phone,role_id,is_active,is_approved,created_at) ON users TO pfa_guest,pfa_adopter,pfa_foster,pfa_staff,pfa_admin;
GRANT SELECT ON adopter_profiles,applications,adoptions,followups,pet_embeddings,adopter_embeddings TO pfa_adopter,pfa_staff,pfa_admin;
GRANT INSERT,UPDATE ON adopter_profiles,adopter_embeddings TO pfa_adopter;
GRANT UPDATE(status,adopter_notes,completed_at) ON followups TO pfa_adopter;
GRANT SELECT ON foster_profiles,foster_placements,foster_updates,medical_records,vaccinations,pet_status_history TO pfa_foster,pfa_staff,pfa_admin;
GRANT INSERT ON foster_updates TO pfa_foster,pfa_staff,pfa_admin;
GRANT INSERT,UPDATE ON pets,medical_records,vaccinations,foster_profiles,foster_placements TO pfa_staff,pfa_admin;
GRANT UPDATE ON applications TO pfa_staff,pfa_admin;
GRANT INSERT ON adoptions,followups TO pfa_staff,pfa_admin;
GRANT UPDATE(is_approved) ON users TO pfa_staff;
GRANT UPDATE(email,full_name,phone,role_id,is_active,is_approved) ON users TO pfa_admin;
GRANT SELECT ON audit_log TO pfa_admin;
GRANT SELECT ON v_foster_capacity,v_overdue_vaccinations,v_at_risk_pets,v_pet_timeline,v_adoption_funnel,v_average_stay_by_species TO pfa_staff,pfa_admin;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO pfa_adopter,pfa_foster,pfa_staff,pfa_admin;
GRANT EXECUTE ON FUNCTION fn_current_actor(),fn_is_seed_mode(),app_security.maintenance_session(),fn_pet_urgency_score(int) TO pfa_staff,pfa_admin;
GRANT EXECUTE ON FUNCTION app_security.assert_staff(int),sp_change_pet_status(int,pet_status,text,int),sp_place_in_foster(int,int,date,int),sp_end_placement(int,placement_end_reason,int),sp_process_return(int,text,int),approve_adoption(int,int) TO pfa_staff,pfa_admin;
