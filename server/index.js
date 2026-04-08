import express from 'express';
import cors from 'cors';
import { readdir, stat, readFile, writeFile } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { google } from 'googleapis';
import { WebClient } from '@slack/web-api';
// Notion uses REST API directly (SDK v5+ broke databases.query)

// ─── Env ────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  });
}

const app = express();
const PORT = 3001;
app.use(cors());
app.use(express.json());

// ─── Config ─────────────────────────────────────────────────────────
const ACCOUNTS_DIR = process.env.ACCOUNTS_DIR || '/Users/tpanos/GOAL/My Accounts';
const CLOSE_API_KEY = process.env.CLOSE_API_KEY || '';
const TOKENS_PATH = join(__dirname, 'tokens.json');

// ─── Google OAuth2 ──────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/auth/google/callback';

const oauth2Client = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

oauth2Client.on('tokens', (tokens) => {
  const existing = loadTokens() || {};
  saveTokens({ ...existing, ...tokens });
});

function loadTokens() {
  if (!existsSync(TOKENS_PATH)) return null;
  try { return JSON.parse(readFileSync(TOKENS_PATH, 'utf-8')); }
  catch { return null; }
}

function saveTokens(tokens) {
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
}

function getAuthedOAuth2() {
  const tokens = loadTokens();
  if (!tokens) return null;
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

// ─── Slack Client ───────────────────────────────────────────────────
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || '';
const slack = SLACK_BOT_TOKEN ? new WebClient(SLACK_BOT_TOKEN) : null;

// ─── Notion Client ──────────────────────────────────────────────────
const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID || '';

function extractNotionProp(prop) {
  if (!prop) return '';
  switch (prop.type) {
    case 'title': return prop.title?.map(t => t.plain_text).join('') || '';
    case 'rich_text': return prop.rich_text?.map(t => t.plain_text).join('') || '';
    case 'select': return prop.select?.name || '';
    case 'multi_select': return prop.multi_select?.map(s => s.name).join(', ') || '';
    case 'number': return prop.number ?? '';
    case 'email': return prop.email || '';
    case 'url': return prop.url || '';
    case 'date': return prop.date?.start || '';
    case 'created_time': return prop.created_time || '';
    case 'last_edited_time': return prop.last_edited_time || '';
    case 'checkbox': return prop.checkbox || false;
    case 'phone_number': return prop.phone_number || '';
    case 'formula': return prop.formula?.string || prop.formula?.number || '';
    case 'rollup': return prop.rollup?.number || '';
    default: return '';
  }
}

function notionPageToAccount(page) {
  const props = page.properties || {};
  return {
    Name: extractNotionProp(props.Name || props.name),
    Status: extractNotionProp(props.Status || props.status) || 'Incoming',
    Tier: extractNotionProp(props.Tier || props.tier),
    'Main Contact': extractNotionProp(props['Main Contact'] || props['main contact'] || props.Email || props.email),
    'Account Score': extractNotionProp(props['Account Score'] || props['account score']),
    Added: extractNotionProp(props.Added || props.added || props['Created time']) || page.created_time || '',
    'date:Last Contact:start': extractNotionProp(props['Last Contact'] || props['last contact']),
    'date:Contract Start:start': extractNotionProp(props['Contract Start'] || props['contract start']),
    'date:Contact End:start': extractNotionProp(props['Contact End'] || props['contact end']),
    url: page.url || '',
    _notionId: page.id,
  };
}

// ─── Live Data Helpers ──────────────────────────────────────────────
// These are reused by individual endpoints, unified search, and scanner.

async function fetchGmailThreads(query = '', maxResults = 25) {
  const auth = getAuthedOAuth2();
  if (!auth) return [];
  const gmail = google.gmail({ version: 'v1', auth });
  const listRes = await gmail.users.messages.list({ userId: 'me', q: query || undefined, maxResults });
  const messages = listRes.data.messages || [];
  const threads = await Promise.all(messages.map(async (m) => {
    const detail = await gmail.users.messages.get({
      userId: 'me', id: m.id, format: 'metadata',
      metadataHeaders: ['Subject', 'From', 'To', 'Date'],
    });
    const headers = detail.data.payload?.headers || [];
    const hdr = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
    return {
      threadId: detail.data.threadId,
      messageId: detail.data.id,
      subject: hdr('Subject') || 'No subject',
      from: hdr('From'),
      to: hdr('To'),
      date: detail.data.internalDate ? new Date(parseInt(detail.data.internalDate)).toISOString() : '',
      snippet: detail.data.snippet || '',
      body: '',
    };
  }));
  return threads;
}

async function fetchCalendarEvents(query = '', timeMin = null) {
  const auth = getAuthedOAuth2();
  if (!auth) return [];
  const calendar = google.calendar({ version: 'v3', auth });
  const params = {
    calendarId: 'primary', maxResults: 50, singleEvents: true, orderBy: 'startTime',
    timeMin: timeMin || new Date().toISOString(),
  };
  if (query) params.q = query;
  const res = await calendar.events.list(params);
  return (res.data.items || [])
    .filter(evt => (evt.summary || '') !== 'Clock In')
    .map(evt => ({
      id: evt.id,
      summary: evt.summary || 'No title',
      start: evt.start?.dateTime || evt.start?.date || '',
      end: evt.end?.dateTime || evt.end?.date || '',
      location: evt.location || '',
      description: evt.description || '',
      attendees: (evt.attendees || []).map(a => a.email || '').join(', '),
    }));
}

async function fetchSlackChannels() {
  if (!slack) return [];
  const channels = [];
  let cursor;
  // Paginate but cap at 500 channels
  for (let i = 0; i < 5; i++) {
    const res = await slack.conversations.list({
      types: 'public_channel,private_channel', limit: 100, exclude_archived: true,
      ...(cursor ? { cursor } : {}),
    });
    for (const ch of (res.channels || [])) {
      channels.push({
        id: ch.id,
        name: ch.name || '',
        creator: ch.creator || '',
        permalink: '',
        type: ch.is_private ? 'Private' : 'Public',
        purpose: ch.purpose?.value || '',
        topic: ch.topic?.value || '',
        numMembers: ch.num_members || 0,
      });
    }
    cursor = res.response_metadata?.next_cursor;
    if (!cursor) break;
  }
  return channels;
}

async function notionApiPost(endpoint, body = {}) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Notion API ${res.status}`);
  }
  return res.json();
}

async function notionApiPatch(endpoint, body = {}) {
  const res = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Notion API ${res.status}`);
  }
  return res.json();
}

