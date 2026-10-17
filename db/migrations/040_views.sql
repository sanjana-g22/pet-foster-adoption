-- 040: views (Person A)

CREATE VIEW v_available_pets AS
SELECT p.id, p.name, p.species, p.breed, p.sex, p.age_months,
       CASE WHEN p.age_months < 12 THEN 'baby'
            WHEN p.age_months < 96 THEN 'adult'
            ELSE 'senior' END AS age_group,
       p.size, p.weight_kg, p.temperament, p.description,
       p.good_with_kids, p.good_with_pets, p.apartment_friendly,
       p.house_trained, p.energy_level, p.photo_url,
       (CURRENT_DATE - p.intake_date) AS days_in_shelter
FROM pets p
WHERE p.status = 'available';

CREATE VIEW v_foster_capacity AS
SELECT fp.user_id, u.full_name, u.email, u.is_active, u.is_approved,
       fp.max_capacity,
       COUNT(pl.id) FILTER (WHERE pl.status = 'active') AS active_placements,
       fp.max_capacity - COUNT(pl.id) FILTER (WHERE pl.status = 'active') AS free_slots,
       ROUND(100.0 * COUNT(pl.id) FILTER (WHERE pl.status = 'active') / fp.max_capacity, 1)
         AS utilisation_pct
FROM foster_profiles fp
JOIN users u ON u.id = fp.user_id
LEFT JOIN foster_placements pl ON pl.foster_user_id = fp.user_id
GROUP BY fp.user_id, u.full_name, u.email, u.is_active, u.is_approved, fp.max_capacity;

CREATE VIEW v_overdue_vaccinations AS
SELECT p.id AS pet_id, p.name, p.species, p.status, rv.vaccine_name,
       MAX(v.expires_on) AS last_expiry,
       CASE WHEN MAX(v.expires_on) IS NULL THEN 'missing' ELSE 'expired' END AS issue
FROM pets p
JOIN required_vaccines rv ON rv.species = p.species
LEFT JOIN vaccinations v ON v.pet_id = p.id AND v.vaccine_name = rv.vaccine_name
WHERE p.status IN ('intake','medical_hold','available','in_foster','adoption_pending','returned')
GROUP BY p.id, p.name, p.species, p.status, rv.vaccine_name
HAVING COALESCE(MAX(v.expires_on), DATE '1900-01-01') < CURRENT_DATE;

CREATE VIEW v_at_risk_pets AS
SELECT t.*,
       CASE WHEN t.urgency_score >= 70 THEN 'critical'
            WHEN t.urgency_score >= 50 THEN 'high'
            WHEN t.urgency_score >= 30 THEN 'medium'
            ELSE 'low' END AS urgency_level
FROM (
  SELECT p.id AS pet_id, p.name, p.species, p.status,
         (CURRENT_DATE - p.intake_date) AS days_in_shelter,
         fn_pet_urgency_score(p.id) AS urgency_score
  FROM pets p
  WHERE p.status IN ('intake','medical_hold','available','in_foster')
) t
ORDER BY t.urgency_score DESC;

CREATE VIEW v_pet_timeline AS
SELECT h.pet_id, h.id AS history_id, h.from_status, h.to_status,
       h.changed_at, u.full_name AS changed_by_name, h.note
FROM pet_status_history h
LEFT JOIN users u ON u.id = h.changed_by;
