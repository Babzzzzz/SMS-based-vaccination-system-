--  Seed Data — run after schema.sql
--  Inserts default roles and a System Admin user.
--  Change the admin password hash before production use.


USE vacc_system;

--  Roles 
INSERT IGNORE INTO user_role (roleID, roleName, permissions) VALUES
  ('role-admin',    'admin',    '{"canManageUsers":true,"canConfigureGateway":true,"canViewAuditLog":true}'),
  ('role-provider', 'provider', '{"canRegisterPatients":true,"canRecordVaccinations":true,"canViewReports":true}'),
  ('role-cg',       'caregiver','{"smsOnly":true}');

--  Default System Admin 
-- Password: Admin@1234  (bcrypt hash — change before production)
INSERT IGNORE INTO user (userID, roleID, username, passwordHash, isActive, roleType, facility, email) VALUES
  ('user-admin-001', 'role-admin', 'sysadmin',
   '$2b$10$Wd2wnk/ZbU3hjca.LcZIi.yCEFFaQPneCHiF4wyOirebwuDr3mLAW',
   1, 'admin', 'Ministry of Health', 'admin@vaccsystem.go.ke');

--  Sample Healthcare Provider 
-- Password: Provider@1234
INSERT IGNORE INTO user (userID, roleID, username, passwordHash, isActive, roleType, facility, email) VALUES
  ('user-prov-001', 'role-provider', 'dr.kamau',
   '$2b$10$q4CnKmGR/DKAFlD/3ifm1.NNuZy2/FP4C8sQdkEXI/WSqicfg87Am',
   1, 'provider', 'Kenyatta National Hospital', 'dr.kamau@knh.go.ke');

--  Sample Caregiver 
INSERT IGNORE INTO caregiver (caregiverID, name, phone, language) VALUES
  ('cg-001', 'Ester Wanjiru', '+254712345678', 'sw');

--  Sample Child 
INSERT IGNORE INTO child (childID, caregiverID, name, dob, gender, birthWeight) VALUES
  ('ch-001', 'cg-001', 'Brian Kamau', '2025-11-15', 'M', 3.20);

-- SMS Gateway / reminder configuration 
INSERT IGNORE INTO system_setting (settingKey, settingValue) VALUES
  ('at_provider',         'Africa''s Talking'),
  ('sender_id',           'VACC-KE'),
  ('reminder_hours_first','48'),
  ('reminder_hours_second','24'),
  ('sms_max_retries',     '3'),
  ('gateway_status',      'online');

--  Default multi-lingual SMS templates 
INSERT IGNORE INTO sms_template (templateID, language, templateType, body) VALUES
  ('tpl-sw-48hr','sw','48hr','Karibu {name}. Kumbusho: {child} ana chanjo ya {vaccine} tarehe {date}, {facility}. Jibu YES kuthibitisha, NO, au RESCHEDULE. - VaccKE'),
  ('tpl-sw-24hr','sw','24hr','Kumbusho la mwisho: {child} ana chanjo kesho tarehe {date}. Jibu YES, NO, au RESCHEDULE. - VaccKE'),
  ('tpl-sw-followup','sw','followup','Habari {name}. Tunaona {child} hakufika kwa chanjo ya {vaccine}. Tafadhali wasiliana nasi. - VaccKE'),
  ('tpl-sw-confirm','sw','confirm','Asante {name}. Tumethibitisha miadi ya {child} kwa {vaccine} tarehe {date}. - VaccKE'),
  ('tpl-en-48hr','en','48hr','Dear {name}, reminder: {child} has a {vaccine} appointment on {date} at {facility}. Reply YES, NO or RESCHEDULE. - VaccKE'),
  ('tpl-en-24hr','en','24hr','Final reminder: {child} has a vaccination appointment tomorrow {date}. Reply YES, NO or RESCHEDULE. - VaccKE'),
  ('tpl-en-followup','en','followup','Dear {name}, {child} missed the {vaccine} appointment. Please contact us to reschedule. - VaccKE'),
  ('tpl-en-confirm','en','confirm','Thank you {name}. We have confirmed {child}''s {vaccine} appointment on {date}. - VaccKE');
