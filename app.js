'use strict';

// ── DOM helpers 
const $  = (sel, root = document) => root.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class')      n.className = v;
    else if (k === 'html')  n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) n.setAttribute(k, v);
  }
  for (const kid of kids.flat()) {
    if (kid == null) continue;
    n.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return n;
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-KE',
  { day:'numeric', month:'short', year:'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-KE',
  { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString('en-KE', { hour:'2-digit', minute:'2-digit' }) : '—';
const todayISO = () => new Date().toISOString().split('T')[0];
const prettyName = (u) => (u || '').replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

function ageString(dob) {
  if (!dob) return '—';
  const d = new Date(dob), now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months--;
  if (months < 0) months = 0;
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
}

// ── API 
async function api(method, path, body) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch('/api' + path, opts);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    if (res.status === 401 && state.user) logout(true);
    throw new Error((data && data.error) ? data.error : `Request failed (${res.status})`);
  }
  return data;
}

// ── Toast 
function toast(msg, kind = 'ok', title) {
  const t = el('div', { class: 'toast' + (kind === 'error' ? ' error' : '') },
    title ? el('b', {}, title) : null, msg);
  $('#toast-wrap').append(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 250); }, 3800);
}
const ok  = (m, t) => toast(m, 'ok', t);
const err = (m) => toast(m, 'error', 'Error');

// ── Modal 
function modal({ title, body, confirmText = 'Save', onConfirm }) {
  const mount = $('#modal-mount');
  const errBox = el('div', { class: 'inline-error' });
  const confirmBtn = el('button', { type: 'button' }, confirmText);
  const close = () => { mount.innerHTML = ''; };
  confirmBtn.addEventListener('click', async () => {
    errBox.textContent = ''; confirmBtn.disabled = true;
    try { await onConfirm({ close, error: (m) => { errBox.textContent = m; } }); }
    catch (e) { errBox.textContent = e.message; }
    finally { confirmBtn.disabled = false; }
  });
  const card = el('div', { class: 'modal' },
    el('div', { class: 'modal-head' }, el('h3', {}, title),
      el('button', { class: 'modal-close', onclick: close, html: '&times;' })),
    el('div', { class: 'modal-body' }, body, errBox),
    el('div', { class: 'modal-foot' },
      el('button', { class: 'btn-secondary', onclick: close }, 'Cancel'), confirmBtn));
  const backdrop = el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === backdrop) close(); } }, card);
  mount.innerHTML = ''; mount.append(backdrop);
  const f = card.querySelector('input,select,textarea'); if (f) f.focus();
  return { close };
}

const field = (label, input, hint) =>
  el('div', { class: 'field' }, el('label', {}, label), input, hint ? el('div', { class: 'tpl-meta' }, hint) : null);

function table(headers, rows) {
  const thead = el('tr', {}, ...headers.filter(h => h !== null).map(h => el('th', {}, h)));
  const body = rows.map(cells => el('tr', {}, ...cells.filter(c => c !== null).map(c =>
    el('td', {}, c && c.nodeType ? c : (c == null ? '—' : String(c))))));
  return el('div', { class: 'table-wrap' }, el('table', {}, el('thead', {}, thead), el('tbody', {}, ...body)));
}
function stat(label, value, kind, sub) {
  return el('div', { class: 'stat ' + (kind || '') },
    el('div', { class: 'label' }, label), el('div', { class: 'value' }, String(value)),
    sub ? el('div', { class: 'sub' }, sub) : null);
}
const langName = (c) => ({ sw:'Swahili', en:'English' })[c] || c || '—';
const sexLabel = (g) => ({ M:'Male', F:'Female', O:'Other' })[g] || '—';
function langSelect(val) {
  const s = el('select', {}, el('option', { value:'sw' }, 'Swahili'),
    el('option', { value:'en' }, 'English'));
  s.value = val || 'sw'; return s;
}
const KEPI = ['BCG + OPV 0','Penta 1 + OPV 1 + PCV 1','Penta 2 + OPV 2 + PCV 2',
  'Penta 3 + OPV 3 + PCV 3','Measles 1 + Yellow fever','Measles 2 + Rubella'];

// ── State & navigation ────────────────────────────────────
const state = { user: null, view: null };

const NAV = {
  provider: [
    { id:'dashboard',  label:'Dashboard',       icon:'🏠' },
    { id:'register',   label:'Register patient', icon:'➕' },
    { id:'schedules',  label:'Schedules',        icon:'📅' },
    { id:'defaulters', label:'Defaulters',       icon:'⚠️' },
    { id:'reports',    label:'Reports',          icon:'📊' },
    { id:'smslogs',    label:'SMS logs',         icon:'✉️' },
  ],
  admin: [
    { id:'overview',   label:'Overview',      icon:'🏠' },
    { id:'users',      label:'User accounts', icon:'👥' },
    { id:'gateway',    label:'SMS gateway',   icon:'📡' },
    { id:'templates',  label:'Templates',     icon:'📝' },
    { id:'audit',      label:'Audit logs',    icon:'📜' },
    { id:'sysreports', label:'System reports',icon:'📊' },
  ],
};