async function fetchNotionAccounts() {
  if (!NOTION_API_KEY || !NOTION_DATABASE_ID) return [];
  const pages = [];
  let cursor;
  do {
    const res = await notionApiPost(`/databases/${NOTION_DATABASE_ID}/query`, {
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    for (const page of res.results) {
      pages.push(notionPageToAccount(page));
    }
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages;
}

// ─── Auth Routes ────────────────────────────────────────────────────
app.get('/auth/google', (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth credentials not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env' });
  }
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar.readonly',
    ],
  });
  res.redirect(url);
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).send('Missing authorization code');
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    saveTokens(tokens);
    res.redirect('http://localhost:5173/settings?connected=google');
  } catch (e) {
    console.error('Google OAuth error:', e.message);
    res.redirect(`http://localhost:5173/settings?error=${encodeURIComponent(e.message)}`);
  }
});

app.post('/auth/google/disconnect', (req, res) => {
  if (existsSync(TOKENS_PATH)) {
    writeFileSync(TOKENS_PATH, '{}');
  }
  res.json({ success: true });
});

app.get('/api/auth/status', (req, res) => {
  const tokens = loadTokens();
  res.json({
    google: !!(tokens?.refresh_token || tokens?.access_token),
    slack: !!SLACK_BOT_TOKEN,
    notion: !!(NOTION_API_KEY && NOTION_DATABASE_ID),
    close: !!CLOSE_API_KEY,
    files: existsSync(ACCOUNTS_DIR),
  });
});

// ─── Health Check ───────────────────────────────────────────────────
app.get('/api/health', async (req, res) => {
  const tokens = loadTokens();
  const services = {
    google: !!(tokens?.refresh_token || tokens?.access_token),
    close: !!CLOSE_API_KEY,
    slack: !!SLACK_BOT_TOKEN,
    notion: !!(NOTION_API_KEY && NOTION_DATABASE_ID),
    files: existsSync(ACCOUNTS_DIR),
  };
  res.json({ status: 'ok', time: new Date().toISOString(), services });
});

