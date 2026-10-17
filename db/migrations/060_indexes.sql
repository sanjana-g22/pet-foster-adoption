-- 060: extra indexes (Person A). Prove them with db/tests/explain_queries.sql

-- Partial index: only the rows the public browse page reads
CREATE INDEX idx_pets_available_partial ON pets(species, size) WHERE status = 'available';
CREATE INDEX idx_pets_intake_date ON pets(intake_date);
CREATE INDEX idx_medical_pet_date ON medical_records(pet_id, record_date DESC);
CREATE INDEX idx_vacc_pet_vaccine_expiry ON vaccinations(pet_id, vaccine_name, expires_on);
CREATE INDEX idx_foster_updates_placement ON foster_updates(placement_id, update_date DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_user_id);
