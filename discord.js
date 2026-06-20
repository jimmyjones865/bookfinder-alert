async function sendAlert(book, price, searchUrl, source) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('DISCORD_WEBHOOK_URL not set, skipping alert');
    return;
  }
  const label = [book.title, book.author].filter(Boolean).join(' — ') || book.isbn;
  const content = `📚 **${label}** dropped to **€${price.toFixed(2)}** on ${source} (threshold €${book.thresholdPrice.toFixed(2)})\n${searchUrl}`;

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    throw new Error(`Discord webhook responded ${res.status}`);
  }
}

module.exports = { sendAlert };
