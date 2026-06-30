'use strict';
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors    = require('cors');
const path    = require('path');

// Initialise app 
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Session (NFR-01 Security — 30-min timeout) ───────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'dev-secret-change-this',
  resave:            false,
  saveUninitialized: false,
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   30 * 60 * 1000,   // 30 minutes
  },
}));

// API routes 
app.use('/api', require('./routes/index'));

//  Serve frontend for all non-API routes 
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server and cron jobs 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[SERVER] VaccSystem running on port ${PORT}`);
  // Cron jobs start automatically when reminderModule is loaded
  require('./modules/reminder/reminderModule');
  console.log('[CRON] Reminder scheduler active');
});

module.exports = app; // for testing
