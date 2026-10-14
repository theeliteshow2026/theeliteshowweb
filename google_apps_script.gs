const SHEET_NAME = 'Waitlist';
// Leave blank when this script was opened from Extensions > Apps Script
// inside the target Google Sheet. Otherwise, paste the spreadsheet ID here.
const SPREADSHEET_ID = '';

const HEADERS = [
  'Submitted At',
  'Full Name',
  'Phone Number',
  'Email Address',
  'State',
  'City',
  'Age',
  'You Are A',
  'Topics',
  'Community Involvement',
  'Payment Consent',
  'Access Fee (INR)',
  'Joining As',
  'Organisation',
  'Profile Link',
  'Message'
];

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return jsonResponse({
      success: false,
      message: 'doPost must be called through the deployed web app, not run directly from the Apps Script editor.'
    });
  }

  const lock = LockService.getScriptLock();

  try {
    lock.waitLock(10000);

    const payload = JSON.parse(e.postData.contents);
    validatePayload(payload);

    const spreadsheet = getSpreadsheet();
    const sheet = getOrCreateSheet(spreadsheet);
    ensureHeaders(sheet);

    const row = [
      payload.name,
      payload.phone,
      payload.email,
      payload.state,
      payload.city,
      payload.age,
      payload.role,
      payload.topics,
      payload.involvement,
      payload.paymentConsent ? 'Yes' : 'No',
      isMember(payload) ? 299 : '',
      payload.joiningAs || 'Member',
      payload.organisation,
      payload.profileLink,
      payload.message
    ].map(cell);
    sheet.appendRow([new Date()].concat(row));

    return jsonResponse({
      success: true,
      message: 'Waitlist registration saved.'
    });
  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message: error.message || 'Unable to save registration.'
    });
  } finally {
    lock.releaseLock();
  }
}

function setupSheet() {
  const spreadsheet = getSpreadsheet();
  const sheet = getOrCreateSheet(spreadsheet);
  ensureHeaders(sheet);

  SpreadsheetApp.flush();
  return `Sheet "${SHEET_NAME}" is ready with ${HEADERS.length} columns.`;
}

function doGet() {
  return jsonResponse({
    success: true,
    message: 'The Elite Show Community waitlist endpoint is active.'
  });
}

function getSpreadsheet() {
  if (SPREADSHEET_ID) {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      'No active spreadsheet found. Open Apps Script from the target Sheet or set SPREADSHEET_ID.'
    );
  }

  return spreadsheet;
}

function getOrCreateSheet(spreadsheet) {
  return spreadsheet.getSheetByName(SHEET_NAME) ||
    spreadsheet.insertSheet(SHEET_NAME);
}

function ensureHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  // Skip the rewrite (and the slow column resize) once the headers are in place
  if (headerRange.getValues()[0].join('|') === HEADERS.join('|')) return;
  headerRange.setValues([HEADERS]);
  headerRange.setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, HEADERS.length);
}

const JOINING_AS = ['Member', 'Mentor', 'Investor', 'Collaborator'];

// Text that starts with = + - or @ would run as a formula when the sheet is
// opened, so store it as plain text instead.
function cell(value) {
  const text = value == null ? '' : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

// Mentors, investors and collaborators skip the member questions and the
// access fee, and tell us about themselves in organisation + message instead.
function isMember(payload) {
  return !payload.joiningAs || payload.joiningAs === 'Member';
}

function validatePayload(payload) {
  if (payload.joiningAs && JOINING_AS.indexOf(payload.joiningAs) === -1) {
    throw new Error('Unknown joiningAs value.');
  }

  const contactFields = ['name', 'phone', 'email', 'state', 'city'];
  const requiredFields = isMember(payload)
    ? contactFields.concat(['age', 'role', 'topics', 'involvement'])
    : contactFields.concat(['organisation', 'message']);

  requiredFields.forEach(field => {
    if (!payload[field] || String(payload[field]).trim() === '') {
      throw new Error(`Missing required field: ${field}`);
    }
  });

  if (isMember(payload) && payload.paymentConsent !== true) {
    throw new Error('Payment consent is required.');
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
