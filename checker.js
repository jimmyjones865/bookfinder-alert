const { fetchLowestPrice: fetchBookfinder, buildSearchUrl, launchBrowser } = require('./bookfinder');
const { fetchLowestPrice: fetchVialibri } = require('./vialibri');
const { sendAlert } = require('./discord');
const { readBooks, updateBook } = require('./store');

async function checkBook(book, browser) {
  let bfPrice = null;
  try {
    bfPrice = await fetchBookfinder(book, browser);
  } catch (err) {
    console.error(`bookfinder check failed for ${book.id} (${book.title || book.isbn}):`, err.message);
  }

  let vlPrice = null;
  let vlUrl = book.sources?.vialibri?.url || null;
  try {
    const result = await fetchVialibri(book, browser);
    if (result) {
      vlPrice = result.price;
      vlUrl = result.url;
    }
  } catch (err) {
    console.error(`viaLibri check failed for ${book.id} (${book.title || book.isbn}):`, err.message);
  }

  const bfUrl = buildSearchUrl(book);
  const candidates = [];
  if (bfPrice !== null) candidates.push({ source: 'bookfinder', price: bfPrice, url: bfUrl });
  if (vlPrice !== null) candidates.push({ source: 'viaLibri', price: vlPrice, url: vlUrl });
  const lowest = candidates.length
    ? candidates.reduce((a, b) => (b.price < a.price ? b : a))
    : null;

  const updates = {
    lastCheckedAt: new Date().toISOString(),
    sources: {
      bookfinder: { price: bfPrice, url: bfUrl },
      vialibri: { price: vlPrice, url: vlUrl },
    },
    lastSeenPrice: lowest ? lowest.price : null,
  };

  if (lowest && lowest.price < book.thresholdPrice) {
    const shouldAlert = book.lastAlertPrice === null || lowest.price < book.lastAlertPrice;
    if (shouldAlert) {
      try {
        await sendAlert(book, lowest.price, lowest.url, lowest.source);
        updates.lastAlertPrice = lowest.price;
      } catch (err) {
        console.error(`Discord alert failed for ${book.id}:`, err.message);
      }
    }
  } else {
    updates.lastAlertPrice = null;
  }

  updateBook(book.id, updates);
}

async function checkAllBooks() {
  const books = readBooks();
  if (books.length === 0) return;
  const browser = await launchBrowser();
  try {
    for (const book of books) {
      await checkBook(book, browser);
    }
  } finally {
    await browser.close();
  }
}

module.exports = { checkBook, checkAllBooks };