function buildNav() {
  const nav = $('#nav'); nav.innerHTML = '';
  for (const item of (NAV[state.user.roleType] || NAV.provider)) {
    nav.append(el('button', { class:'nav-item', 'data-view':item.id, onclick:() => go(item.id) },
      el('span', { class:'nav-icon' }, item.icon), el('span', {}, item.label)));
  }
}

function go(view, arg) {
  state.view = view;
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const def = (NAV[state.user.roleType] || []).find(n => n.id === view);
  $('#view-title').textContent = def ? def.label : view;
  const content = $('#content');
  content.innerHTML = '<div class="spinner">Loading…</div>';
  Promise.resolve((VIEWS[view] || VIEWS.dashboard)(content, arg)).catch(e => {
    content.innerHTML = '';
    content.append(el('div', { class:'card empty' }, 'Could not load: ' + e.message));
  });
}

const VIEWS = {};

// 
//  PROVIDER — Dashboard (Wf4)
// 
VIEWS.dashboard = async (root) => {
  const [stats, defaulters, today] = await Promise.all([
    api('GET', '/dashboard/stats'),
    api('GET', '/appointments/defaulters'),
    api('GET', '/appointments/today'),
  ]);
  root.innerHTML = '';
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const dateLine = new Date().toLocaleDateString('en-KE', { weekday:'long', day:'numeric', month:'long', year:'numeric' });

  root.append(el('div', { class:'greeting' },
    el('h1', {}, `${greet}, ${prettyName(state.user.username)}`),
    el('p', {}, `${dateLine} · ${state.user.facility || 'Healthcare facility'} · Healthcare Provider role`)));

  root.append(el('div', { class:'stats' },
    stat('Appointments today', stats.appointmentsToday, 'green', `${stats.confirmedToday} confirmed via auto-SMS`),
    stat('Defaulters this month', stats.defaultersThisMonth, stats.defaultersThisMonth ? 'red' : 'green', 'flagged automatically'),
    stat('Auto-SMS delivery rate', stats.smsDeliveryRate + '%', 'green', `${stats.smsFailed} failures auto-retried`)));

  // Defaulter list — action required
  const dCard = el('div', { class:'card' }, el('div', { class:'card-head' }, el('h2', {}, 'Defaulter list — action required')));
  if (!defaulters.length) dCard.append(el('div', { class:'empty' }, 'No overdue appointments 🎉'));
  else dCard.append(table(['Child','Vaccine due','Overdue',''],
    defaulters.slice(0, 12).map(r => [esc(r.childName), esc(r.vaccineType),
      el('span', { class:'overdue' }, `${r.daysOverdue} days`),
      el('button', { class:'btn-secondary btn-sm', onclick:() => openSchedule(r.childID) }, 'Open')])));
  dCard.append(el('p', { class:'muted', style:'margin:10px 0 0;font-size:12px;' },
    'Auto-SMS follow-ups are dispatched for all defaulters; the system flags appointments past their due date.'));
  root.append(dCard);

  // Today's appointments
  const tCard = el('div', { class:'card' }, el('div', { class:'card-head' }, el('h2', {}, "Today's appointments — confirmation & records")));
  if (!today.length) tCard.append(el('div', { class:'empty' }, 'No appointments scheduled for today.'));
  else tCard.append(table(['Time','Child','Vaccine','Auto-SMS reply','Record','Action'],
    today.map(a => [
      fmtTime(a.apptDate), esc(a.childName), esc(a.vaccineType),
      el('span', { class:'badge ' + (a.reply || 'none') }, a.reply ? (a.reply === 'YES' ? 'YES via SMS' : a.reply) : 'awaiting reply'),
      a.recorded ? el('span', { class:'badge recorded' }, 'Recorded') : el('span', { class:'badge pending' }, 'Pending'),
      a.recorded
        ? el('button', { class:'btn-secondary btn-sm', onclick:() => openSchedule(a.childID) }, 'View record')
        : el('button', { class:'btn-sm', onclick:() => openSchedule(a.childID) }, 'Record vaccination'),
    ])));
  root.append(tCard);
};

