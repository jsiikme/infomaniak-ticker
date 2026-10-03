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
const PERIOD_MIN = 1;
const ICON_SIZES = [16, 32, 48, 128];

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

  const imageData = {};
  for (const size of ICON_SIZES) {
    const data = drawIcon(size);
    if (data) imageData[size] = data;
  }
  if (Object.keys(imageData).length > 0) {
    await chrome.action.setIcon({ imageData });
  }

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

// Icône : pastille bleue saturée (comme les icônes voisines qui se lisent
// d'un coup d'œil) + « info » blanc en Arial Black, ajusté par mesure réelle.
function drawIcon(size) {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const s = size / 32;

    roundedRectPath(ctx, 0, 0, size, size, 6 * s);
    ctx.fillStyle = COLORS.blue;
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = `900 ${32 * s}px "Arial Black", "Arial Bold", Arial, sans-serif`;
    const m = ctx.measureText('info');
    const kx = (27 * s) / Math.max(m.width, 1);
    const ky = kx * 1.9;
    ctx.save();
    ctx.translate(size / 2, 0);
    ctx.scale(kx, ky);
    ctx.fillText('info', 0, 24 * s / ky);
    ctx.restore();

    return ctx.getImageData(0, 0, size, size);
  } catch (err) {
    console.error('drawIcon:', err);
    return null;
  }
}

function roundedRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
