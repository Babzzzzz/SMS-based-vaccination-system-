'use strict';
require('dotenv').config();
const cron         = require('node-cron');
const db           = require('../../config/db');
const { logAudit } = require('../../utils/audit');
const config       = require('../admin/configModule');
const { getOverdueAppointments, flagAsDefaulter } = require('../scheduling/schedulingModule');

// SMS Gateway setup
// Only initialise the real Africa's Talking gateway when an API key is
// configured. Without one (e.g. local/demo runs) we fall back to an
// offline gateway that logs messages instead of sending them, so the app
// still boots and works end to end.
let smsGateway;
if (process.env.AT_API_KEY) {
  const AfricasTalking = require('africastalking');
  const at = AfricasTalking({
    apiKey:   process.env.AT_API_KEY,
    username: process.env.AT_USERNAME || 'vacc-ke',
  });
  smsGateway = at.SMS;
} else {
  console.warn('[SMS] AT_API_KEY not set — gateway running in offline (log-only) mode.');
  smsGateway = {
    send: async ({ to, message }) => {
      console.log(`[SMS:offline] to=${to} :: ${message}`);
      return { offline: true };
    },
  };
}

//  Message templates (multi-lingual) 
const TEMPLATES = {
  sw: {
    '48hr':   'Karibu {name}. Kumbusho: {child} ana chanjo ya {vaccine} tarehe {date}, {facility}. Jibu YES kuthibitisha, NO, au RESCHEDULE. — VaccKE',
    '24hr':   'Kumbusho la mwisho: {child} ana chanjo kesho tarehe {date}. Jibu YES, NO, au RESCHEDULE. — VaccKE',
    followup: 'Habari {name}. Tunaona {child} hakufika kwa chanjo ya {vaccine}. Tafadhali wasiliana nasi. — VaccKE',
    confirm:  'Asante {name}. Tumethibitisha miadi ya {child} kwa {vaccine} tarehe {date}. — VaccKE',
  },
  en: {
    '48hr':   'Dear {name}, reminder: {child} has a {vaccine} appointment on {date} at {facility}. Reply YES, NO or RESCHEDULE. — VaccKE',
    '24hr':   'Final reminder: {child} has a vaccination appointment tomorrow {date}. Reply YES, NO or RESCHEDULE. — VaccKE',
    followup: 'Dear {name}, {child} missed the {vaccine} appointment. Please contact us to reschedule. — VaccKE',
    confirm:  'Thank you {name}. We have confirmed {child}\'s {vaccine} appointment on {date}. — VaccKE',
  },
};

// In-memory fallback used when the DB template row is missing.
function getTemplate(lang, type) {
  return (TEMPLATES[lang] || TEMPLATES['en'])[type] || TEMPLATES['en'][type];
}

// Prefer the admin-editable DB template; fall back to the constant.
async function resolveTemplate(lang, type) {
  const fromDB = await config.getTemplateBody(lang, type);
  return fromDB || getTemplate(lang, type);
}

function formatMessage(template, vars) {
  return template
    .replace('{name}',     vars.caregiverName || '')
    .replace('{child}',    vars.childName     || '')
    .replace('{vaccine}',  vars.vaccineType   || '')
    .replace('{date}',     vars.apptDate
      ? new Date(vars.apptDate).toLocaleDateString('en-KE',
          { day: 'numeric', month: 'short', year: 'numeric' })
      : '')
    .replace('{facility}', vars.facility || vars.facilityID || 'the clinic');
}