// 
//  PROVIDER — Register patient (Wf2)
// 
VIEWS.register = async (root) => {
  root.innerHTML = '';
  root.append(el('h1', { class:'greeting', style:'font-size:20px;margin:0 0 2px;' }, 'Register new patient'));
  root.append(el('div', { class:'subtitle-frs' },
    'FR-05, FR-19, FR-20 · All fields marked * are required · Healthcare Provider access only'));

  root.append(el('div', { class:'stepper' },
    el('div', { class:'step active' }, el('span', { class:'dot' }, '1'), 'Caregiver'),
    el('div', { class:'step active' }, el('span', { class:'dot' }, '2'), 'Child details'),
    el('div', { class:'step' }, el('span', { class:'dot' }, '3'), 'Confirm & schedule')));

  // Caregiver
  const cgName = el('input', { placeholder:'Ester Wanjiru' });
  const cgPhone = el('input', { placeholder:'+254 712 345 678' });
  const cgLang = langSelect('sw');
  const cgCard = el('div', { class:'card' },
    el('div', { class:'section-title' }, 'Caregiver details'),
    el('div', { class:'form-row' },
      field(htmlReq('Full name'), cgName), field(htmlReq('Phone number'), cgPhone), field('Preferred language', cgLang)));

  // Child
  const chName = el('input', { placeholder:'e.g. Brian Kamau' });
  const chDob = el('input', { type:'date', max: todayISO() });
  const chSex = el('select', {}, el('option', { value:'M' }, 'Male'), el('option', { value:'F' }, 'Female'), el('option', { value:'O' }, 'Other'));
  const chWeight = el('input', { type:'number', step:'0.01', min:'0', placeholder:'e.g. 3.20' });
  const chFacility = el('input', { value: state.user.facility || '', placeholder:'e.g. Kenyatta National Hospital' });
  const dupNote = el('div', { class:'hint-note' }, 'Duplicate check runs on save — the system verifies the child is not already registered (FR-19, FR-20).');
  const chCard = el('div', { class:'card' },
    el('div', { class:'section-title' }, 'Child details'),
    field(htmlReq('Child full name'), chName),
    el('div', { class:'form-row' }, field(htmlReq('Date of birth'), chDob), field(htmlReq('Gender'), chSex), field('Birth weight (kg)', chWeight)),
    field(htmlReq('Facility / clinic'), chFacility),
    field('Child ID', el('input', { value:'Auto-generated on save', disabled:'true' })),
    dupNote);

  const banner = el('div', { class:'autogen-banner' },
    el('b', {}, 'System will auto-generate upon confirmation'),
    el('ul', {},
      el('li', {}, 'WHO KEPI vaccination schedule'),
      el('li', {}, 'Automated SMS reminders (48 hr + 24 hr)'),
      el('li', {}, 'Defaulter tracking enabled')));

  const submitBtn = el('button', {}, 'Register & generate schedule');
  const errBox = el('div', { class:'inline-error' });
  submitBtn.addEventListener('click', async () => {
    errBox.textContent = '';
    if (!cgName.value.trim() || !cgPhone.value.trim()) return errBox.textContent = 'Caregiver name and phone are required.';
    if (!chName.value.trim() || !chDob.value) return errBox.textContent = 'Child name and date of birth are required.';
    submitBtn.disabled = true;
    try {
      const res = await api('POST', '/patients', {
        caregiver: { name: cgName.value.trim(), phone: cgPhone.value.trim(), language: cgLang.value },
        child: { name: chName.value.trim(), dob: chDob.value, gender: chSex.value,
                 birthWeight: chWeight.value ? Number(chWeight.value) : null },
        facilityID: chFacility.value.trim() || null,
      });
      ok(`Patient registered (child ${res.childID.slice(0,8)}). KEPI schedule generated.`, 'Success');
      openSchedule(res.childID);
    } catch (e) {
      errBox.textContent = e.message === 'DUPLICATE_CHILD'
        ? 'This child (same name + date of birth) is already registered for this caregiver.'
        : e.message === 'DUPLICATE_PHONE' ? 'That phone number belongs to another caregiver.' : e.message;
    } finally { submitBtn.disabled = false; }
  });

  root.append(cgCard, chCard,
    el('div', { class:'card' }, banner, errBox,
      el('div', { style:'display:flex;justify-content:flex-end;gap:10px;margin-top:14px;' },
        el('button', { class:'btn-secondary', onclick:() => go('register') }, 'Reset'), submitBtn)));
};
const htmlReq = (label) => { const s = el('span', {}, label, ' '); s.append(el('span', { class:'req' }, '*')); return s; };

// 
//  PROVIDER — Schedules ( Wf3)
// 
VIEWS.schedules = async (root, preChildID) => {
  if (preChildID) return openSchedule(preChildID);
  const children = await api('GET', '/children');
  root.innerHTML = '';
  const search = el('input', { placeholder:'Search by child, caregiver or phone…' });
  const listCard = el('div', { class:'card' });
  const renderList = (rows) => {
    listCard.innerHTML = '';
    listCard.append(el('div', { class:'card-head' }, el('h2', {}, 'Patients ', el('span', { class:'count' }, `(${rows.length})`))));
    if (!rows.length) { listCard.append(el('div', { class:'empty' }, 'No children found.')); return; }
    listCard.append(table(['Child','DOB','Age','Caregiver','Phone',''],
      rows.map(c => [esc(c.name), fmtDate(c.dob), ageString(c.dob), esc(c.caregiverName),
        el('span', { class:'mono' }, c.phone),
        el('button', { class:'btn-secondary btn-sm', onclick:() => openSchedule(c.childID) }, 'View schedule')])));
  };
  let timer;
  search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { renderList(await api('GET', '/children?q=' + encodeURIComponent(search.value.trim()))); }, 250);
  });
  root.append(el('div', { class:'search-bar' }, search), listCard);
  renderList(children);
};

