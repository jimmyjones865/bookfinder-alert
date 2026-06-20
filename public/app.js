function showFeedback(el, type, message) {
  el.className = `feedback feedback-${type} visible`;
  el.textContent = message;
}
function clearFeedback(el) {
  el.className = 'feedback';
  el.textContent = '';
}
async function apiFetch(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const res = await fetch(url, {
    headers: isFormData ? {} : { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

const loginView = document.getElementById('login-view');
const appView = document.getElementById('app-view');
const loginForm = document.getElementById('login-form');
const loginFeedback = document.getElementById('login-feedback');
const addForm = document.getElementById('add-form');
const addFeedback = document.getElementById('add-feedback');
const bookList = document.getElementById('book-list');
const listEmpty = document.getElementById('list-empty');
const checkNowBtn = document.getElementById('check-now-btn');
const logoutBtn = document.getElementById('logout-btn');

function showView(view) {
  loginView.classList.toggle('hidden', view !== 'login');
  appView.classList.toggle('hidden', view !== 'app');
}

function fmtPrice(p) {
  return p === null || p === undefined ? '—' : `€${Number(p).toFixed(2)}`;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleString() : '—';
}

function renderBooks(books) {
  bookList.innerHTML = '';
  listEmpty.classList.toggle('hidden', books.length > 0);
  for (const b of books) {
    const tr = document.createElement('tr');
    const label = [b.title, b.author].filter(Boolean).join(' — ') || b.isbn || '(unnamed)';
    const bf = b.sources?.bookfinder || {};
    const vl = b.sources?.vialibri || {};
    tr.innerHTML = `
      <td>${label}${b.isbn ? `<br><span class="mono muted">${b.isbn}</span>` : ''}</td>
      <td>${fmtPrice(b.thresholdPrice)}</td>
      <td>${fmtPrice(b.lastSeenPrice)}</td>
      <td class="muted">${fmtDate(b.lastCheckedAt)}</td>
      <td>${bf.url ? `<a href="${bf.url}" target="_blank" rel="noopener">${fmtPrice(bf.price)}</a>` : '—'}</td>
      <td>${vl.url ? `<a href="${vl.url}" target="_blank" rel="noopener">${fmtPrice(vl.price)}</a>` : 'not checked yet'}</td>
      <td><button class="btn btn-destructive btn-sm" data-id="${b.id}">Delete</button></td>
    `;
    bookList.appendChild(tr);
  }
}

async function loadBooks() {
  const books = await apiFetch('/api/books');
  renderBooks(books);
}

async function init() {
  const { authed } = await apiFetch('/api/session');
  if (authed) {
    showView('app');
    await loadBooks();
  } else {
    showView('login');
  }
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFeedback(loginFeedback);
  const password = document.getElementById('password').value;
  try {
    await apiFetch('/api/login', { method: 'POST', body: JSON.stringify({ password }) });
    showView('app');
    await loadBooks();
  } catch (err) {
    showFeedback(loginFeedback, 'error', err.message);
  }
});

logoutBtn.addEventListener('click', async () => {
  await apiFetch('/api/logout', { method: 'POST' });
  showView('login');
});

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearFeedback(addFeedback);
  const fd = new FormData(addForm);
  const payload = {
    author: fd.get('author').trim(),
    title: fd.get('title').trim(),
    isbn: fd.get('isbn').trim(),
    thresholdPrice: parseFloat(fd.get('thresholdPrice')),
  };
  try {
    await apiFetch('/api/books', { method: 'POST', body: JSON.stringify(payload) });
    addForm.reset();
    await loadBooks();
  } catch (err) {
    showFeedback(addFeedback, 'error', err.message);
  }
});

bookList.addEventListener('click', async (e) => {
  const id = e.target.dataset.id;
  if (!id) return;
  if (!confirm('Delete this book from the watch list?')) return;
  await apiFetch(`/api/books/${id}`, { method: 'DELETE' });
  await loadBooks();
});

checkNowBtn.addEventListener('click', async () => {
  checkNowBtn.disabled = true;
  checkNowBtn.textContent = 'Checking...';
  try {
    await apiFetch('/api/check-now', { method: 'POST' });
    setTimeout(() => {
      checkNowBtn.disabled = false;
      checkNowBtn.textContent = 'Check now';
      loadBooks();
    }, 8000);
  } catch (err) {
    checkNowBtn.disabled = false;
    checkNowBtn.textContent = 'Check now';
    alert(err.message);
  }
});

init();
