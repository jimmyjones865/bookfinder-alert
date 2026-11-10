const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data', 'books.json');

function ensureDataFile() {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]');
  }
}

function readBooks() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeBooks(books) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(books, null, 2));
}

function parseYear(v, name) {
  if (v === undefined || v === null || v === '') return null;
  const y = Number(v);
  if (!Number.isInteger(y) || y < 1000 || y > 9999) throw new Error(`${name} must be a 4-digit year`);
  return y;
}

function addBook({ author, title, isbn, thresholdPrice, yearFrom, yearTo }) {
  if (!author && !title && !isbn) {
    throw new Error('At least one of author, title, isbn is required');
  }
  if (!thresholdPrice || thresholdPrice <= 0) {
    throw new Error('thresholdPrice must be a positive number');
  }
  const yFrom = parseYear(yearFrom, 'yearFrom');
  const yTo = parseYear(yearTo, 'yearTo');
  if (yFrom && yTo && yFrom > yTo) throw new Error('yearFrom must be <= yearTo');
  const books = readBooks();
  const book = {
    id: crypto.randomUUID(),
    author: author || '',
    title: title || '',
    isbn: isbn || '',
    thresholdPrice: Number(thresholdPrice),
    yearFrom: yFrom,
    yearTo: yTo,
    lastSeenPrice: null,
    lastAlertPrice: null,
    lastCheckedAt: null,
    sources: { bookfinder: { price: null, url: null }, vialibri: { price: null, url: null } },
    addedAt: new Date().toISOString(),
  };
  books.push(book);
  writeBooks(books);
  return book;
}

function deleteBook(id) {
  const books = readBooks();
  const next = books.filter((b) => b.id !== id);
  writeBooks(next);
  return next.length !== books.length;
}

function updateBook(id, updates) {
  const books = readBooks();
  const idx = books.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  books[idx] = { ...books[idx], ...updates };
  writeBooks(books);
  return books[idx];
}

module.exports = { readBooks, addBook, deleteBook, updateBook };