async function openSchedule(childID) {
  state.view = 'schedules';
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.view === 'schedules'));
  $('#view-title').textContent = 'Vaccination schedule';
  const content = $('#content');
  content.innerHTML = '<div class="spinner">Loading schedule…</div>';

  const [child, schedule, history] = await Promise.all([
    api('GET', `/children/${childID}`),
    api('GET', `/children/${childID}/schedule`),
    api('GET', `/children/${childID}/vaccinations`),
  ]);
  content.innerHTML = '';

  content.append(el('div', { class:'card-head' },
    el('h2', {}, `${esc(child.name)} `, el('span', { class:'count' }, child.childID.slice(0,8))),
    el('button', { class:'btn-secondary', onclick:() => go('schedules') }, '← All patients')));
  content.append(el('div', { class:'subtitle-frs' },
    `DOB ${fmtDate(child.dob)} · Age ${ageString(child.dob)} · Caregiver ${esc(child.caregiverName)} ${esc(child.phone)} · Language ${langName(child.language)}`));

  // Managed SMS panel
  const next = schedule.find(s => s.status === 'scheduled');
  const managed = el('div', { class:'managed' },
    el('div', { class:'mhead' }, el('span', { class:'dot-live' }), 'Automated SMS reminders — system managed (FR-05, FR-26)'),
    el('div', { class:'mrow' }, el('span', {}, 'Reminders auto-dispatch 48 hr and 24 hr before each appointment.'), el('span', { class:'muted' }, 'No manual action required')),
    el('div', { class:'mrow' }, el('span', {}, 'Caregiver replies (YES / NO / RESCHEDULE) update appointment status automatically.'), el('span', { class:'muted' }, 'View SMS logs')));
  content.append(el('div', { class:'card' }, managed,
    el('div', { class:'section-title' }, 'Vaccination schedule — WHO KEPI protocol (auto-generated, FR-24)'),
    table(['Vaccine','Due date','Status','Action'],
      schedule.map(s => [esc(s.vaccineType), fmtDate(s.apptDate), statusBadge(s.status),
        scheduleAction(s, child)]))));

  // SMS preview for next appointment
  if (next) {
    try {
      const prev = await api('GET', `/appointments/${next.apptID}/sms-preview`);
      content.append(el('div', { class:'card' },
        el('div', { class:'section-title' }, 'Auto-generated SMS preview (multi-lingual, FR-26)'),
        el('div', { class:'sms-preview' },
          el('div', { class:'meta' }, `${langName(prev.language)} · ${esc(child.phone)}`),
          el('div', {}, prev.message),
          el('div', { class:'len' }, `${prev.length} characters · basic-phone compatible (NFR-12 Accessibility)`))));
    } catch (_) {}
  }

  // History
  const histCard = el('div', { class:'card' }, el('div', { class:'section-title' }, 'Vaccination history'));
  if (!history.length) histCard.append(el('div', { class:'empty' }, 'No vaccinations recorded yet.'));
  else histCard.append(table(['Vaccine','Dose','Administered','Batch','Provider','Notes'],
    history.map(h => [esc(h.vaccineType), String(h.doseNumber), fmtDate(h.dateAdministered),
      el('span', { class:'mono' }, h.batchNumber), esc(h.administeringProvider || '—'), esc(h.notes || '—')])));
  content.append(histCard);
}

function statusBadge(s) {
  const map = { scheduled:'scheduled', done:'done', missed:'missed' };
  return el('span', { class:'badge ' + (map[s] || 'none') }, s === 'done' ? 'Done' : s === 'missed' ? 'Missed' : 'Scheduled');
}
function scheduleAction(appt, child) {
  if (state.user.roleType !== 'provider') return appt.recordID ? el('span', { class:'muted' }, 'recorded') : el('span', { class:'muted' }, '—');
  if (appt.status === 'done') return el('span', { class:'muted' }, '✔ recorded');
  return el('div', { class:'row-actions' },
    el('button', { class:'btn-sm', onclick:() => recordVaccinationModal(appt, child) }, 'Record vaccination'),
    el('button', { class:'btn-secondary btn-sm', onclick:() => rescheduleModal(appt.apptID, child.name) }, 'Reschedule'));
}

function recordVaccinationModal(appt, child) {
  const dose = el('input', { type:'number', min:'1', value:'1' });
  const date = el('input', { type:'date', value: todayISO(), max: todayISO() });
  const batch = el('input', { placeholder:'e.g. BATCH-48-2026' });
  const provider = el('input', { value: prettyName(state.user.username) });
  const facility = el('input', { value: state.user.facility || '' });
  const notes = el('textarea', { rows:'2', placeholder:'Any adverse reactions or clinical observations…' });
  modal({
    title: 'Record vaccination',
    body: el('div', {},
      el('p', { class:'muted', style:'margin-top:0;' }, `${child.name} — ${appt.vaccineType}`),
      el('p', { class:'tpl-meta' }, 'Creates a vaccinationRecord linked to this appointment (apptID → recordID, FR-26).'),
      el('div', { class:'form-row' }, field(htmlReq('Date administered'), date), field(htmlReq('Dose number'), dose)),
      field('Vaccine type', el('input', { value: appt.vaccineType, disabled:'true' })),
      field(htmlReq('Batch number'), batch),
      el('div', { class:'form-row' }, field('Administering provider', provider), field('Facility', facility)),
      field('Notes (optional)', notes)),
    confirmText: 'Save vaccination record',
    onConfirm: async ({ close, error }) => {
      if (!batch.value.trim()) return error('Batch number is required.');
      await api('POST', '/vaccinations', {
        apptID: appt.apptID, vaccineType: appt.vaccineType, doseNumber: Number(dose.value) || 1,
        dateAdministered: date.value, batchNumber: batch.value.trim(),
        administeringProvider: provider.value.trim(), notes: notes.value.trim(),
      });
      close(); ok('Vaccination recorded'); openSchedule(child.childID);
    },
  });
}
function rescheduleModal(apptID, childName) {
  const date = el('input', { type:'datetime-local' });
  modal({ title:`Reschedule — ${childName || 'appointment'}`, body: el('div', {}, field(htmlReq('New date & time'), date)),
    confirmText:'Reschedule',
    onConfirm: async ({ close, error }) => {
      if (!date.value) return error('Pick a new date.');
      await api('PATCH', `/appointments/${apptID}/reschedule`, { newDate: date.value.replace('T',' ') + ':00' });
      close(); ok('Appointment rescheduled'); go('schedules');
    } });
}

