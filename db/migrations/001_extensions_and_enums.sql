CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE pet_status AS ENUM
  ('intake','medical_hold','available','in_foster','adoption_pending',
   'adopted','follow_up','closed','returned');
CREATE TYPE application_status AS ENUM
  ('submitted','under_review','approved','rejected','withdrawn','auto_rejected');
CREATE TYPE placement_status AS ENUM ('active','completed','cancelled');
CREATE TYPE followup_status AS ENUM ('scheduled','completed','overdue','missed');
CREATE TYPE species_type AS ENUM ('dog','cat','rabbit','other');
CREATE TYPE size_type AS ENUM ('small','medium','large');
CREATE TYPE sex_type AS ENUM ('male','female','unknown');
CREATE TYPE home_type AS ENUM ('apartment','house_small_yard','house_large_yard','farm');
CREATE TYPE experience_level AS ENUM ('first_time','some','experienced');
CREATE TYPE placement_end_reason AS ENUM
  ('adopted','returned_to_shelter','medical','foster_request','other');
CREATE TYPE medical_record_type AS ENUM
  ('checkup','treatment','surgery','injury','behaviour','other');
CREATE TYPE audit_action AS ENUM ('INSERT','UPDATE','DELETE','STATUS_CHANGE');