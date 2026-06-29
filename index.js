'use strict';
const express  = require('express');
const router   = express.Router();

const auth         = require('../modules/auth/authModule');
const reg          = require('../modules/registration/registrationModule');
const sched        = require('../modules/scheduling/schedulingModule');
const vacc         = require('../modules/vaccination/vaccinationModule');
const reporting    = require('../modules/reporting/reportingModule');
const config       = require('../modules/admin/configModule');
const reminder     = require('../modules/reminder/reminderModule');
const { handleInboundSMS } = require('../modules/response/responseModule');

// Helper: resolve the acting user's facility (null for admins / unset)
const sessFacility = (req) => (req.session.user && req.session.user.facility) || null;
//
// AUTH ROUTES
//

// POST /auth/login
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await auth.login(username, password, req.ip);
    req.session.user = user;
    res.json({ success: true, user });
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

// POST /auth/logout
router.post('/auth/logout', auth.requireLogin, (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// POST /auth/forgot-password — Wf1 reset panel (records request, no email sent)
router.post('/auth/forgot-password', async (req, res) => {
  try {
    const result = await auth.requestPasswordReset(req.body.identifier, req.ip);
    res.json(result);
  } catch (err) {
    // Always respond generically — never disclose whether the account exists
    res.json({ message: 'If the account exists, a reset link has been sent to the registered email.' });
  }
});

// GET /auth/me — current session user (for dashboard bootstrap)
router.get('/auth/me', auth.requireLogin, (req, res) => {
  res.json({ user: req.session.user });
});

//
// ADMIN ROUTES

// POST /admin/users — create user account
router.post('/admin/users',
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      await auth.createUser(req.session.user.userID, req.body, req.ip);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /admin/users — list all user accounts (Wf6)
router.get('/admin/users',
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      const users = await auth.listUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PATCH /admin/users/:userID/deactivate
router.patch('/admin/users/:userID/deactivate',
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      await auth.setUserActive(req.session.user.userID, req.params.userID, false, req.ip);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PATCH /admin/users/:userID/activate
router.patch('/admin/users/:userID/activate',
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      await auth.setUserActive(req.session.user.userID, req.params.userID, true, req.ip);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /admin/overview — admin panel stat tiles (Wf6)
router.get('/admin/overview',
  auth.requireRole('admin'),
  async (req, res) => {
    try { res.json(await reporting.getAdminOverview()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// GET/PUT /admin/settings — SMS gateway config (FR-43)
router.get('/admin/settings',
  auth.requireRole('admin'),
  async (req, res) => {
    try { res.json(await config.getAllSettings()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  }
);
router.put('/admin/settings',
  auth.requireRole('admin'),
  async (req, res) => {
    try { res.json(await config.updateSettings(req.session.user.userID, req.body, req.ip)); }
    catch (err) { res.status(400).json({ error: err.message }); }
  }
);

// GET/PUT /admin/templates — editable SMS templates (FR-44)
router.get('/admin/templates',
  auth.requireRole('admin'),
  async (req, res) => {
    try { res.json(await config.getAllTemplates()); }
    catch (err) { res.status(500).json({ error: err.message }); }
  }
);
router.put('/admin/templates/:templateID',
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      await config.updateTemplate(req.session.user.userID, req.params.templateID, req.body.body, req.ip);
      res.json({ success: true });
    } catch (err) {
      const code = err.message === 'TEMPLATE_NOT_FOUND' ? 404 : 400;
      res.status(code).json({ error: err.message });
    }
  }
);

// GET /admin/audit-log
router.get('/admin/audit-log',
  auth.requireRole('admin'),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const logs  = await reporting.getAuditLog(req.session.user.userID, limit);
      res.json(logs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// REGISTRATION ROUTES

// POST /caregivers — register caregiver
router.post('/caregivers',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try {
      const id = await reg.createCaregiver(
        req.session.user.userID, req.body, req.ip
      );
      res.status(201).json({ caregiverID: id });
    } catch (err) {
      const code = err.message === 'DUPLICATE_PHONE' ? 409 : 400;
      res.status(code).json({ error: err.message });
    }
  }
);

// GET /caregivers — list all
router.get('/caregivers',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const data = await reg.getAllCaregivers();
    res.json(data);
  }
);

// GET /caregivers/:id/children — list children for one caregiver
router.get('/caregivers/:id/children',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const data = await reg.getChildrenByCaregiver(req.params.id);
    res.json(data);
  }
);

// PATCH /caregivers/:id — update contact
router.patch('/caregivers/:id',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try {
      await reg.updateCaregiverContact(
        req.session.user.userID, req.params.id, req.body, req.ip
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// POST /patients — combined caregiver + child registration (Wf2, provider)
router.post('/patients',
  auth.requireRole('provider'),
  async (req, res) => {
    try {
      const { caregiver, child, facilityID } = req.body;
      const result = await reg.registerPatient(
        req.session.user.userID, caregiver, child,
        facilityID || sessFacility(req), req.ip
      );
      res.status(201).json(result);
    } catch (err) {
      const code = err.message === 'DUPLICATE_CHILD' ? 409 : 400;
      res.status(code).json({ error: err.message });
    }
  }
);

// GET /children?q= — list / search all children (Schedules, Dashboard)
router.get('/children',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try { res.json(await reg.getAllChildren(req.query.q || '')); }
    catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// GET /children/:id — single child detail
router.get('/children/:id',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const child = await reg.getChild(req.params.id);
    if (!child) return res.status(404).json({ error: 'Child not found' });
    res.json(child);
  }
);

// POST /children — register child + auto-generate KEPI schedule
router.post('/children',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try {
      const { caregiverID, name, dob, gender, facilityID } = req.body;
      const childID = await reg.createChild(
        req.session.user.userID, caregiverID,
        { name, dob, gender }, facilityID, req.ip
      );
      res.status(201).json({ childID });
    } catch (err) {
      const code = err.message === 'DUPLICATE_CHILD' ? 409 : 400;
      res.status(code).json({ error: err.message });
    }
  }
);

// GET /children/:id/schedule
router.get('/children/:id/schedule',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const schedule = await sched.getChildSchedule(req.params.id);
    res.json(schedule);
  }
);

// GET /children/:id/vaccinations
router.get('/children/:id/vaccinations',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const history = await vacc.getChildVaccinationHistory(req.params.id);
    res.json(history);
  }
);

//
// APPOINTMENT ROUTES

// POST /appointments — book a single appointment
router.post('/appointments',
  auth.requireRole('provider'),
  async (req, res) => {
    try {
      const { childID, apptDate, vaccineType, facilityID } = req.body;
      const apptID = await sched.bookAppointment(
        req.session.user.userID, childID,
        { apptDate, vaccineType, facilityID }, req.ip
      );
      res.status(201).json({ apptID });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// PATCH /appointments/:id/reschedule
router.patch('/appointments/:id/reschedule',
  auth.requireRole('provider'),
  async (req, res) => {
    try {
      await sched.rescheduleAppointment(
        req.session.user.userID, req.params.id, req.body.newDate, req.ip
      );
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

// GET /appointments/defaulters — for provider dashboard
router.get('/appointments/defaulters',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const defaulters = await sched.getOverdueAppointments();
    res.json(defaulters);
  }
);

// GET /appointments/today — today's appointments w/ reply + record status (Wf4)
router.get('/appointments/today',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try { res.json(await sched.getTodaysAppointments(sessFacility(req))); }
    catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// GET /appointments/:id/sms-preview — multi-lingual reminder preview (Wf3)
router.get('/appointments/:id/sms-preview',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try {
      const appt = await sched.getAppointmentDetail(req.params.id);
      if (!appt) return res.status(404).json({ error: 'Appointment not found' });
      const tpl  = await reminder.resolveTemplate(appt.language, '48hr');
      const message = reminder.formatMessage(tpl, {
        caregiverName: appt.caregiverName, childName: appt.childName,
        vaccineType: appt.vaccineType, apptDate: appt.apptDate,
        facility: appt.facilityID,
      });
      res.json({ language: appt.language, message, length: message.length });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// GET /dashboard/stats — provider dashboard tiles (Wf4)
router.get('/dashboard/stats',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try { res.json(await reporting.getDashboardStats(sessFacility(req))); }
    catch (err) { res.status(500).json({ error: err.message }); }
  }
);

//
// VACCINATION RECORD ROUTES

// POST /vaccinations — record a vaccination
router.post('/vaccinations',
  auth.requireRole('provider'),
  async (req, res) => {
    try {
      const { apptID, ...data } = req.body;
      const recordID = await vacc.recordVaccination(
        req.session.user.userID, apptID, data, req.ip
      );
      res.status(201).json({ recordID });
    } catch (err) {
      const code = err.message.includes('ALREADY') ? 409 : 400;
      res.status(code).json({ error: err.message });
    }
  }
);

// GET /vaccinations/:apptID
router.get('/vaccinations/:apptID',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const record = await vacc.getVaccinationRecord(req.params.apptID);
    if (!record) return res.status(404).json({ error: 'Record not found' });
    res.json(record);
  }
);

//
// REPORTING ROUTES


// GET /reports/coverage?facilityID=x&startDate=x&endDate=x
router.get('/reports/coverage',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try {
      const data = await reporting.getCoverageReport(
        req.session.user.userID, req.query
      );
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /reports/defaulters?facilityID=x
router.get('/reports/defaulters',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const data = await reporting.getDefaulterReport(
      req.session.user.userID, req.query.facilityID
    );
    res.json(data);
  }
);

// GET /reports/defaulters/export — CSV download
router.get('/reports/defaulters/export',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    try {
      const data   = await reporting.getDefaulterReport(
        req.session.user.userID, req.query.facilityID
      );
      const csv    = reporting.exportCSV(data, reporting.defaulterCSVFields());
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="defaulters.csv"');
      res.send(csv);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /reports/sms-log?facilityID=x&startDate=x&endDate=x
router.get('/reports/sms-log',
  auth.requireRole('admin','provider'),
  async (req, res) => {
    const data = await reporting.getSMSDeliveryLog(
      req.session.user.userID, req.query
    );
    res.json(data);
  }
);


// SMS GATEWAY WEBHOOK
// 

// POST /sms/incoming — Africa's Talking inbound webhook
router.post('/sms/incoming', async (req, res) => {
  try {
    const { from, text } = req.body;
    await handleInboundSMS(from, text);
    res.sendStatus(200);
  } catch (err) {
    console.error('[WEBHOOK] Error handling inbound SMS:', err.message);
    res.sendStatus(200); // Always 200 to gateway — do not retry
  }
});

module.exports = router;