// 
//  PROVIDER — Defaulters
// 
VIEWS.defaulters = async (root) => {
  const rows = await api('GET', '/appointments/defaulters');
  root.innerHTML = '';
  const card = el('div', { class:'card' }, el('div', { class:'card-head' },
    el('h2', {}, `Defaulters — overdue & unattended (${rows.length})`)));
  if (!rows.length) card.append(el('div', { class:'empty' }, 'No defaulters 🎉'));
  else card.append(table(['Child','Caregiver','Phone','Vaccine','Due','Overdue','Action'],
    rows.map(r => [esc(r.childName), esc(r.caregiverName), el('span', { class:'mono' }, r.phone),
      esc(r.vaccineType), fmtDate(r.apptDate), el('span', { class:'overdue' }, `${r.daysOverdue} days`),
      el('div', { class:'row-actions' },
        el('button', { class:'btn-secondary btn-sm', onclick:() => openSchedule(r.childID) }, 'Open'),
        state.user.roleType === 'provider'
          ? el('button', { class:'btn-secondary btn-sm', onclick:() => rescheduleModal(r.apptID, r.childName) }, 'Reschedule') : null)])));
  root.append(card);
};

// 
//  Reports (Wf5) — used by provider "Reports" and admin "System reports"
// 
VIEWS.reports = (root) => coverageReport(root);
VIEWS.sysreports = (root) => coverageReport(root);

function monthBounds(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const start = `${y}-${String(m).padStart(2,'0')}-01`;
  const end = new Date(y, m, 0).toISOString().split('T')[0];
  return { start, end };
}

async function coverageReport(root) {
  root.innerHTML = '';
  const facility = el('input', { value: state.user.facility || '' });
  const period = el('input', { type:'month', value: new Date().toISOString().slice(0,7) });
  const vaccine = el('select', {}, el('option', { value:'all' }, 'All vaccines'), ...KEPI.map(v => el('option', { value:v }, v)));
  const out = el('div', {});

  const run = async () => {
    if (!facility.value.trim()) return err('Enter a facility');
    out.innerHTML = '<div class="spinner">Generating…</div>';
    const { start, end } = monthBounds(period.value);
    const fid = encodeURIComponent(facility.value.trim());
    try {
      const [cov, smslog, defs] = await Promise.all([
        api('GET', `/reports/coverage?facilityID=${fid}&startDate=${start}&endDate=${end}&vaccineType=${encodeURIComponent(vaccine.value)}`),
        api('GET', `/reports/sms-log?facilityID=${fid}&startDate=${start}&endDate=${end}`),
        api('GET', `/reports/defaulters?facilityID=${fid}`),
      ]);
      renderCoverage(out, cov, smslog, defs, facility.value.trim());
    } catch (e) { out.innerHTML = ''; out.append(el('div', { class:'empty' }, e.message)); }
  };

  root.append(el('h1', { class:'greeting', style:'font-size:20px;margin:0 0 2px;' }, 'Vaccination coverage report'));
  root.append(el('div', { class:'subtitle-frs' }, 'FR-41, FR-50 · Sourced from vaccinationRecord and appointment tables'));
  root.append(el('div', { class:'card' }, el('div', { class:'form-row' },
    field('Facility', facility), field('Period', period), field('Vaccine filter', vaccine),
    el('div', { class:'field', style:'display:flex;align-items:flex-end;flex:0 0 auto;' }, el('button', { onclick: run }, 'Generate report')))));
  root.append(out);
  run();
}

