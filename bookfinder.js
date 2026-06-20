const { chromium } = require('playwright');

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function buildSearchUrl({ author, title, isbn }) {
  const params = new URLSearchParams({
    author: author || '',
    title: title || '',
    isbn: isbn || '',
    currency: 'EUR',
    destination: 'DE',
    viewAll: 'true',
    binding: 'ANY',
    condition: 'ANY',
  });
  return `https://www.bookfinder.com/search/?${params.toString()}`;
}

// bookfinder.com sits behind an AWS WAF JS challenge - plain fetch/cheerio gets
// blocked (202, empty body). A real browser is required to pass the challenge.
async function fetchLowestPrice(book, browser) {
  const url = buildSearchUrl(book);
  const page = await browser.newPage({ userAgent: USER_AGENT });
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    const text = await page.evaluate(() => document.body.innerText);

    const marker = 'Search results loaded.';
    const idx = text.indexOf(marker);
    if (idx === -1) return null; // no results, or page structure changed
    const section = text.slice(idx);

    const prices = [...section.matchAll(/€\s?([\d.,]+)/g)].map((m) =>
      parseFloat(m[1].replace(/,/g, ''))
    );
    if (prices.length === 0) return null;
    return Math.min(...prices);
  } finally {
    await page.close();
  }
}

module.exports = { buildSearchUrl, fetchLowestPrice, launchBrowser: () => chromium.launch() };
