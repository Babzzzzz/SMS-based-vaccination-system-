--  Database Schema — MySQL

CREATE DATABASE IF NOT EXISTS vacc_system
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE vacc_system;

-- 1. USER_ROLE (no FK dependencies) 
CREATE TABLE IF NOT EXISTS user_role (
  roleID      VARCHAR(36)   PRIMARY KEY,
  roleName    ENUM('admin','provider','caregiver') NOT NULL,
  permissions JSON
);

--  2. USER (depends on user_role) 
CREATE TABLE IF NOT EXISTS user (
  userID       VARCHAR(36)   PRIMARY KEY,
  roleID       VARCHAR(36)   NOT NULL,
  username     VARCHAR(80)   NOT NULL UNIQUE,
  passwordHash VARCHAR(255)  NOT NULL,
  isActive     BOOLEAN       DEFAULT 1,
  roleType     ENUM('admin','provider','caregiver') NOT NULL,
  facility     VARCHAR(120),                 -- provider's facility (shown in top bar)
  email        VARCHAR(120),                 -- used for password-reset link
  lastLogin    DATETIME,
  createdAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (roleID) REFERENCES user_role(roleID)
);

-- 3. CAREGIVER (no FK dependencies) 
CREATE TABLE IF NOT EXISTS caregiver (
  caregiverID  VARCHAR(36)   PRIMARY KEY,
  name         VARCHAR(100)  NOT NULL,
  phone        VARCHAR(15)   NOT NULL UNIQUE,  -- NFR-05: UNIQUE prevents duplicates
  language     VARCHAR(10)   DEFAULT 'sw',     -- sw=Swahili, en=English
  createdAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
);

--  4. CHILD (depends on caregiver) 
CREATE TABLE IF NOT EXISTS child (
  childID      VARCHAR(36)   PRIMARY KEY,
  caregiverID  VARCHAR(36)   NOT NULL,
  name         VARCHAR(100)  NOT NULL,
  dob          DATE          NOT NULL,
  gender       ENUM('M','F','O'),
  birthWeight  DECIMAL(4,2),                  -- kg, optional (Wf2 registration form)
  createdAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (caregiverID) REFERENCES caregiver(caregiverID),
  UNIQUE KEY uk_child (caregiverID, name, dob),  -- prevents duplicate child registration
  KEY idx_child_cg (caregiverID)                 
);

-- 5. APPOINTMENT (depends on caregiver)
CREATE TABLE IF NOT EXISTS appointment (
  apptID       VARCHAR(36)   PRIMARY KEY,
  childID      VARCHAR(36)   NOT NULL,
  facilityID   VARCHAR(36),
  apptDate     DATETIME      NOT NULL,
  vaccineType  VARCHAR(80),
  status       ENUM('scheduled','done','missed') DEFAULT 'scheduled',
  createdAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (childID) REFERENCES child(childID),
  KEY idx_appt_date   (apptDate),                -- NFR-03 performance
  KEY idx_appt_status (status),
  KEY idx_appt_child  (childID)
);

-- 6. VACCINATION_RECORD (depends on appointment + user) 
CREATE TABLE IF NOT EXISTS vaccination_record (
  recordID              VARCHAR(36)   PRIMARY KEY,
  apptID                VARCHAR(36)   NOT NULL UNIQUE,  -- 1-to-1 with appointment
  providerID            VARCHAR(36)   NOT NULL,
  vaccineType           VARCHAR(80)   NOT NULL,
  doseNumber            TINYINT       NOT NULL,
  dateAdministered      DATE          NOT NULL,
  batchNumber           VARCHAR(60)   NOT NULL,
  administeringProvider VARCHAR(100),
  notes                 TEXT,
  createdAt             TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (apptID)     REFERENCES appointment(apptID),
  FOREIGN KEY (providerID) REFERENCES user(userID)
);

-- 7. SMS_LOG (depends on appointment) 
CREATE TABLE IF NOT EXISTS sms_log (
  logID          VARCHAR(36)   PRIMARY KEY,
  apptID         VARCHAR(36)   NOT NULL,
  message        TEXT          NOT NULL,
  timestamp      DATETIME      DEFAULT CURRENT_TIMESTAMP,
  deliveryStatus ENUM('sent','delivered','failed') DEFAULT 'sent',
  direction      ENUM('in','out') NOT NULL,
  retryCount     TINYINT       DEFAULT 0,
  FOREIGN KEY (apptID) REFERENCES appointment(apptID),
  KEY idx_sms_appt (apptID),                     -- NFR-03 performance
  KEY idx_sms_dir  (direction)
);

-- 8. REPORT (depends on user) 
CREATE TABLE IF NOT EXISTS report (
  reportID      VARCHAR(36)   PRIMARY KEY,
  generatedByID VARCHAR(36)   NOT NULL,
  type          VARCHAR(60),
  generatedDate DATE          DEFAULT (CURDATE()),
  data          JSON,
  FOREIGN KEY (generatedByID) REFERENCES user(userID)
);

--  9. AUDIT_LOG (depends on user) 
CREATE TABLE IF NOT EXISTS audit_log (
  logID      VARCHAR(36)   PRIMARY KEY,
  userID     VARCHAR(36)   NOT NULL,
  action     VARCHAR(120)  NOT NULL,
  timestamp  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  ipAddress  VARCHAR(45),
  FOREIGN KEY (userID) REFERENCES user(userID),
  KEY idx_audit_user (userID),                   -- NFR-03 performance
  KEY idx_audit_ts   (timestamp)
);

-- 10. SYSTEM_SETTING (admin config — SMS gateway/reminders) ─
--  Key/value store edited from the Admin → SMS Gateway panel.
CREATE TABLE IF NOT EXISTS system_setting (
  settingKey   VARCHAR(60)   PRIMARY KEY,
  settingValue VARCHAR(255),
  updatedAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

--  11. SMS_TEMPLATE (editable multi-lingual templates) 
CREATE TABLE IF NOT EXISTS sms_template (
  templateID   VARCHAR(36)   PRIMARY KEY,
  language     VARCHAR(10)   NOT NULL,        -- sw / en / 
  templateType VARCHAR(30)   NOT NULL,        -- 48hr / 24hr / followup / confirm
  body         TEXT          NOT NULL,
  updatedAt    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_template (language, templateType)
);