function renderCoverage(out, cov, smslog, defs, facilityID) {
  const s = cov.summary || {};
  out.innerHTML = '';
  const pctDef = s.totalRegistered ? Math.round((Number(s.totalDefaulters||0) / Number(s.totalRegistered)) * 100) : 0;
  out.append(el('div', { class:'stats' },
    stat('Children registered', s.totalRegistered ?? 0, 'green'),
    stat('Fully vaccinated', s.totalVaccinated ?? 0, 'green', 'vaccinationRecord'),
    stat('Defaulters flagged', s.totalDefaulters ?? 0, (s.totalDefaulters ? 'red' : 'green'), `${pctDef}% of registered`),
    stat('Coverage', (s.coveragePct ?? 0) + '%', 'green')));

  const byV = el('div', { class:'card' }, el('div', { class:'section-title' }, 'Coverage by vaccine'));
  if (!(cov.byVaccine || []).length) byV.append(el('div', { class:'empty' }, 'No data for this facility / period.'));
  else byV.append(table(['Vaccine','Scheduled','Administered','Coverage %'],
    cov.byVaccine.map(v => [esc(v.vaccineType), String(v.scheduled), String(v.administered), (v.pct ?? 0)+'%'])));
  out.append(byV);

  // SMS delivery log
  const sCard = el('div', { class:'card' }, el('div', { class:'section-title' },
    el('span', {}, 'SMS delivery log (FR-48)'),
    el('span', { class:'tpl-meta' }, (smslog.summary && smslog.summary.deliveryRate) || '0%')));
  const sRows = (smslog.rows || []);
  if (!sRows.length) sCard.append(el('div', { class:'empty' }, 'No messages for this period.'));
  else sCard.append(table(['Date / time','Phone','Direction','Message','Status'],
    sRows.slice(0, 50).map(m => [fmtDateTime(m.timestamp), el('span', { class:'mono' }, m.phone),
      el('span', { class:'badge ' + m.direction }, m.direction),
      esc((m.message || '').slice(0, 60)), el('span', { class:'badge ' + m.deliveryStatus }, m.deliveryStatus)])));
  out.append(sCard);

  // Defaulter list with CSV export
  const dCard = el('div', { class:'card' }, el('div', { class:'card-head' },
    el('h2', {}, `Defaulter list (${defs.length})`),
    el('a', { class:'btn btn-secondary btn-sm', download:'defaulters.csv',
      href:`/api/reports/defaulters/export?facilityID=${encodeURIComponent(facilityID)}` }, '⬇ Export CSV')));
  if (!defs.length) dCard.append(el('div', { class:'empty' }, 'No defaulters for this facility.'));
  else dCard.append(table(['Child ID','Child','Caregiver','Missing vaccine','Days overdue','Last SMS','Action'],
    defs.map(d => [el('span', { class:'mono' }, (d.childID||'').slice(0,8)), esc(d.childName), esc(d.caregiverName),
      esc(d.vaccineType), el('span', { class:'overdue' }, String(d.daysOverdue)), fmtDateTime(d.lastSMSSent),
      el('button', { class:'btn-secondary btn-sm', onclick:() => openSchedule(d.childID) }, 'View schedule')])));
  out.append(dCard);
}

// ── Provider SMS logs 
VIEWS.smslogs = async (root) => {
  root.innerHTML = '';
  const facility = el('input', { value: state.user.facility || '' });
  const period = el('input', { type:'month', value: new Date().toISOString().slice(0,7) });
  const out = el('div', {});
  const run = async () => {
    if (!facility.value.trim()) return err('Enter a facility');
    out.innerHTML = '<div class="spinner">Loading…</div>';
    const { start, end } = monthBounds(period.value);
    try {
      const r = await api('GET', `/reports/sms-log?facilityID=${encodeURIComponent(facility.value.trim())}&startDate=${start}&endDate=${end}`);
      out.innerHTML = '';
      const sm = r.summary || {};
      out.append(el('div', { class:'stats' },
        stat('Total', sm.total ?? 0), stat('Delivered', sm.delivered ?? 0, 'green'),
        stat('Failed', sm.failed ?? 0, (sm.failed ? 'red' : 'green')), stat('Delivery rate', sm.deliveryRate ?? '0%', 'green')));
      const card = el('div', { class:'card' }, el('div', { class:'section-title' }, 'SMS log'));
      const rows = r.rows || [];
      if (!rows.length) card.append(el('div', { class:'empty' }, 'No messages for this facility / period.'));
      else card.append(table(['Time','Dir','Child','Phone','Message','Status','Retries'],
        rows.map(m => [fmtDateTime(m.timestamp), el('span', { class:'badge ' + m.direction }, m.direction),
          esc(m.childName), el('span', { class:'mono' }, m.phone), esc(m.message),
          el('span', { class:'badge ' + m.deliveryStatus }, m.deliveryStatus), String(m.retryCount ?? 0)])));
      out.append(card);
    } catch (e) { out.innerHTML = ''; out.append(el('div', { class:'empty' }, e.message)); }
  };
  root.append(el('div', { class:'card' }, el('div', { class:'form-row' },
    field('Facility', facility), field('Period', period),
    el('div', { class:'field', style:'display:flex;align-items:flex-end;flex:0 0 auto;' }, el('button', { onclick: run }, 'View log')))), out);
  run();
};

// 
//  ADMIN — overview (Wf6)
// 
VIEWS.overview = async (root) => {
  const [ov, audit] = await Promise.all([api('GET', '/admin/overview'), api('GET', '/admin/audit-log?limit=8')]);
  root.innerHTML = '';
  root.append(el('h1', { class:'greeting', style:'font-size:20px;margin:0 0 2px;' }, 'System configuration'),
    el('div', { class:'subtitle-frs' }, 'FR-31, FR-32, FR-41, FR-43, FR-44 · System Administrator access only'));
  root.append(el('div', { class:'stats' },
    stat('Active users', ov.activeUsers, 'green', `of ${ov.totalUsers} total`),
    stat('SMS dispatched (month)', ov.smsDispatchedMonth, 'green'),
    stat('Delivery rate', ov.smsDeliveryRate + '%', 'green'),
    stat('Gateway status', '', ov.gatewayStatus === 'online' ? 'green' : 'red',
      ov.gatewayStatus)));
  // patch gateway tile to show a badge value
  root.querySelectorAll('.stat')[3].querySelector('.value').append(
    el('span', { class:'badge ' + (ov.gatewayStatus === 'online' ? 'online' : 'offline') }, ov.gatewayStatus));

  const card = el('div', { class:'card' }, el('div', { class:'card-head' },
    el('h2', {}, 'Recent activity'), el('button', { class:'btn-secondary btn-sm', onclick:() => go('audit') }, 'Full audit log')));
  card.append(table(['Time','User','Role','Action'],
    audit.map(l => [fmtDateTime(l.timestamp), esc(l.username),
      el('span', { class:'badge role-' + l.roleType }, l.roleType), esc(l.action)])));
  root.append(card);
};

