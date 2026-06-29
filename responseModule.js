'use strict';
const db                  = require('../../config/db');
const { logAudit }        = require('../../utils/audit');
const { flagAsDefaulter } = require('../scheduling/schedulingModule');
const { sendConfirmationSMS } = require('../reminder/reminderModule');

/*
 * Parse an inbound SMS keyword from a caregiver.
 * Called by the /sms/incoming webhook from Africa's Talking.
 *
 * @param {string} from  - Caregiver phone number 
 * @param {string} text  - Raw SMS body
 * @param {string} date  - Timestamp from gateway
 */
async function handleInboundSMS(from, text) {
  const keyword = text.trim().toUpperCase().split(' ')[0]; // handle extra words

  // Find the most recent upcoming appointment for this phone number
  const [appts] = await db.execute(
    `SELECT a.apptID, a.apptDate, a.vaccineType, a.facilityID,
            cg.name AS caregiverName, cg.phone, cg.language,
            ch.name AS childName
     FROM appointment a
     JOIN child ch     ON a.childID      = ch.childID
     JOIN caregiver cg ON ch.caregiverID = cg.caregiverID
     WHERE cg.phone = ?
       AND a.status  = 'scheduled'
     ORDER BY a.apptDate ASC
     LIMIT 1`,
    [from]
  );

  if (!appts.length) {
    console.log(`[RESPONSE] No scheduled appointment found for ${from}`);
    return;
  }

  const appt = appts[0];

  // Log inbound SMS
  await db.execute(
    `INSERT INTO sms_log
     (logID, apptID, message, deliveryStatus, direction)
     VALUES (UUID(), ?, ?, 'delivered', 'in')`,
    [appt.apptID, text]
  );

  // Route by keyword
  switch (keyword) {
    case 'YES':
      // Appointment confirmed — status stays 'scheduled' until provider records vaccination
      await logAudit('SYSTEM',
        `Caregiver confirmed appointment ${appt.apptID} via SMS`
      );
      await sendConfirmationSMS(from, appt);
      console.log(`[RESPONSE] YES received for appt ${appt.apptID}`);
      break;

    case 'NO':
      // Caregiver declining — flag as defaulter
      await flagAsDefaulter(appt.apptID);
      await logAudit('SYSTEM',
        `Caregiver declined appointment ${appt.apptID} — flagged as missed`
      );
      console.log(`[RESPONSE] NO received — appt ${appt.apptID} flagged as missed`);
      break;

    case 'RESCHEDULE':
      // Mark for provider action — provider sets new date via dashboard
      await db.execute(
        `INSERT INTO sms_log
         (logID, apptID, message, deliveryStatus, direction)
         VALUES (UUID(), ?, 'Caregiver requested reschedule', 'delivered', 'in')`,
        [appt.apptID]
      );
      await logAudit('SYSTEM',
        `Caregiver requested reschedule for appointment ${appt.apptID}`
      );
      // Notify provider (stored for dashboard pickup)
      await db.execute(
        `UPDATE appointment SET status = 'scheduled' WHERE apptID = ?`,
        [appt.apptID]
      );
      console.log(`[RESPONSE] RESCHEDULE requested for appt ${appt.apptID}`);
      break;

    default:
      // Unknown keyword — log but take no action
      await logAudit('SYSTEM',
        `Unknown SMS keyword '${keyword}' from ${from} for appt ${appt.apptID}`
      );
      console.log(`[RESPONSE] Unknown keyword '${keyword}' from ${from}`);
  }
}

module.exports = { handleInboundSMS };
