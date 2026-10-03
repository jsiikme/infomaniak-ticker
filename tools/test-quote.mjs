import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import {
  parseMovie,
  parseInfo,
  formatMarketTime,
  iconPrice,
  badgePrice,
  trend,
  formatPct,
  formatDelta,
  formatVolume,
} from '../chrome/lib/quote.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/movie.json', import.meta.url), 'utf8'));
const quote = parseMovie(fixture);

const cell = (name) => fixture.rowData[0][fixture.colNames.indexOf(name)];
const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

assert(quote.price === n(cell('ClosingPrice')), `price: ${quote.price}`);
assert(quote.delta === (n(cell('ClosingDelta')) ?? 0), `delta: ${quote.delta}`);
assert(quote.pct === (n(cell('ClosingPerformance')) ?? 0), `pct: ${quote.pct}`);
assert(quote.prevClose === n(cell('PreviousClosingPrice')), `prevClose: ${quote.prevClose}`);
assert(quote.open === n(cell('OpeningPrice')), `open: ${quote.open}`);
assert(quote.high === n(cell('DailyHighPrice')), `high: ${quote.high}`);
assert(quote.low === n(cell('DailyLowPrice')), `low: ${quote.low}`);
assert(quote.volume === n(cell('TotalVolume')), `volume: ${quote.volume}`);
assert(quote.currency === 'CHF', `currency: ${quote.currency}`);
assert(/^\d{2}:\d{2}:\d{2}$/.test(quote.marketTime), `marketTime: ${quote.marketTime}`);
assert(quote.marketTime === formatMarketTime(cell('MarketTime')), `marketTime mapping: ${quote.marketTime}`);

assert(trend(0.8) === 'up');
assert(trend(-0.1) === 'down');
assert(trend(0) === 'flat');

assert(iconPrice(85.75) === '85.75');
assert(iconPrice(732.2) === '732.2');
assert(iconPrice(1234.56) === '1235');
assert(badgePrice(85.75) === '85.8');
assert(badgePrice(85.75).length <= 4);
assert(badgePrice(1234.56) === '1235');
assert(badgePrice(7.777) === '7.78');

assert(formatMarketTime(134139) === '13:41:39');
assert(formatMarketTime('94139') === '09:41:39');
assert(formatMarketTime(null) === '');

assert(formatPct(0.94) === '+0,94 %');
assert(formatPct(-1.2) === '-1,20 %');
assert(formatDelta(0.8) === '+0,80');
assert(formatDelta(-0.8) === '-0,80');
assert(formatVolume(49175).includes('49'));

const info = parseInfo({
  itemList: [{ name: 'INFOMANIAK N', valorSymbol: 'INFO', isin: 'CH1609605055' }],
});
assert(info.name === 'INFOMANIAK N');
assert(parseInfo({ itemList: [] }) === null);

console.log('Tous les tests passent ✔');
