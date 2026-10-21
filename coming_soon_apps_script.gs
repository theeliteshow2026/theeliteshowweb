// Apps Script for coming-soon.html. It lives in its own spreadsheet,
// "The Elite Show Community - Coming Soon Sign-ups", separate from the
// Waitlist sheet. Open that spreadsheet, go to Extensions > Apps Script,
// paste this file in and deploy it as a web app (Execute as: Me,
// Who has access: Anyone). Put the web app URL in coming_soon.js.

const HEADERS = ['Submitted At', 'Full Name', 'WhatsApp Number'];

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
    ['name', 'phone'].forEach(field => {
      if (!payload[field] || String(payload[field]).trim() === '') {
        throw new Error(`Missing required field: ${field}`);
      }
    });
    if (String(payload.phone).replace(/\D/g, '').length < 10) {
      throw new Error('Phone number needs at least 10 digits.');
    }

    const sheet = getSheet();
    ensureHeaders(sheet);
    sheet.appendRow([new Date(), cell(payload.name), cell(payload.phone)]);

    return jsonResponse({ success: true, message: 'Sign-up saved.' });
  } catch (error) {
    console.error(error);
    return jsonResponse({ success: false, message: error.message || 'Unable to save sign-up.' });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return jsonResponse({ success: true, message: 'The Elite Show coming soon endpoint is active.' });
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('No active spreadsheet found. Open Apps Script from the Coming Soon Sign-ups sheet.');
  }
  return spreadsheet.getSheets()[0];
}

function ensureHeaders(sheet) {
  const headerRange = sheet.getRange(1, 1, 1, HEADERS.length);
  if (headerRange.getValues()[0].join('|') === HEADERS.join('|')) return;
  headerRange.setValues([HEADERS]).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

// Text that starts with = + - or @ would run as a formula when the sheet is
// opened, so store it as plain text instead.
function cell(value) {
  const text = value == null ? '' : String(value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
