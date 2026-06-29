'use strict';
const db           = require('../../config/db');
const { logAudit } = require('../../utils/audit');

/* 
   System configuration 
   Backs the Admin → SMS Gateway and Templates panels (Wf6).
   - system_setting : key/value gateway + reminder config
   - sms_template   : editable multi-lingual message templates
   Reminder dispatch reads from these tables, falling back to
   sensible defaults if the row is missing.
   */

const SETTING_DEFAULTS = {
  at_provider:           "Africa's Talking",
  sender_id:             process.env.AT_SENDER_ID || 'VACC-KE',
  reminder_hours_first:  process.env.REMINDER_HOURS_FIRST  || '48',
  reminder_hours_second: process.env.REMINDER_HOURS_SECOND || '24',
  sms_max_retries:       process.env.SMS_MAX_RETRIES       || '3',
  gateway_status:        'online',
};

//  Settings 
async function getSetting(key, fallback = null) {
  try {
    const [rows] = await db.execute(
      'SELECT settingValue FROM system_setting WHERE settingKey = ?', [key]);
    if (rows.length) return rows[0].settingValue;
  } catch (_) { /* table may not exist yet */ }
  return fallback !== null ? fallback : (SETTING_DEFAULTS[key] ?? null);
}

async function getAllSettings() {
  const merged = { ...SETTING_DEFAULTS };
  try {
    const [rows] = await db.execute('SELECT settingKey, settingValue FROM system_setting');
    for (const r of rows) merged[r.settingKey] = r.settingValue;
  } catch (_) {}
  return merged;
}

const ALLOWED_SETTINGS = new Set(Object.keys(SETTING_DEFAULTS));

async function updateSettings(adminUserID, patch, ip) {
  const keys = Object.keys(patch).filter(k => ALLOWED_SETTINGS.has(k));
  for (const k of keys) {
    await db.execute(
      `INSERT INTO system_setting (settingKey, settingValue) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE settingValue = VALUES(settingValue)`,
      [k, String(patch[k])]);
  }
  await logAudit(adminUserID, `Updated SMS gateway settings: ${keys.join(', ')}`, ip);
  return getAllSettings();
}

//  Templates 
async function getAllTemplates() {
  const [rows] = await db.execute(
    'SELECT templateID, language, templateType, body, updatedAt FROM sms_template ORDER BY language, templateType');
  return rows;
}

async function getTemplateBody(language, templateType) {
  try {
    const [rows] = await db.execute(
      'SELECT body FROM sms_template WHERE language = ? AND templateType = ?',
      [language, templateType]);
    if (rows.length) return rows[0].body;
    // fall back to English of the same type
    const [en] = await db.execute(
      'SELECT body FROM sms_template WHERE language = ? AND templateType = ?',
      ['en', templateType]);
    if (en.length) return en[0].body;
  } catch (_) {}
  return null;
}

async function updateTemplate(adminUserID, templateID, body, ip) {
  const [res] = await db.execute(
    'UPDATE sms_template SET body = ? WHERE templateID = ?', [body, templateID]);
  if (!res.affectedRows) throw new Error('TEMPLATE_NOT_FOUND');
  await logAudit(adminUserID, `Updated SMS template ${templateID}`, ip);
}

module.exports = {
  getSetting, getAllSettings, updateSettings,
  getAllTemplates, getTemplateBody, updateTemplate,
};
