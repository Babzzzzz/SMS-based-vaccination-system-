'use strict';
const db           = require('../../config/db');
const { logAudit } = require('../../utils/audit');
const { Parser }   = require('json2csv');
const config       = require('../admin/configModule');

// ── 0a. Provider dashboard stats (Wf4)
async function getDashboardStats(facilityID = null) {
  const fid = facilityID || null;

  const [[today]] = await db.execute(
    `SELECT
       COUNT(*) AS appointmentsToday,
       SUM(EXISTS (SELECT 1 FROM sms_log sl
                    WHERE sl.apptID = a.apptID AND sl.direction = 'in'
                      AND UPPER(TRIM(sl.message)) LIKE 'YES%')) AS confirmedToday
     FROM appointment a
     WHERE DATE(a.apptDate) = CURDATE()
       AND (? IS NULL OR a.facilityID = ?)`,
    [fid, fid]);

  const [[defaulters]] = await db.execute(
    `SELECT COUNT(*) AS defaultersThisMonth
     FROM appointment a
     WHERE a.status = 'missed'
       AND YEAR(a.apptDate) = YEAR(CURDATE())
       AND MONTH(a.apptDate) = MONTH(CURDATE())
       AND (? IS NULL OR a.facilityID = ?)`,
    [fid, fid]);

  const [[sms]] = await db.execute(
    `SELECT
       COUNT(*) AS totalOut,
       SUM(sl.deliveryStatus = 'delivered') AS delivered,
       SUM(sl.deliveryStatus = 'failed')    AS failed
     FROM sms_log sl
     JOIN appointment a ON sl.apptID = a.apptID
     WHERE sl.direction = 'out'
       AND YEAR(sl.timestamp) = YEAR(CURDATE())
       AND MONTH(sl.timestamp) = MONTH(CURDATE())
       AND (? IS NULL OR a.facilityID = ?)`,
    [fid, fid]);

  const totalOut = Number(sms.totalOut || 0);
  const deliveryRate = totalOut ? Math.round((Number(sms.delivered || 0) / totalOut) * 100) : 0;

  return {
    appointmentsToday:  Number(today.appointmentsToday || 0),
    confirmedToday:     Number(today.confirmedToday || 0),
    defaultersThisMonth:Number(defaulters.defaultersThisMonth || 0),
    smsDeliveryRate:    deliveryRate,
    smsFailed:          Number(sms.failed || 0),
  };
}

// Admin overview stats (Wf6) 
async function getAdminOverview() {
  const [[users]]  = await db.execute(
    `SELECT SUM(isActive = 1) AS activeUsers, COUNT(*) AS totalUsers FROM user`);
  const [[sms]]    = await db.execute(
    `SELECT COUNT(*) AS dispatchedThisMonth,
            SUM(deliveryStatus = 'delivered') AS delivered
     FROM sms_log
     WHERE direction = 'out'
       AND YEAR(timestamp) = YEAR(CURDATE())
       AND MONTH(timestamp) = MONTH(CURDATE())`);
  const dispatched = Number(sms.dispatchedThisMonth || 0);
  const deliveryRate = dispatched ? Math.round((Number(sms.delivered || 0) / dispatched) * 100) : 0;
  const gatewayStatus = await config.getSetting('gateway_status', 'online');
  return {
    activeUsers:        Number(users.activeUsers || 0),
    totalUsers:         Number(users.totalUsers || 0),
    smsDispatchedMonth: dispatched,
    smsDeliveryRate:    deliveryRate,
    gatewayStatus,
  };
}