// Core send function with retry logic 
async function sendSMS(phone, message, apptID, direction = 'out') {
  // A custom sender ID only works once approved (live). In the sandbox or
  // before approval it must be omitted, otherwise AT returns InvalidSenderId.
  const senderID = await config.getSetting('sender_id', process.env.AT_SENDER_ID || '');

  // Insert initial log entry
  await db.execute(
    `INSERT INTO sms_log
     (logID, apptID, message, deliveryStatus, direction, retryCount)
     VALUES (UUID(), ?, ?, 'sent', ?, 0)`,
    [apptID, message, direction]
  );

  const [logRows] = await db.execute(
    `SELECT logID FROM sms_log
     WHERE apptID = ? AND direction = ? ORDER BY timestamp DESC LIMIT 1`,
    [apptID, direction]
  );
  const logID = logRows[0].logID;

  try {
    const payload = { to: [phone], message };
    if (senderID) payload.from = senderID;   // only set when configured/approved
    await smsGateway.send(payload);
    await db.execute(
      "UPDATE sms_log SET deliveryStatus = 'delivered' WHERE logID = ?", [logID]
    );
    console.log(`[SMS] Delivered to ${phone}`);
  } catch (err) {
    await db.execute(
      "UPDATE sms_log SET deliveryStatus = 'failed' WHERE logID = ?", [logID]
    );
    console.error(`[SMS] Delivery failed for ${phone}:`, err.message);

    // Retry up to MAX_RETRIES times (configurable from Admin → SMS gateway)
    const maxRetries = parseInt(await config.getSetting('sms_max_retries', process.env.SMS_MAX_RETRIES || '3'));
    const [log]      = await db.execute(
      'SELECT retryCount FROM sms_log WHERE logID = ?', [logID]
    );
    if (log[0] && log[0].retryCount < maxRetries) {
      await db.execute(
        'UPDATE sms_log SET retryCount = retryCount + 1 WHERE logID = ?', [logID]
      );
      setTimeout(() => sendSMS(phone, message, apptID, direction), 5 * 60 * 1000);
    }
  }
}

//Dispatch due reminders — called by cron 
async function dispatchDueReminders() {
  const now   = new Date();
  const h48   = new Date(now.getTime() + 48 * 3600 * 1000);
  const h24   = new Date(now.getTime() + 24 * 3600 * 1000);

  const [appts] = await db.execute(
    `SELECT a.apptID, a.apptDate, a.vaccineType, a.facilityID,
            cg.name AS caregiverName, cg.phone, cg.language,
            ch.name AS childName
     FROM appointment a
     JOIN child ch     ON a.childID      = ch.childID
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     WHERE a.status = 'scheduled'
       AND a.apptDate BETWEEN ? AND ?
       AND a.apptID NOT IN (
         SELECT DISTINCT apptID FROM sms_log WHERE direction = 'out'
       )`,
    [now, h48]
  );

  for (const appt of appts) {
    const hoursUntil = (new Date(appt.apptDate) - now) / 3600000;
    const type       = hoursUntil > 30 ? '48hr' : '24hr';
    const template   = await resolveTemplate(appt.language, type);
    const message    = formatMessage(template, appt);
    await sendSMS(appt.phone, message, appt.apptID);
    console.log(`[REMINDER] Sent ${type} reminder for appt ${appt.apptID}`);
  }
}

// Send follow-up to defaulters 
async function sendFollowUpSMS(appt) {
  const template = await resolveTemplate(appt.language, 'followup');
  const message  = formatMessage(template, appt);
  await sendSMS(appt.phone, message, appt.apptID);
}

// Send confirmation to caregiver 
async function sendConfirmationSMS(phone, appt) {
  const template = await resolveTemplate(appt.language, 'confirm');
  const message  = formatMessage(template, appt);
  await sendSMS(phone, message, appt.apptID);
}

// Cron jobs 

// Every hour: dispatch due reminders
cron.schedule('0 * * * *', async () => {
  console.log('[CRON] Checking for due reminders...');
  await dispatchDueReminders();
});

// Every day at midnight EAT: flag defaulters + send follow-ups
// node-cron signature is schedule(expression, func, options).
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Running defaulter detection...');
  const overdue = await getOverdueAppointments();
  for (const appt of overdue) {
    await flagAsDefaulter(appt.apptID);
    await sendFollowUpSMS(appt);
    await logAudit('SYSTEM',
      `Defaulter flagged and follow-up sent: child ${appt.childID}, appt ${appt.apptID}`
    );
  }
  console.log(`[CRON] Flagged ${overdue.length} defaulters`);
}, { timezone: 'Africa/Nairobi' });

module.exports = {
  sendSMS,
  sendConfirmationSMS,
  sendFollowUpSMS,
  dispatchDueReminders,
  formatMessage,
  getTemplate,
  resolveTemplate,
};
