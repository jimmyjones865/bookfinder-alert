const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// viaLibri has no dedicated ISBN field on its basic search form - ISBN goes
// through the free-text "all_text" field instead (confirmed: it labels the
// resulting search "Keywords / ISBN").
// Search result URLs are server-signed (?s=...) and can't be built from raw
// query params, so we always drive the actual form to get a valid URL.
async function fetchLowestPrice(book, browser) {
  const page = await browser.newPage({ userAgent: USER_AGENT });
  try {
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

    if (!page.url().includes('/searches?')) return null; // search error page

    const sortedUrl = `${page.url()}&sort=price.asc`;
    await page.goto(sortedUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);

    const text = await page.evaluate(() => document.body.innerText);
    const idx = text.indexOf('matches from');
    if (idx === -1) return { price: null, url: page.url() }; // no results

    const section = text.slice(idx);
    const prices = [...section.matchAll(/€\s?([\d.,]+)/g)].map((m) =>
      parseFloat(m[1].replace(/,/g, ''))
    );
    const price = prices.length ? Math.min(...prices) : null;
    return { price, url: page.url() };
  } finally {
    await page.close();
  }
}

module.exports = { fetchLowestPrice };