//  Vaccination Coverage Report 
async function getCoverageReport(userID, { facilityID, startDate, endDate, vaccineType }) {
  const vt = vaccineType && vaccineType !== 'all' ? vaccineType : null;
  const [summary] = await db.execute(
    `SELECT
       COUNT(DISTINCT ch.childID)                                AS totalRegistered,
       COUNT(DISTINCT vr.recordID)                              AS totalVaccinated,
       COUNT(DISTINCT CASE WHEN a.status='missed'
             THEN a.apptID END)                                 AS totalDefaulters,
       ROUND(
         COUNT(DISTINCT vr.recordID) * 100.0 /
         NULLIF(COUNT(DISTINCT ch.childID), 0), 1
       )                                                        AS coveragePct
     FROM child ch
     JOIN appointment a  ON ch.childID  = a.childID
     LEFT JOIN vaccination_record vr ON a.apptID = vr.apptID
     WHERE a.facilityID = ?
       AND a.apptDate BETWEEN ? AND ?
       AND (? IS NULL OR a.vaccineType = ?)`,
    [facilityID, startDate, endDate, vt, vt]
  );

  const [byVaccine] = await db.execute(
    `SELECT a.vaccineType,
            COUNT(a.apptID)     AS scheduled,
            COUNT(vr.recordID)  AS administered,
            ROUND(COUNT(vr.recordID) * 100.0 / COUNT(a.apptID), 1) AS pct
     FROM appointment a
     LEFT JOIN vaccination_record vr ON a.apptID = vr.apptID
     WHERE a.facilityID = ? AND a.apptDate BETWEEN ? AND ?
       AND (? IS NULL OR a.vaccineType = ?)
     GROUP BY a.vaccineType
     ORDER BY a.vaccineType`,
    [facilityID, startDate, endDate, vt, vt]
  );

  // Save report record
  await db.execute(
    `INSERT INTO report (reportID, generatedByID, type, data)
     VALUES (UUID(), ?, 'coverage', ?)`,
    [userID, JSON.stringify({ summary: summary[0], byVaccine })]
  );
  await logAudit(userID, `Generated coverage report for facility ${facilityID}`);

  return { summary: summary[0], byVaccine };
}

//  Defaulter Report 
async function getDefaulterReport(userID, facilityID) {
  const [rows] = await db.execute(
    `SELECT
       ch.childID, ch.name AS childName, ch.dob,
       cg.name AS caregiverName, cg.phone,
       a.apptID, a.apptDate, a.vaccineType,
       DATEDIFF(CURDATE(), a.apptDate) AS daysOverdue,
       MAX(sl.timestamp)              AS lastSMSSent
     FROM appointment a
     JOIN child ch     ON a.childID      = ch.childID
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     LEFT JOIN sms_log sl ON a.apptID   = sl.apptID AND sl.direction = 'out'
     WHERE a.status = 'missed'
       AND a.facilityID = ?
     GROUP BY a.apptID
     ORDER BY daysOverdue DESC`,
    [facilityID]
  );
  await logAudit(userID, `Generated defaulter report for facility ${facilityID}`);
  return rows;
}

//  SMS Delivery Log 
async function getSMSDeliveryLog(userID, { facilityID, startDate, endDate }) {
  const [rows] = await db.execute(
    `SELECT sl.logID, sl.timestamp, sl.message,
            sl.deliveryStatus, sl.direction, sl.retryCount,
            cg.name AS caregiverName, cg.phone,
            a.vaccineType, a.apptDate,
            ch.name AS childName
     FROM sms_log sl
     JOIN appointment a  ON sl.apptID      = a.apptID
     JOIN child ch       ON a.childID      = ch.childID
     JOIN caregiver cg   ON ch.caregiverID = cg.caregiverID
     WHERE a.facilityID = ?
       AND sl.timestamp BETWEEN ? AND ?
     ORDER BY sl.timestamp DESC`,
    [facilityID, startDate, endDate]
  );

  const delivered  = rows.filter(r => r.deliveryStatus === 'delivered').length;
  const failed     = rows.filter(r => r.deliveryStatus === 'failed').length;
  const total      = rows.length;
  const deliveryRate = total
    ? ((delivered / total) * 100).toFixed(1) + '%'
    : '0%';

  await logAudit(userID, `Viewed SMS delivery log for facility ${facilityID}`);
  return { rows, summary: { total, delivered, failed, deliveryRate } };
}

// Audit Log Report (Admin only)
async function getAuditLog(adminUserID, limit = 100) {
  // LIMIT can't be a bound parameter in mysql2 prepared statements, so we
  // sanitise it to a safe integer and interpolate it directly.
  const lim = Math.max(1, Math.min(1000, parseInt(limit, 10) || 100));
  const [rows] = await db.execute(
    `SELECT al.logID, al.action, al.timestamp, al.ipAddress,
            u.username, u.roleType
     FROM audit_log al
     JOIN user u ON al.userID = u.userID
     ORDER BY al.timestamp DESC
     LIMIT ${lim}`
  );
  await logAudit(adminUserID, `Viewed audit log (limit: ${lim})`);
  return rows;
}

//  CSV Export helper 
function exportCSV(data, fields) {
  const parser = new Parser({ fields });
  return parser.parse(data);
}

function defaulterCSVFields() {
  return [
    'childID','childName','caregiverName','phone',
    'vaccineType','apptDate','daysOverdue','lastSMSSent'
  ];
}

module.exports = {
  getDashboardStats,
  getAdminOverview,
  getCoverageReport,
  getDefaulterReport,
  getSMSDeliveryLog,
  getAuditLog,
  exportCSV,
  defaulterCSVFields,
};
