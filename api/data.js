export default async function handler(req, res) {
  const SHEET_ID = '1eKcJbthQfc4ah8dWf9AiyV0TQ8U-BG-U-2XlT0bpl1c';
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/pub?gid=0&single=true&output=csv`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch sheet');
    const csv = await response.text();

    const lines = parseCSV(csv);
    if (lines.length < 2) {
      return res.status(200).json({ lastUpdated: '', rows: [] });
    }

    const headers = lines[0].map(h => h.trim().toLowerCase());
    const typeIdx = headers.indexOf('type');
    const dateIdx = headers.indexOf('date uploaded');
    const contactIdx = headers.indexOf('contact info');
    const descIdx = headers.indexOf('description');
    const boardIdx = headers.indexOf('board');

    let lastUpdated = '';
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i];
      if (cols.length < 2) continue;

      const rawDate = (cols[dateIdx] || '').trim();
      const contact = (cols[contactIdx] || '').trim();

      const { phone, email } = splitContact(contact);

      if (rawDate && isMoreRecent(rawDate, lastUpdated)) {
        lastUpdated = rawDate;
      }

      rows.push({
        type: (cols[typeIdx] || '').trim(),
        date: rawDate,
        phone,
        email,
        description: (cols[descIdx] || '').trim(),
        board: (cols[boardIdx] || '').trim()
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({ lastUpdated, rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function parseCSV(text) {
  const rows = [];
  let current = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++;
        current.push(field);
        field = '';
        if (current.some(c => c.trim() !== '')) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  current.push(field);
  if (current.some(c => c.trim() !== '')) rows.push(current);

  return rows;
}

function splitContact(contact) {
  let phone = '';
  let email = '';

  const emailMatch = contact.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  if (emailMatch) {
    email = emailMatch[0];
  }

  const phoneMatch = contact.match(/[\d().\-+\s]{7,}/);
  if (phoneMatch) {
    phone = phoneMatch[0].trim();
  }

  if (!phone && !email) {
    if (contact.includes('@')) {
      email = contact;
    } else if (/\d/.test(contact)) {
      phone = contact;
    }
  }

  return { phone, email };
}

function isMoreRecent(dateA, dateB) {
  if (!dateB) return true;
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a.getTime())) return false;
  if (isNaN(b.getTime())) return true;
  return a > b;
}
