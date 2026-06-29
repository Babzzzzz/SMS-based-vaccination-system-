'use strict';
const db           = require('../../config/db');
const { logAudit } = require('../../utils/audit');
const { generateKEPISchedule } = require('../scheduling/schedulingModule');

//  CAREGIVER 

async function createCaregiver(providerUserID, { name, phone, language = 'sw' }, ip) {
  // Duplicate phone check (also enforced by DB UNIQUE constraint)
  const [existing] = await db.execute(
    'SELECT caregiverID FROM caregiver WHERE phone = ?', [phone]
  );
  if (existing.length) throw new Error('DUPLICATE_PHONE');

  const [result] = await db.execute(
    `INSERT INTO caregiver (caregiverID, name, phone, language)
     VALUES (UUID(), ?, ?, ?)`,
    [name, phone, language]
  );
  const [rows] = await db.execute(
    'SELECT caregiverID FROM caregiver WHERE phone = ?', [phone]
  );
  const caregiverID = rows[0].caregiverID;
  await logAudit(providerUserID, `Registered caregiver: ${name} (${caregiverID})`, ip);
  return caregiverID;
}

async function getCaregiverByPhone(phone) {
  const [rows] = await db.execute(
    'SELECT * FROM caregiver WHERE phone = ?', [phone]
  );
  return rows[0] || null;
}

async function getAllCaregivers() {
  const [rows] = await db.execute(
    `SELECT c.*, COUNT(ch.childID) AS childCount
     FROM caregiver c
     LEFT JOIN child ch ON c.caregiverID = ch.caregiverID
     GROUP BY c.caregiverID
     ORDER BY c.name`
  );
  return rows;
}

async function updateCaregiverContact(providerUserID, caregiverID, { phone, language }, ip) {
  if (phone) {
    // Check new phone not taken by another caregiver
    const [existing] = await db.execute(
      'SELECT caregiverID FROM caregiver WHERE phone = ? AND caregiverID != ?',
      [phone, caregiverID]
    );
    if (existing.length) throw new Error('DUPLICATE_PHONE');
    await db.execute(
      'UPDATE caregiver SET phone = ? WHERE caregiverID = ?', [phone, caregiverID]
    );
  }
  if (language) {
    await db.execute(
      'UPDATE caregiver SET language = ? WHERE caregiverID = ?', [language, caregiverID]
    );
  }
  await logAudit(providerUserID, `Updated caregiver contact: ${caregiverID}`, ip);
}

// CHILD 

async function createChild(providerUserID, caregiverID,
                           { name, dob, gender, birthWeight = null }, facilityID, ip) {
  // Duplicate child check (for data integrity)
  const [existing] = await db.execute(
    `SELECT childID FROM child
     WHERE caregiverID = ? AND name = ? AND dob = ?`,
    [caregiverID, name, dob]
  );
  if (existing.length) throw new Error('DUPLICATE_CHILD');

  await db.execute(
    `INSERT INTO child (childID, caregiverID, name, dob, gender, birthWeight)
     VALUES (UUID(), ?, ?, ?, ?, ?)`,
    [caregiverID, name, dob, gender, birthWeight]
  );
  const [rows] = await db.execute(
    'SELECT childID FROM child WHERE caregiverID = ? AND name = ? AND dob = ?',
    [caregiverID, name, dob]
  );
  const childID = rows[0].childID;

  // Auto-generate WHO KEPI schedule
  await generateKEPISchedule(providerUserID, childID, dob, facilityID, ip);

  await logAudit(providerUserID, `Registered child: ${name} (${childID})`, ip);
  return childID;
}

//  Combined patient registration (Wf2) 
// Registers a caregiver (or reuses an existing one matched by phone) and a
// child in one step, then auto-generates the KEPI schedule.
async function registerPatient(providerUserID, caregiver, childData, facilityID, ip) {
  // Reuse caregiver if the phone already exists, otherwise create.
  let caregiverID;
  const existingCg = await getCaregiverByPhone(caregiver.phone);
  if (existingCg) {
    caregiverID = existingCg.caregiverID;
    if (caregiver.language && caregiver.language !== existingCg.language) {
      await db.execute('UPDATE caregiver SET language = ? WHERE caregiverID = ?',
        [caregiver.language, caregiverID]);
    }
  } else {
    caregiverID = await createCaregiver(providerUserID, caregiver, ip);
  }

  const childID = await createChild(providerUserID, caregiverID, childData, facilityID, ip);
  return { caregiverID, childID, reusedCaregiver: !!existingCg };
}

//  List / search all children (Schedules + Dashboard) 
async function getAllChildren(q = '') {
  const like = `%${q}%`;
  const [rows] = await db.execute(
    `SELECT ch.childID, ch.name, ch.dob, ch.gender, ch.birthWeight,
            cg.caregiverID, cg.name AS caregiverName, cg.phone, cg.language,
            COUNT(DISTINCT a.apptID) AS apptCount,
            SUM(a.status = 'missed') AS missedCount
     FROM child ch
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     LEFT JOIN appointment a ON a.childID = ch.childID
     WHERE (? = '' OR ch.name LIKE ? OR cg.name LIKE ? OR cg.phone LIKE ? OR ch.childID LIKE ?)
     GROUP BY ch.childID
     ORDER BY ch.name`,
    [q, like, like, like, like]
  );
  return rows;
}

async function getChild(childID) {
  const [rows] = await db.execute(
    `SELECT ch.*, cg.name AS caregiverName, cg.phone, cg.language
     FROM child ch
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     WHERE ch.childID = ?`,
    [childID]
  );
  return rows[0] || null;
}

async function getChildrenByCaregiver(caregiverID) {
  const [rows] = await db.execute(
    'SELECT * FROM child WHERE caregiverID = ? ORDER BY dob', [caregiverID]
  );
  return rows;
}

module.exports = {
  createCaregiver, getCaregiverByPhone, getAllCaregivers, updateCaregiverContact,
  createChild, getChild, getChildrenByCaregiver,
  registerPatient, getAllChildren,
};
