import {
  DEFAULT_INFO,
  SIX_PAGE_URL,
  YAHOO_PAGE_URL,
  trend,
  formatPrice,
  formatDelta,
  formatPct,
  formatVolume,
} from '../lib/quote.js';

const els = {
  company: document.getElementById('company'),
  symbol: document.getElementById('symbol'),
  isin: document.getElementById('isin'),
  price: document.getElementById('price'),
  currency: document.getElementById('currency'),
  change: document.getElementById('change'),
  open: document.getElementById('open'),
  prevClose: document.getElementById('prevClose'),
  high: document.getElementById('high'),
  low: document.getElementById('low'),
  volume: document.getElementById('volume'),
  marketTime: document.getElementById('marketTime'),
  error: document.getElementById('error'),
  refresh: document.getElementById('refresh'),
  updatedAt: document.getElementById('updatedAt'),
  sixLink: document.getElementById('sixLink'),
  yahooLink: document.getElementById('yahooLink'),
};

document.addEventListener('DOMContentLoaded', render);
chrome.storage.onChanged.addListener((_changes, area) => {
  if (area === 'local') void render();
});

els.refresh.addEventListener('click', async () => {
  els.refresh.disabled = true;
  els.refresh.textContent = 'Actualisation…';
  try {
    await chrome.runtime.sendMessage({ type: 'refresh' });
  } finally {
    els.refresh.disabled = false;
    els.refresh.textContent = 'Actualiser';
  }
});

async function render() {
  const { quote, info, status, error, updatedAt } = await chrome.storage.local.get(null);
  const merged = { ...DEFAULT_INFO, ...(info || {}) };

  els.company.textContent = merged.name;
  els.symbol.textContent = merged.valorSymbol;
  els.isin.textContent = merged.isin;
  els.sixLink.href = SIX_PAGE_URL;
  els.yahooLink.href = YAHOO_PAGE_URL;

  if (status === 'error' && error) {
    showError(error);
  } else {
    els.error.classList.add('hidden');
  }

  if (!quote) return;

  els.price.textContent = formatPrice(quote.price);
  els.currency.textContent = quote.currency;

  const t = trend(quote.delta);
  const arrow = t === 'up' ? '▲' : t === 'down' ? '▼' : '•';
  els.change.textContent = `${arrow} ${formatDelta(quote.delta)} (${formatPct(quote.pct)})`;
  els.change.className = `change ${t}`;

  els.open.textContent = formatPrice(quote.open);
  els.prevClose.textContent = formatPrice(quote.prevClose);
  els.high.textContent = formatPrice(quote.high);
  els.low.textContent = formatPrice(quote.low);
  els.volume.textContent = formatVolume(quote.volume);
  els.marketTime.textContent = quote.marketTime || '—';

  if (updatedAt) {
    els.updatedAt.textContent = `Maj ${new Date(updatedAt).toLocaleTimeString('fr-CH')}`;
  }
}

function showError(message) {
  els.error.textContent = `Erreur : ${message}`;
  els.error.classList.remove('hidden');
}
