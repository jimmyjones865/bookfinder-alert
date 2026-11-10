const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Result URLs are server-signed (?s=...) over author/title/all_text only, so
// sort and year params can be appended freely. New searches via the form now
// redirect to /account/login, so a previously stored signed URL is reused.
function withFilters(signedUrl, { yearFrom, yearTo }) {
  const u = new URL(signedUrl);
  for (const k of ['sort', 'year_min', 'year_max']) u.searchParams.delete(k);
  u.searchParams.set('sort', 'price.asc');
  if (yearFrom) u.searchParams.set('year_min', yearFrom);
  if (yearTo) u.searchParams.set('year_max', yearTo);
  return u.toString();
}

// viaLibri has no dedicated ISBN field on its basic search form - ISBN goes
// through the free-text "all_text" field (it labels these "Keywords / ISBN").
async function getSignedUrl(book, page) {
  const stored = book.sources?.vialibri?.url;
  if (stored && stored.includes('/searches?') && stored.includes('s=')) return stored;

  await page.goto('https://www.vialibri.net/', { waitUntil: 'networkidle', timeout: 30000 });
  if (book.isbn) {
    await page.fill('#all_text', book.isbn);
  } else {
    if (book.author) await page.fill('#author', book.author);
    if (book.title) await page.fill('#title', book.title);
  }
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => null),
    page.click('button:has-text("Search")'),
  ]);
  await page.waitForTimeout(1500);
  return page.url().includes('/searches?') ? page.url() : null;
}

async function fetchLowestPrice(book, browser) {
  const page = await browser.newPage({ userAgent: USER_AGENT });
  try {
    const signed = await getSignedUrl(book, page);
    if (!signed) {
      console.warn(`viaLibri: no signed search URL for ${book.id} (form search requires login)`);
      return null;
    }

    const url = withFilters(signed, book);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    if (page.url().includes('search-error')) return null;

    const text = await page.evaluate(() => document.body.innerText);
    const idx = text.indexOf('matches from');
    if (idx === -1) return { price: null, url }; // no results

    const section = text.slice(idx);
    const prices = [...section.matchAll(/€\s?([\d.,]+)/g)].map((m) =>
      parseFloat(m[1].replace(/,/g, ''))
    );
    const price = prices.length ? Math.min(...prices) : null;
    return { price, url };
  } finally {
    await page.close();
  }
}

module.exports = { fetchLowestPrice };
