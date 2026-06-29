'use strict';
const db                  = require('../../config/db');
const { logAudit }        = require('../../utils/audit');
const { confirmAttendance } = require('../scheduling/schedulingModule');

/**
 * Record a completed vaccination — creates a VaccinationRecord
 * linked to the appointment and updates appointment.status to 'done'.
 */
async function recordVaccination(providerUserID, apptID, {
  vaccineType,
  doseNumber,
  dateAdministered,
  batchNumber,
  administeringProvider,
  notes = '',
}, ip) {
  // Check appointment exists and is still scheduled
  const [appts] = await db.execute(
    "SELECT apptID, status FROM appointment WHERE apptID = ?", [apptID]
  );
  if (!appts.length)         throw new Error('APPOINTMENT_NOT_FOUND');
  if (appts[0].status === 'done') throw new Error('VACCINATION_ALREADY_RECORDED');

  // Check record doesn't already exist
  const [existing] = await db.execute(
    'SELECT recordID FROM vaccination_record WHERE apptID = ?', [apptID]
  );
  if (existing.length) throw new Error('VACCINATION_ALREADY_RECORDED');

  await db.execute(
    `INSERT INTO vaccination_record
     (recordID, apptID, providerID, vaccineType, doseNumber,
      dateAdministered, batchNumber, administeringProvider, notes)
     VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [apptID, providerUserID, vaccineType, doseNumber,
     dateAdministered, batchNumber, administeringProvider, notes]
  );

  // Mark appointment as done
  await confirmAttendance(apptID);

  const [rec] = await db.execute(
    'SELECT recordID FROM vaccination_record WHERE apptID = ?', [apptID]
  );
  const recordID = rec[0].recordID;

  await logAudit(providerUserID,
    `Recorded vaccination ${recordID} — batch ${batchNumber} — appt ${apptID}`, ip
  );
  return recordID;
}

async function getVaccinationRecord(apptID) {
  const [rows] = await db.execute(
    `SELECT vr.*, u.username AS providerUsername
     FROM vaccination_record vr
     JOIN user u ON vr.providerID = u.userID
     WHERE vr.apptID = ?`,
    [apptID]
  );
  return rows[0] || null;
}

async function updateVaccinationNotes(providerUserID, recordID, notes, ip) {
  await db.execute(
    'UPDATE vaccination_record SET notes = ? WHERE recordID = ?',
    [notes, recordID]
  );
  await logAudit(providerUserID, `Updated notes for vaccination record ${recordID}`, ip);
}

// Get all vaccination records for a child (vaccination history)
async function getChildVaccinationHistory(childID) {
  const [rows] = await db.execute(
    `SELECT vr.recordID, vr.vaccineType, vr.doseNumber,
            vr.dateAdministered, vr.batchNumber,
            vr.administeringProvider, vr.notes,
            a.apptDate, a.apptID
     FROM vaccination_record vr
     JOIN appointment a ON vr.apptID = a.apptID
     WHERE a.childID = ?
     ORDER BY vr.dateAdministered`,
    [childID]
  );
  return rows;
}

module.exports = {
  recordVaccination,
  getVaccinationRecord,
  updateVaccinationNotes,
  getChildVaccinationHistory,
};