// ── Admin user accounts ───────────────────────────────────
VIEWS.users = async (root) => {
  const users = await api('GET', '/admin/users');
  root.innerHTML = '';
  const card = el('div', { class:'card' }, el('div', { class:'card-head' },
    el('h2', {}, `User accounts (${users.length})`),
    el('button', { onclick: () => createUserModal() }, '+ Add user')));
  card.append(table(['Username','Role','Facility','Status','Last login','Actions'],
    users.map(u => [
      esc(u.username), el('span', { class:'badge role-' + u.roleType }, u.roleType),
      esc(u.facility || '—'),
      el('span', { class:'badge ' + (u.isActive ? 'active' : 'inactive') }, u.isActive ? 'Active' : 'Inactive'),
      fmtDateTime(u.lastLogin),
      u.isActive
        ? el('button', { class:'btn-danger btn-sm', onclick:() => toggleUser(u, false) }, 'Deactivate')
        : el('button', { class:'btn-sm', onclick:() => toggleUser(u, true) }, 'Reactivate'),
    ])));
  root.append(card);
};
async function toggleUser(u, activate) {
  try {
    await api('PATCH', `/admin/users/${u.userID}/${activate ? 'activate' : 'deactivate'}`);
    ok(`${activate ? 'Reactivated' : 'Deactivated'} ${u.username}`); go('users');
  } catch (e) { err(e.message); }
}
function createUserModal() {
  const username = el('input', { placeholder:'username' });
  const password = el('input', { type:'password', placeholder:'initial password' });
  const role = el('select', {}, el('option', { value:'provider' }, 'Healthcare Provider'), el('option', { value:'admin' }, 'System Administrator'));
  const facility = el('input', { placeholder:'Facility (optional)' });
  const email = el('input', { placeholder:'Email (optional)' });
  modal({ title:'Add user account',
    body: el('div', {}, field(htmlReq('Username'), username), field(htmlReq('Password'), password),
      field('Role', role), field('Facility', facility), field('Email', email)),
    confirmText:'Create',
    onConfirm: async ({ close, error }) => {
      if (!username.value.trim() || !password.value) return error('Username and password are required.');
      await api('POST', '/admin/users', { username: username.value.trim(), password: password.value,
        roleType: role.value, facility: facility.value.trim() || null, email: email.value.trim() || null });
      close(); ok('User account created'); go('users');
    } });
}

// ── Admin SMS gateway  
VIEWS.gateway = async (root) => {
  const s = await api('GET', '/admin/settings');
  root.innerHTML = '';
  const provider = el('input', { value: s.at_provider || '' });
  const sender = el('input', { value: s.sender_id || '' });
  const first = el('input', { type:'number', min:'1', value: s.reminder_hours_first || '48' });
  const second = el('input', { type:'number', min:'1', value: s.reminder_hours_second || '24' });
  const retries = el('input', { type:'number', min:'0', value: s.sms_max_retries || '3' });
  const status = el('select', {}, el('option', { value:'online' }, 'online'), el('option', { value:'offline' }, 'offline'));
  status.value = s.gateway_status || 'online';
  const save = el('button', {}, 'Save settings');
  save.addEventListener('click', async () => {
    save.disabled = true;
    try {
      await api('PUT', '/admin/settings', {
        at_provider: provider.value.trim(), sender_id: sender.value.trim(),
        reminder_hours_first: first.value, reminder_hours_second: second.value,
        sms_max_retries: retries.value, gateway_status: status.value });
      ok('Gateway settings saved');
    } catch (e) { err(e.message); } finally { save.disabled = false; }
  });
  root.append(el('div', { class:'card' },
    el('div', { class:'section-title' }, el('span', {}, 'SMS gateway configuration (FR-43)'),
      el('span', { class:'badge ' + (status.value === 'online' ? 'online' : 'offline') }, 'Connected')),
    el('div', { class:'form-row' }, field('API provider', provider), field('Sender ID', sender)),
    el('div', { class:'form-row' },
      field('First reminder (hrs before)', first), field('Second reminder (hrs before)', second),
      field('Max retry attempts', retries), field('Gateway status', status)),
    el('div', { style:'display:flex;justify-content:flex-end;margin-top:12px;' }, save)));
};

