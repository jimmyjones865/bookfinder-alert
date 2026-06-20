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

function addBook({ author, title, isbn, thresholdPrice }) {
  if (!author && !title && !isbn) {
    throw new Error('At least one of author, title, isbn is required');
  }
  if (!thresholdPrice || thresholdPrice <= 0) {
    throw new Error('thresholdPrice must be a positive number');
  }
  const books = readBooks();
  const book = {
    id: crypto.randomUUID(),
    author: author || '',
    title: title || '',
    isbn: isbn || '',
    thresholdPrice: Number(thresholdPrice),
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
