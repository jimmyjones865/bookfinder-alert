require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const cron = require('node-cron');

const { addBook, deleteBook, readBooks } = require('./store');
const { buildSearchUrl } = require('./bookfinder');
const { checkAllBooks } = require('./checker');

const PORT = process.env.PORT || 3000;
const AUTH_PASSWORD_HASH = process.env.AUTH_PASSWORD_HASH;
const SESSION_SECRET = process.env.SESSION_SECRET;
const CHECK_INTERVAL_CRON = process.env.CHECK_INTERVAL_CRON || '0 */6 * * *';

if (!AUTH_PASSWORD_HASH || !SESSION_SECRET) {
  console.error('AUTH_PASSWORD_HASH and SESSION_SECRET must be set in .env');
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 },
  })
);

function requireAuth(req, res, next) {
  if (req.session.authed) return next();
  return res.status(401).json({ error: 'Not authenticated' });
}

app.post('/api/login', async (req, res) => {
  const { password } = req.body || {};
  if (!password) return res.status(400).json({ error: 'Password required' });
  const ok = await bcrypt.compare(password, AUTH_PASSWORD_HASH);
  if (!ok) return res.status(401).json({ error: 'Wrong password' });
  req.session.authed = true;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  res.json({ authed: !!req.session.authed });
});

function withBookfinderUrl(book) {
  return {
    ...book,
    sources: {
      ...book.sources,
      bookfinder: { ...book.sources?.bookfinder, url: buildSearchUrl(book) },
    },
  };
}

app.get('/api/books', requireAuth, (req, res) => {
  res.json(readBooks().map(withBookfinderUrl));
});

app.post('/api/books', requireAuth, (req, res) => {
  try {
    const book = addBook(req.body || {});
    res.status(201).json(withBookfinderUrl(book));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/books/:id', requireAuth, (req, res) => {
  const removed = deleteBook(req.params.id);
  if (!removed) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

app.post('/api/check-now', requireAuth, async (req, res) => {
  res.json({ ok: true, message: 'Check started' });
  checkAllBooks().catch((err) => console.error('Manual check failed:', err.message));
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`bookfinder-alert listening on :${PORT}`);
});

cron.schedule(CHECK_INTERVAL_CRON, () => {
  console.log('Running scheduled price check...');
  checkAllBooks().catch((err) => console.error('Scheduled check failed:', err.message));
});
