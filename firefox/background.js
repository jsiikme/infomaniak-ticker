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
const PERIOD_MIN = 5;
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

// Icône : logotype « info » officiel (4 premières lettres du SVG Infomaniak), bleu,
// sans fond, ajusté aux 7 lignes du haut — à 1x, le badge du cours et le liseré
// que Chrome efface autour de lui recouvrent les lignes 7 à 15.
const INFO_PATH =
  'm1.54980469 8.53613281h4.57080078v3.11083989h-4.57080078zm0 4.53710939h4.57080078v11.9267578h-4.57080078zm7.19072264 0h4.25634767v1.9428711c.6363964-.7936238 1.2802702-1.3607568 1.9316406-1.701416.6513705-.3406593 1.4449823-.5109864 2.3808594-.5109864 1.2653058 0 2.2554489.376217 2.970459 1.1286621.7150101.7524452 1.0725097 1.9147871 1.0725097 3.4870606v7.5805664h-4.5932617v-6.5585938c0-.7487016-.1385077-1.2784001-.4155273-1.5891113s-.6663387-.4660644-1.1679688-.4660644c-.5540392 0-1.0032535.2096333-1.3476562.6289062-.3444028.4192729-.5166016 1.1717068-.5166016 2.2573242v5.7275391h-4.57080077zm20.12822267 0h2.1787109v3.3466797h-2.1787109v8.5800781h-4.5820313v-8.5800781h-1.7070312v-3.3466797h1.7070312v-.5390625c0-.4866561.0524084-1.0219697.1572266-1.605957s.3013495-1.06127749.5895996-1.43188481.692543-.67008349 1.2128906-.8984375c.5203477-.22835401 1.2821402-.3425293 2.2854004-.3425293.8011108 0 1.9653244.09358631 3.4926758.28076172l-.5053711 2.76269529c-.5465522-.0898442-.9882796-.1347656-1.3251953-.1347656-.4117859 0-.7075186.0692539-.887207.2077637s-.3069658.3575017-.381836.6569824c-.0374351.1647144-.0561523.5128554-.0561523 1.0444336zm2.6086914 5.9970703c0-1.819345.6139261-3.3185976 1.8417968-4.4978027 1.2278708-1.1792051 2.8862201-1.7687989 4.9750977-1.7687989 2.3883583 0 4.1927022.6925387 5.4130859 2.0776368.9807992 1.1155654 1.4711914 2.4894124 1.4711914 4.121582 0 1.8343191-.6083109 3.3373151-1.8249511 4.5090332s-2.899322 1.7575683-5.0480957 1.7575683c-1.9166763 0-3.4664655-.4866487-4.6494141-1.4599609-1.4524812-1.2054097-2.1787109-2.7851465-2.1787109-4.7392578zm4.5820312-.0112305c0 1.0631564.2152485 1.8492813.645752 2.3583985.4305034.5091171.9714323.7636718 1.6228027.7636718.6588575 0 1.1997863-.2508113 1.6228027-.7524414.4230165-.5016301.6345215-1.3064723.6345215-2.4145507 0-1.0332083-.2133767-1.8024878-.6401367-2.3078614-.4267599-.5053736-.9545867-.7580566-1.5834961-.7580566-.6663445 0-1.2166319.2564265-1.6508789.7692871s-.6513672 1.2933704-.6513672 2.3415527z';
const INFO_BBOX = { x: 1.5498, y: 8.2554, w: 43.6288, h: 17.0142 };
const VISIBLE_ROWS = 7; // sur une grille de 16

function drawIcon(size) {
  try {
    if (typeof OffscreenCanvas === 'undefined') return null;
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const k = size / 16;
    const s = Math.min(16 / INFO_BBOX.w, VISIBLE_ROWS / INFO_BBOX.h) * k;

    ctx.translate(
      (size - INFO_BBOX.w * s) / 2 - INFO_BBOX.x * s,
      (VISIBLE_ROWS * k - INFO_BBOX.h * s) / 2 - INFO_BBOX.y * s,
    );
    ctx.scale(s, s);
    ctx.fillStyle = COLORS.blue;
    ctx.fill(new Path2D(INFO_PATH), 'evenodd');

    return ctx.getImageData(0, 0, size, size);
  } catch (err) {
    console.error('drawIcon:', err);
    return null;
  }
}
