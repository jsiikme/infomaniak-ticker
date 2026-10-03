export const VALOR_ID = 'CH1609605055CHF4';
export const ISIN = 'CH1609605055';
export const CURRENCY = 'CHF';

export const SIX_PAGE_URL =
  'https://www.six-group.com/en/market-data/shares/share-explorer/share-details.CH1609605055CHF4.html';

export const DEFAULT_INFO = { name: 'INFOMANIK N', valorSymbol: 'INFO', isin: ISIN };

export const FQS_FIELDS = [
  'ClosingPrice',
  'ClosingDelta',
  'ClosingPerformance',
  'PreviousClosingPrice',
  'OpeningPrice',
  'DailyHighPrice',
  'DailyLowPrice',
  'TotalVolume',
  'MarketTime',
];

export const FQS_URL =
  `https://www.six-group.com/fqs/movie.json?select=${FQS_FIELDS.join(',')}` +
  `&where=ValorId%3D${VALOR_ID}`;

export const INFO_URL = `https://www.six-group.com/sheldon/share_details/v3/${VALOR_ID}/overview/info.json`;

export function num(value) {
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function parseMovie(data) {
  if (!data || !Array.isArray(data.colNames) || !Array.isArray(data.rowData) || data.rowData.length === 0) {
    throw new Error('Réponse FQS inattendue');
  }
  const fields = {};
  data.colNames.forEach((name, i) => {
    fields[name] = data.rowData[0][i];
  });
  const price = num(fields.ClosingPrice);
  if (price == null) throw new Error('Prix absent de la réponse FQS');
  return {
    price,
    delta: num(fields.ClosingDelta) ?? 0,
    pct: num(fields.ClosingPerformance) ?? 0,
    prevClose: num(fields.PreviousClosingPrice),
    open: num(fields.OpeningPrice),
    high: num(fields.DailyHighPrice),
    low: num(fields.DailyLowPrice),
    volume: num(fields.TotalVolume),
    marketTime: formatMarketTime(fields.MarketTime),
    currency: CURRENCY,
    fetchedAt: Date.now(),
  };
}

export function formatMarketTime(value) {
  if (value == null) return '';
  const s = String(Math.round(Number(value))).padStart(6, '0');
  if (!/^\d{6}$/.test(s)) return String(value);
  return `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}`;
}

export function parseInfo(data) {
  const item = data && Array.isArray(data.itemList) ? data.itemList[0] : null;
  if (!item) return null;
  const info = {};
  if (item.name) info.name = item.name;
  if (item.valorSymbol) info.valorSymbol = item.valorSymbol;
  if (item.isin) info.isin = item.isin;
  return Object.keys(info).length > 0 ? info : null;
}

export function trend(delta) {
  return delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
}

export function iconPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  if (p >= 1000) return String(Math.round(p));
  if (p >= 100) return p.toFixed(1);
  return p.toFixed(2);
}

export function badgePrice(p) {
  if (p == null || !Number.isFinite(p)) return '?';
  if (p >= 1000) return String(Math.round(p));
  if (p >= 10) return p.toFixed(1);
  return p.toFixed(2);
}

export function formatPrice(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  return p.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDelta(d) {
  if (d == null || !Number.isFinite(d)) return '—';
  return (d > 0 ? '+' : '') + d.toFixed(2).replace('.', ',');
}

export function formatPct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  return (p > 0 ? '+' : '') + p.toFixed(2).replace('.', ',') + ' %';
}

export function formatVolume(v) {
  if (v == null || !Number.isFinite(v)) return '—';
  return Math.round(v).toLocaleString('fr-CH');
}
