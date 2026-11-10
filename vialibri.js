const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// Result URLs are server-signed (?s=...) over author/title/all_text only, so
// other params can be dropped/appended freely. Dropping matters: a logged-in
// form search carries over the account's last-used filters (years, sort, ...).
function withFilters(signedUrl, { yearFrom, yearTo }) {
  const src = new URL(signedUrl);
  const u = new URL('https://www.vialibri.net/searches');
  for (const k of ['author', 'title', 'all_text', 's']) {
    if (src.searchParams.has(k)) u.searchParams.set(k, src.searchParams.get(k));
  }
  u.searchParams.set('sort', 'price.asc');
  if (yearFrom) u.searchParams.set('year_min', yearFrom);
  if (yearTo) u.searchParams.set('year_max', yearTo);
  return u.toString();
}

// Form search requires a logged-in account; signed URLs work without one.
async function login(page) {
  const { VIALIBRI_USER, VIALIBRI_PASS } = process.env;
  if (!VIALIBRI_USER || !VIALIBRI_PASS) return false;
  await page.goto('https://www.vialibri.net/account/login', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', VIALIBRI_USER);
  await page.fill('#password', VIALIBRI_PASS);
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => null),
    page.click('button:has-text("Log in")'),
  ]);
  if (page.url().includes('/account/login')) {
    console.error('viaLibri login failed (check VIALIBRI_USER/VIALIBRI_PASS)');
    return false;
  }
  return true;
}

// viaLibri has no dedicated ISBN field on its basic search form - ISBN goes
// through the free-text "all_text" field (it labels these "Keywords / ISBN").
async function getSignedUrl(book, page) {
  const stored = book.sources?.vialibri?.url;
  if (stored && stored.includes('/searches?') && stored.includes('s=')) return stored;

  if (!(await login(page))) return null;
  await page.goto('https://www.vialibri.net/', { waitUntil: 'networkidle', timeout: 30000 });
  // Explicit '' clears values the account pre-fills from its last search.
  await page.fill('#all_text', book.isbn || '');
  await page.fill('#author', book.isbn ? '' : book.author || '');
  await page.fill('#title', book.isbn ? '' : book.title || '');
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
      console.warn(`viaLibri: no signed search URL for ${book.id}`);
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