// ── Admin SMS templates (FR-44) ───────────────────────────
VIEWS.templates = async (root) => {
  const tpls = await api('GET', '/admin/templates');
  root.innerHTML = '';
  const langFilter = el('select', {}, el('option', { value:'all' }, 'All languages'),
    el('option', { value:'sw' }, 'Swahili'), el('option', { value:'en' }, 'English'));
  const listWrap = el('div', {});
  const render = () => {
    listWrap.innerHTML = '';
    const shown = tpls.filter(t => langFilter.value === 'all' || t.language === langFilter.value);
    if (!shown.length) { listWrap.append(el('div', { class:'empty' }, 'No templates.')); return; }
    for (const t of shown) listWrap.append(templateCard(t));
  };
  langFilter.addEventListener('change', render);
  root.append(el('div', { class:'card' },
    el('div', { class:'section-title' }, 'SMS templates (FR-44, multi-lingual: Swahili · English)'),
    el('p', { class:'tpl-meta', style:'margin:0 0 12px;' }, 'Placeholders: {name} {child} {vaccine} {date} {facility}'),
    el('div', { class:'search-bar' }, langFilter), listWrap));
  render();
};
function templateCard(t) {
  const body = el('textarea', { rows:'2' }); body.value = t.body;
  const count = el('span', { class:'char-count' }, `${t.body.length} chars`);
  const updateCount = () => { count.textContent = `${body.value.length} chars`; count.classList.toggle('over', body.value.length > 160); };
  body.addEventListener('input', updateCount); updateCount();
  const save = el('button', { class:'btn-sm' }, 'Save');
  save.addEventListener('click', async () => {
    save.disabled = true;
    try { await api('PUT', `/admin/templates/${t.templateID}`, { body: body.value }); ok('Template saved'); }
    catch (e) { err(e.message); } finally { save.disabled = false; }
  });
  return el('div', { class:'tpl-card' },
    el('div', { class:'tpl-head' },
      el('span', { class:'tpl-meta' }, el('b', {}, langName(t.language)), ' · ', t.templateType), count),
    body, el('div', { style:'display:flex;justify-content:flex-end;margin-top:8px;' }, save));
}

// ── Admin audit log ───────────────────────────────────────
VIEWS.audit = async (root) => {
  const logs = await api('GET', '/admin/audit-log?limit=200');
  root.innerHTML = '';
  const card = el('div', { class:'card' }, el('h2', {}, `Audit log `, el('span', { class:'count' }, `(latest ${logs.length})`)));
  if (!logs.length) card.append(el('div', { class:'empty' }, 'No audit entries.'));
  else card.append(table(['Timestamp','User','Role','Action','IP address'],
    logs.map(l => [fmtDateTime(l.timestamp), esc(l.username), el('span', { class:'badge role-' + l.roleType }, l.roleType),
      esc(l.action), el('span', { class:'mono' }, l.ipAddress || '—')])));
  root.append(card);
};

// 
//  AUTH / BOOTSTRAP
// 
function showApp(user) {
  state.user = user;
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  $('#user-name').textContent = prettyName(user.username);
  $('#user-sub').textContent = user.facility || (user.roleType === 'admin' ? 'System Administrator' : 'Healthcare Provider');
  $('#user-avatar').textContent = (user.username[0] || '?').toUpperCase();
  $('#role-tag').textContent = user.roleType === 'admin' ? 'System Admin' : 'Healthcare Provider';
  $('#side-foot').textContent = `${prettyName(user.username)} · ${user.roleType}`;
  buildNav();
  go(user.roleType === 'admin' ? 'overview' : 'dashboard');
}

async function logout(silent) {
  try { if (!silent) await api('POST', '/auth/logout'); } catch (_) {}
  state.user = null;
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
  $('#login-form').reset();
  if (silent) err('Session expired — please sign in again.');
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const role = $('#login-role').value;
  if (role === 'caregiver') { $('#login-error').textContent = 'Caregivers interact with the system via SMS only — no dashboard login.'; return; }
  const btn = $('#login-btn'), errBox = $('#login-error');
  errBox.textContent = ''; btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const r = await api('POST', '/auth/login', { username: $('#login-username').value.trim(), password: $('#login-password').value });
    if (role && r.user.roleType !== role)
      err(`Signed in as ${r.user.roleType} (selected role was ${role}).`);
    showApp(r.user);
  } catch (e2) {
    errBox.textContent = e2.message === 'INVALID_CREDENTIALS' ? 'Invalid username or password'
      : e2.message === 'ACCOUNT_INACTIVE' ? 'This account has been deactivated' : e2.message;
  } finally { btn.disabled = false; btn.textContent = 'Sign in'; }
});

$('#logout-btn').addEventListener('click', () => logout());
$('#forgot-toggle').addEventListener('click', () => $('#reset-panel').classList.toggle('hidden'));
$('#reset-btn').addEventListener('click', async () => {
  const id = $('#reset-identifier').value.trim();
  if (!id) { $('#reset-msg').textContent = 'Enter your username or email.'; return; }
  try {
    const r = await api('POST', '/auth/forgot-password', { identifier: id });
    $('#reset-msg').style.color = 'var(--green)';
    $('#reset-msg').textContent = r.message;
  } catch (_) { $('#reset-msg').textContent = 'Could not submit request.'; }
});

// Restore an active session on reload
(async () => {
  try { const r = await api('GET', '/auth/me'); if (r && r.user) showApp(r.user); } catch (_) {}
})();