// ─── Notion Accounts (live) ─────────────────────────────────────────
app.get('/api/notion/accounts', async (req, res) => {
  try {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      return res.json({ results: [], error: 'Notion not configured. Add NOTION_API_KEY and NOTION_DATABASE_ID to .env' });
    }
    const results = await fetchNotionAccounts();
    res.json({ results });
  } catch (e) {
    console.error('Notion accounts error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/notion/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  try {
    const accounts = await fetchNotionAccounts();
    const results = accounts.filter(acc => {
      return (acc.Name || '').toLowerCase().includes(q) ||
             (acc['Main Contact'] || '').toLowerCase().includes(q);
    }).map(acc => ({
      title: acc.Name,
      type: 'Account',
      highlight: `Status: ${acc.Status} | Tier: ${acc.Tier} | Contact: ${acc['Main Contact'] || 'N/A'}`,
      timestamp: acc.Added,
      url: acc.url,
    }));
    res.json({ results });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/notion/account', async (req, res) => {
  const { name, status, tier, mainContact, accountScore } = req.body;
  try {
    if (NOTION_API_KEY && NOTION_DATABASE_ID) {
      const properties = {
        Name: { title: [{ text: { content: name } }] },
      };
      if (status) properties.Status = { select: { name: status } };
      if (tier) properties.Tier = { select: { name: tier } };
      if (mainContact) properties['Main Contact'] = { email: mainContact };
      if (accountScore) properties['Account Score'] = { number: parseInt(accountScore) || 0 };

      const page = await notionApiPost('/pages', {
        parent: { database_id: NOTION_DATABASE_ID },
        properties,
      });
      res.json({ success: true, message: `Account "${name}" created in Notion.`, data: notionPageToAccount(page) });
    } else {
      res.json({ success: true, message: `Account "${name}" created (Notion not configured — saved locally).`, data: { name, status, tier, mainContact, accountScore } });
    }
  } catch (e) {
    console.error('Create account error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/accounts/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  try {
    if (NOTION_API_KEY && NOTION_DATABASE_ID) {
      // Find the page by name, then archive it
      const accounts = await fetchNotionAccounts();
      const match = accounts.find(a => (a.Name || '').toLowerCase() === name.toLowerCase());
      if (match?._notionId) {
        await notionApiPatch(`/pages/${match._notionId}`, { archived: true });
      }
    }
    res.json({ success: true, message: `Account "${name}" deleted.` });
  } catch (e) {
    console.error('Delete account error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Gmail (live) ───────────────────────────────────────────────────
app.get('/api/gmail/search', async (req, res) => {
  const q = req.query.q || '';
  try {
    if (!getAuthedOAuth2()) {
      return res.json({ threads: [], count: 0, error: 'Google not connected. Click "Connect Google" in Settings.' });
    }
    const threads = await fetchGmailThreads(q);
    res.json({ threads, count: threads.length });
  } catch (e) {
    console.error('Gmail search error:', e.message);
    if (e.message?.includes('invalid_grant') || e.code === 401) {
      return res.json({ threads: [], count: 0, error: 'Google session expired. Reconnect in Settings.' });
    }
    res.status(500).json({ error: e.message });
  }
});

// ─── Calendar (live) ────────────────────────────────────────────────
app.get('/api/calendar/events', async (req, res) => {
  const q = req.query.q || '';
  try {
    if (!getAuthedOAuth2()) {
      return res.json({ events: [], count: 0, error: 'Google not connected. Click "Connect Google" in Settings.' });
    }
    const events = await fetchCalendarEvents(q);
    res.json({ events, count: events.length });
  } catch (e) {
    console.error('Calendar events error:', e.message);
    if (e.message?.includes('invalid_grant') || e.code === 401) {
      return res.json({ events: [], count: 0, error: 'Google session expired. Reconnect in Settings.' });
    }
    res.status(500).json({ error: e.message });
  }
});

// ─── Slack (live) ───────────────────────────────────────────────────
app.get('/api/slack/channels', async (req, res) => {
  try {
    if (!slack) return res.json({ channels: [], count: 0, error: 'Slack not configured. Add SLACK_BOT_TOKEN to .env' });
    const channels = await fetchSlackChannels();
    res.json({ channels, count: channels.length });
  } catch (e) {
    console.error('Slack channels error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/slack/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  try {
    if (!slack) return res.json({ channels: [], count: 0 });
    const channels = await fetchSlackChannels();
    const filtered = q
      ? channels.filter(ch => ch.name.toLowerCase().includes(q) || (ch.purpose || '').toLowerCase().includes(q))
      : channels;
    res.json({ channels: filtered, count: filtered.length });
  } catch (e) {
    console.error('Slack search error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── Local Files (unchanged) ────────────────────────────────────────
app.get('/api/files/accounts', async (req, res) => {
  try {
    if (!existsSync(ACCOUNTS_DIR)) {
      return res.json({ accounts: [], error: 'Accounts directory not found' });
    }
    const entries = await readdir(ACCOUNTS_DIR, { withFileTypes: true });
    const accounts = [];
    for (const entry of entries) {
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        const dirPath = join(ACCOUNTS_DIR, entry.name);
        const files = await getFilesRecursive(dirPath);
        accounts.push({ name: entry.name, path: dirPath, files });
      }
    }
    res.json({ accounts, count: accounts.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/files/account/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const entries = await readdir(ACCOUNTS_DIR, { withFileTypes: true });
    const match = entries.find(e => e.name === name) || entries.find(e => e.name.toLowerCase() === name.toLowerCase());
    if (!match) return res.json({ files: [] });
    const dirPath = join(ACCOUNTS_DIR, match.name);
    const files = await getFilesRecursive(dirPath);
    res.json({ files, path: dirPath });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function getFilesRecursive(dir, base = '') {
  const files = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = join(dir, entry.name);
      const relPath = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        files.push(...await getFilesRecursive(fullPath, relPath));
      } else {
        const st = await stat(fullPath);
        files.push({ name: entry.name, path: relPath, fullPath, ext: extname(entry.name).toLowerCase(), size: st.size, modified: st.mtime.toISOString() });
      }
    }
  } catch { /* skip unreadable dirs */ }
  return files;
}

// ─── Close CRM (unchanged) ─────────────────────────────────────────
app.get('/api/close/leads', async (req, res) => {
  if (!CLOSE_API_KEY) {
    return res.json({ data: [], error: 'Close CRM API key not configured. Add CLOSE_API_KEY to .env' });
  }
  const query = req.query.query || '';
  const limit = req.query.limit || 10;
  try {
    const response = await fetch(`https://api.close.com/api/v1/lead/?query=${encodeURIComponent(query)}&_limit=${limit}`, {
      headers: { 'Authorization': `Basic ${Buffer.from(CLOSE_API_KEY + ':').toString('base64')}` }
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── Unified Search (live) ──────────────────────────────────────────
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  if (!q) return res.json({ error: 'Query required' });

  const results = {};

  // All searches in parallel
  const [notionAccounts, gmailThreads, calEvents, slackChannels] = await Promise.all([
    fetchNotionAccounts().catch(() => []),
    getAuthedOAuth2() ? fetchGmailThreads(q, 10).catch(() => []) : Promise.resolve([]),
    getAuthedOAuth2() ? fetchCalendarEvents(q).catch(() => []) : Promise.resolve([]),
    slack ? fetchSlackChannels().catch(() => []) : Promise.resolve([]),
  ]);

  // Notion
  if (notionAccounts.length) {
    const matched = notionAccounts.filter(acc =>
      (acc.Name || '').toLowerCase().includes(q) || (acc['Main Contact'] || '').toLowerCase().includes(q)
    );
    results.notion = {
      results: matched.map(acc => ({
        title: acc.Name, type: 'Account',
        highlight: `Status: ${acc.Status} | Tier: ${acc.Tier} | Contact: ${acc['Main Contact'] || 'N/A'}`,
        timestamp: acc.Added,
      }))
    };
  }

  // Gmail
  if (gmailThreads.length) {
    results.gmail = {
      threads: gmailThreads.map(t => ({ subject: t.subject, from: t.from, date: t.date, snippet: t.snippet })),
      count: gmailThreads.length,
    };
  }

  // Calendar
  if (calEvents.length) {
    results.calendar = {
      events: calEvents.map(e => ({ summary: e.summary, start: e.start, end: e.end, location: e.location })),
      count: calEvents.length,
    };
  }

  // Local files
  try {
    if (existsSync(ACCOUNTS_DIR)) {
      const entries = await readdir(ACCOUNTS_DIR, { withFileTypes: true });
      const matched = entries.filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name.toLowerCase().includes(q));
      if (matched.length) results.files = matched.map(e => ({ name: e.name, path: join(ACCOUNTS_DIR, e.name) }));
    }
  } catch {}

  // Slack
  if (slackChannels.length) {
    const matched = slackChannels.filter(ch => ch.name.toLowerCase().includes(q) || (ch.purpose || '').toLowerCase().includes(q));
    if (matched.length) results.slack = { channels: matched, count: matched.length };
  }

  res.json(results);
});

// ─── Scanner (live) ─────────────────────────────────────────────────
app.get('/api/scanner/tasks', async (req, res) => {
  const account = (req.query.account || '').toLowerCase();
  const results = { emails: { threads: [] }, events: { events: [] } };

  try {
    const [threads, events] = await Promise.all([
      getAuthedOAuth2() ? fetchGmailThreads(account || '', 25).catch(() => []) : Promise.resolve([]),
      getAuthedOAuth2() ? fetchCalendarEvents(account || '').catch(() => []) : Promise.resolve([]),
    ]);

    if (account) {
      results.emails.threads = threads.filter(t =>
        t.subject.toLowerCase().includes(account) || t.snippet.toLowerCase().includes(account)
      );
      results.events.events = events.filter(e =>
        e.summary.toLowerCase().includes(account) || e.description.toLowerCase().includes(account)
      );
    } else {
      results.emails.threads = threads;
      results.events.events = events;
    }
  } catch {}

  res.json(results);
});

// ─── Smart Task Scanner (live) ──────────────────────────────────────
app.get('/api/account/:name/scan-tasks', async (req, res) => {
  const accountName = decodeURIComponent(req.params.name);
  const q = accountName.toLowerCase();
  const suggestedTasks = [];

  const [threads, events, slackChannels] = await Promise.all([
    getAuthedOAuth2() ? fetchGmailThreads(accountName, 25).catch(() => []) : Promise.resolve([]),
    getAuthedOAuth2() ? fetchCalendarEvents('').catch(() => []) : Promise.resolve([]),
    slack ? fetchSlackChannels().catch(() => []) : Promise.resolve([]),
  ]);

  // Scan emails for action items
  for (const t of threads) {
    const subject = t.subject || '';
    const from = t.from || '';
    const snippet = t.snippet || '';
    const combined = (subject + ' ' + snippet).toLowerCase();

    if (!combined.includes(q) && !from.toLowerCase().includes(q)) continue;

    if (/follow.?up|following up/i.test(combined)) {
      suggestedTasks.push({ title: `Follow up on: ${subject}`, source: 'email', priority: 'high', detail: `From: ${from}`, date: t.date, type: 'follow-up', raw: { subject, from, date: t.date, snippet } });
    } else if (/action.?required|urgent|asap|deadline|due/i.test(combined)) {
      suggestedTasks.push({ title: `Action required: ${subject}`, source: 'email', priority: 'high', detail: `From: ${from}`, date: t.date, type: 'action', raw: { subject, from, date: t.date, snippet } });
    } else if (/review|approve|sign|confirm/i.test(combined)) {
      suggestedTasks.push({ title: `Review/approve: ${subject}`, source: 'email', priority: 'medium', detail: `From: ${from}`, date: t.date, type: 'review', raw: { subject, from, date: t.date, snippet } });
    } else if (/onboard|setup|implement|launch|kick.?off/i.test(combined)) {
      suggestedTasks.push({ title: `Onboarding task: ${subject}`, source: 'email', priority: 'medium', detail: `From: ${from}`, date: t.date, type: 'onboarding', raw: { subject, from, date: t.date, snippet } });
    } else if (/budget|spend|cost|invoice|billing|payment/i.test(combined)) {
      suggestedTasks.push({ title: `Review budget/billing: ${subject}`, source: 'email', priority: 'medium', detail: `From: ${from}`, date: t.date, type: 'billing', raw: { subject, from, date: t.date, snippet } });
    } else {
      suggestedTasks.push({ title: `Review email: ${subject}`, source: 'email', priority: 'low', detail: `From: ${from}`, date: t.date, type: 'review', raw: { subject, from, date: t.date, snippet } });
    }
  }

  // Scan calendar for prep tasks
  for (const evt of events) {
    const summary = evt.summary || '';
    const desc = evt.description || '';
    if (!summary.toLowerCase().includes(q) && !desc.toLowerCase().includes(q)) continue;

    const isUpcoming = new Date(evt.start) > new Date();
    if (isUpcoming) {
      suggestedTasks.push({ title: `Prep for meeting: ${summary}`, source: 'calendar', priority: 'high', detail: `${evt.start}${evt.attendees ? ' | Attendees: ' + evt.attendees : ''}`, date: evt.start, type: 'meeting-prep', raw: { summary, start: evt.start, attendees: evt.attendees, description: desc } });
    }
    if (/review|standup|check.?in|sync/i.test(summary)) {
      suggestedTasks.push({ title: `Prepare update for: ${summary}`, source: 'calendar', priority: 'medium', detail: evt.start, date: evt.start, type: 'update-prep', raw: { summary, start: evt.start, attendees: evt.attendees, description: desc } });
    }
    if (/onboard|training|demo|kick.?off/i.test(summary)) {
      suggestedTasks.push({ title: `Prepare materials for: ${summary}`, source: 'calendar', priority: 'high', detail: `${evt.start}${evt.attendees ? ' | Attendees: ' + evt.attendees : ''}`, date: evt.start, type: 'material-prep', raw: { summary, start: evt.start, attendees: evt.attendees, description: desc } });
    }
  }

  // Scan Slack channels
  for (const ch of slackChannels) {
    if (ch.name.toLowerCase().includes(q) || (ch.purpose || '').toLowerCase().includes(q)) {
      suggestedTasks.push({ title: `Check Slack channel: #${ch.name}`, source: 'slack', priority: 'low', detail: ch.purpose || 'Account channel', date: '', type: 'slack-check', raw: { name: ch.name, purpose: ch.purpose, permalink: ch.permalink } });
    }
  }

  // Scan local files for recent changes
  try {
    if (existsSync(ACCOUNTS_DIR)) {
      const entries = await readdir(ACCOUNTS_DIR, { withFileTypes: true });
      const match = entries.find(e => e.name.toLowerCase() === q) || entries.find(e => e.name.toLowerCase().includes(q));
      if (match) {
        const files = await getFilesRecursive(join(ACCOUNTS_DIR, match.name));
        const recentFiles = files.filter(f => (Date.now() - new Date(f.modified).getTime()) / 86400000 < 7);
        if (recentFiles.length > 0) {
          suggestedTasks.push({ title: `Review ${recentFiles.length} recently updated file(s)`, source: 'files', priority: 'low', detail: recentFiles.map(f => f.name).join(', '), date: recentFiles[0].modified, type: 'file-review', raw: { files: recentFiles } });
        }
      }
    }
  } catch {}

  // Sort by priority then date, deduplicate
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  suggestedTasks.sort((a, b) => {
    const pDiff = (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    return pDiff !== 0 ? pDiff : new Date(b.date || 0) - new Date(a.date || 0);
  });
  const seen = new Set();
  const unique = suggestedTasks.filter(t => {
    const key = t.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  res.json({ account: accountName, tasks: unique, count: unique.length });
});

// ─── Start Server ───────────────────────────────────────────────────
app.listen(PORT, () => {
  const tokens = loadTokens();
  console.log(`\n  GOAL Account Manager API — http://localhost:${PORT}`);
  console.log(`  Google:  ${tokens?.refresh_token ? 'Connected' : 'Not connected (/auth/google)'}`);
  console.log(`  Slack:   ${SLACK_BOT_TOKEN ? 'Configured' : 'Not configured'}`);
  console.log(`  Notion:  ${NOTION_API_KEY && NOTION_DATABASE_ID ? 'Configured' : 'Not configured'}`);
  console.log(`  Close:   ${CLOSE_API_KEY ? 'Configured' : 'Not configured'}`);
  console.log(`  Files:   ${ACCOUNTS_DIR}\n`);
});
