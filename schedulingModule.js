'use strict';
const db           = require('../../config/db');
const { logAudit } = require('../../utils/audit');

// WHO KEPI vaccination schedule — weeks from date of birth
const KEPI_SCHEDULE = [
  { vaccine: 'BCG + OPV 0',              weeksFromDOB: 0  },
  { vaccine: 'Penta 1 + OPV 1 + PCV 1', weeksFromDOB: 6  },
  { vaccine: 'Penta 2 + OPV 2 + PCV 2', weeksFromDOB: 10 },
  { vaccine: 'Penta 3 + OPV 3 + PCV 3', weeksFromDOB: 14 },
  { vaccine: 'Measles 1 + Yellow fever', weeksFromDOB: 39 },
  { vaccine: 'Measles 2 + Rubella',      weeksFromDOB: 78 },
];

function addWeeks(date, weeks) {
  const d = new Date(date);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split('T')[0];
}

//  Auto-generate KEPI schedule
async function generateKEPISchedule(userID, childID, dob, facilityID, ip) {
  const appointments = [];
  for (const slot of KEPI_SCHEDULE) {
    const apptDate = addWeeks(dob, slot.weeksFromDOB);
    await db.execute(
      `INSERT INTO appointment
       (apptID, childID, facilityID, apptDate, vaccineType, status)
       VALUES (UUID(), ?, ?, ?, ?, 'scheduled')`,
      [childID, facilityID, apptDate, slot.vaccine]
    );
    appointments.push({ apptDate, vaccine: slot.vaccine });
  }
  await logAudit(userID,
    `Generated KEPI schedule for child ${childID} — ${appointments.length} appointments`,
    ip
  );
  return appointments;
}

// Book a single appointment 
async function bookAppointment(userID, childID, { apptDate, vaccineType, facilityID }, ip) {
  await db.execute(
    `INSERT INTO appointment
     (apptID, childID, facilityID, apptDate, vaccineType, status)
     VALUES (UUID(), ?, ?, ?, ?, 'scheduled')`,
    [childID, facilityID, apptDate, vaccineType]
  );
  const [rows] = await db.execute(
    `SELECT apptID FROM appointment
     WHERE childID = ? AND apptDate = ? AND vaccineType = ?
     ORDER BY createdAt DESC LIMIT 1`,
    [childID, apptDate, vaccineType]
  );
  const apptID = rows[0].apptID;
  await logAudit(userID, `Booked appointment ${apptID} for child ${childID}`, ip);
  return apptID;
}

//Reschedule an appointment 
async function rescheduleAppointment(userID, apptID, newDate, ip) {
  await db.execute(
    `UPDATE appointment SET apptDate = ?, status = 'scheduled'
     WHERE apptID = ?`,
    [newDate, apptID]
  );
  await logAudit(userID, `Rescheduled appointment ${apptID} to ${newDate}`, ip);
}

// Confirm attendance 
async function confirmAttendance(apptID) {
  await db.execute(
    "UPDATE appointment SET status = 'done' WHERE apptID = ?", [apptID]
  );
}

// Get full schedule for a child 
async function getChildSchedule(childID) {
  const [rows] = await db.execute(
    `SELECT a.apptID, a.apptDate, a.vaccineType, a.status,
            vr.recordID, vr.dateAdministered, vr.batchNumber,
            vr.administeringProvider
     FROM appointment a
     LEFT JOIN vaccination_record vr ON a.apptID = vr.apptID
     WHERE a.childID = ?
     ORDER BY a.apptDate`,
    [childID]
  );
  return rows;
}

// Defaulter detection — called by cron 
async function getOverdueAppointments() {
  const [rows] = await db.execute(
    `SELECT a.apptID, a.apptDate, a.vaccineType,
            ch.childID, ch.name AS childName,
            cg.caregiverID, cg.name AS caregiverName,
            cg.phone, cg.language,
            DATEDIFF(CURDATE(), a.apptDate) AS daysOverdue
     FROM appointment a
     JOIN child ch     ON a.childID      = ch.childID
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     WHERE a.status = 'scheduled'
       AND a.apptDate < CURDATE()
     ORDER BY daysOverdue DESC`
  );
  return rows;
}

async function flagAsDefaulter(apptID) {
  await db.execute(
    "UPDATE appointment SET status = 'missed' WHERE apptID = ?", [apptID]
  );
}

// Today's appointments (provider dashboard (Wf4)) 
//  Returns each of today's appointments with the caregiver's latest inbound
//  SMS reply (YES / NO / RESCHEDULE) and whether a record has been captured.
async function getTodaysAppointments(facilityID = null) {
  const [rows] = await db.execute(
    `SELECT a.apptID, a.apptDate, a.vaccineType, a.status, a.facilityID,
            ch.childID, ch.name AS childName,
            cg.name AS caregiverName, cg.phone,
            vr.recordID,
            (SELECT sl.message FROM sms_log sl
               WHERE sl.apptID = a.apptID AND sl.direction = 'in'
               ORDER BY sl.timestamp DESC LIMIT 1) AS lastReply
     FROM appointment a
     JOIN child ch     ON a.childID      = ch.childID
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     LEFT JOIN vaccination_record vr ON a.apptID = vr.apptID
     WHERE DATE(a.apptDate) = CURDATE()
       AND (? IS NULL OR a.facilityID = ?)
     ORDER BY a.apptDate`,
    [facilityID, facilityID]
  );
  return rows.map(r => ({
    ...r,
    reply: parseReply(r.lastReply),
    recorded: !!r.recordID,
  }));
}

// Single appointment with caregiver/child context (for SMS preview, Wf3)
async function getAppointmentDetail(apptID) {
  const [rows] = await db.execute(
    `SELECT a.apptID, a.apptDate, a.vaccineType, a.facilityID, a.status,
            ch.childID, ch.name AS childName,
            cg.caregiverID, cg.name AS caregiverName, cg.phone, cg.language
     FROM appointment a
     JOIN child ch     ON a.childID      = ch.childID
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     WHERE a.apptID = ?`,
    [apptID]);
  return rows[0] || null;
}

function parseReply(text) {
  if (!text) return null;
  const kw = String(text).trim().toUpperCase().split(/\s+/)[0];
  if (kw === 'YES')        return 'YES';
  if (kw === 'NO')         return 'NO';
  if (kw === 'RESCHEDULE') return 'RESCHEDULE';
  return null;
}

module.exports = {
  KEPI_SCHEDULE,
  generateKEPISchedule,
  bookAppointment,
  rescheduleAppointment,
  confirmAttendance,
  getChildSchedule,
  getOverdueAppointments,
  flagAsDefaulter,
  getTodaysAppointments,
  getAppointmentDetail,
};
