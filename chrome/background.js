import {
  FQS_URL,
  INFO_URL,
  DEFAULT_INFO,
  parseMovie,
  parseInfo,
  badgePrice,
  trend,
  formatPrice,
  formatDelta,
  formatPct,
} from './lib/quote.js';

const ALARM_NAME = 'refresh-quote';
const PERIOD_MIN = 15;

const COLORS = {
  up: '#12B76A',
  down: '#F04438',
  flat: '#667085',
  blue: '#0098FF',
  badgeText: '#FFFFFF',
};

chrome.runtime.onInstalled.addListener(() => {
  scheduleAlarm();
  void refresh();
});

chrome.runtime.onStartup.addListener(() => {
  scheduleAlarm();
  void refresh();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) void refresh();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'refresh') {
    refresh()
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ ok: false }));
    return true;
  }
  return false;
});

function scheduleAlarm() {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: PERIOD_MIN, delayInMinutes: 1 });
}

async function refresh() {
  try {
    const quote = await fetchQuote();
    const info = await fetchInfo();
    await chrome.storage.local.set({ quote, info, status: 'ok', error: null, updatedAt: Date.now() });
    await applyUi(quote, info);
  } catch (err) {
    const message = err && err.message ? err.message : String(err);
    await chrome.storage.local.set({ quote: null, info: null, status: 'error', error: message, updatedAt: Date.now() });
    await setFallbackUi(message);
  }
}

async function fetchQuote() {
  const res = await fetch(FQS_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseMovie(await res.json());
}

async function fetchInfo() {
  try {
    const res = await fetch(INFO_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return parseInfo(await res.json());
  } catch {
    return null;
  }
}

async function applyUi(quote, info) {
  const merged = { ...DEFAULT_INFO, ...(info || {}) };
  const t = trend(quote.delta);
  const arrow = t === 'up' ? '▲' : t === 'down' ? '▼' : '•';

  await chrome.action.setBadgeBackgroundColor({ color: arrowColor(t) });
  await chrome.action.setBadgeTextColor({ color: COLORS.badgeText });
  await chrome.action.setBadgeText({ text: badgePrice(quote.price) });
  await chrome.action.setTitle({
    title:
      `${merged.valorSymbol} · ${merged.name}\n` +
      `${formatPrice(quote.price)} ${quote.currency} ${arrow} ${formatDelta(quote.delta)} (${formatPct(quote.pct)})\n` +
      `SIX ${quote.marketTime} · données différées ~15 min`,
  });
}

async function setFallbackUi(message) {
  await chrome.action.setBadgeBackgroundColor({ color: COLORS.flat });
  await chrome.action.setBadgeText({ text: '!' });
  await chrome.action.setTitle({ title: `INFO ticker — erreur : ${message ?? 'inconnue'}` });
}

function arrowColor(t) {
  if (t === 'up') return COLORS.up;
  if (t === 'down') return COLORS.down;
  return COLORS.flat;
}
