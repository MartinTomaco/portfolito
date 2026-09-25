export const MIN_OFFSET = -95;
export const MAX_OFFSET = 900;
export const FAST_MULTIPLIER = 5;

export function isValidPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function cleanNumber(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return parseFloat(value.toPrecision(10));
}

export function getRealPrice(precios, symbol) {
  const entry = precios?.[symbol];
  if (!entry || typeof entry !== 'object') return null;
  return isValidPrice(entry.price) ? entry.price : null;
}

export function isSimulatedOffset(offset) {
  return typeof offset === 'number' && Number.isFinite(offset) && offset !== 0;
}

export function adaptiveStep(price) {
  if (!isValidPrice(price)) return 0;

  const raw = price * 0.01;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const factor = normalized >= 5 ? 5 : normalized >= 2 ? 2 : 1;

  return cleanNumber(factor * magnitude);
}

export function stepPct(price) {
  const step = adaptiveStep(price);
  if (!(step > 0) || !isValidPrice(price)) return 0;
  return cleanNumber((step / price) * 100);
}

export function clampOffset(offset, min = MIN_OFFSET, max = MAX_OFFSET) {
  if (typeof offset !== 'number' || !Number.isFinite(offset)) return 0;
  return Math.min(Math.max(offset, min), max);
}

export function applyScrollOffset(currentOffset, direction, price, options = {}) {
  const { fast = false, steps = 1, min = MIN_OFFSET, max = MAX_OFFSET } = options;

  const offset = clampOffset(currentOffset, min, max);
  const pct = stepPct(price);
  if (!(pct > 0)) return offset;

  const multiplier = fast ? FAST_MULTIPLIER : 1;
  const delta = pct * (direction >= 0 ? 1 : -1) * multiplier * steps;

  return clampOffset(offset + delta, min, max);
}

export function getEffectivePrice(realPrice, offset) {
  if (!isValidPrice(realPrice)) return null;
  const pct = isSimulatedOffset(offset) ? offset : 0;
  return cleanNumber(realPrice * (1 + pct / 100));
}

export function computeSnapshot(portfolio = {}, precios = {}, simulaciones = {}) {
  const porActivo = {};
  const simulatedSymbols = [];
  let total = 0;
  let realTotal = 0;

  Object.entries(portfolio).forEach(([symbol, amount]) => {
    const realPrice = getRealPrice(precios, symbol);
    const offset = realPrice !== null && isSimulatedOffset(simulaciones?.[symbol]) ? simulaciones[symbol] : 0;
    const price = realPrice === null ? null : getEffectivePrice(realPrice, offset);
    const units = typeof amount === 'number' && Number.isFinite(amount) ? amount : 0;
    const value = price === null ? 0 : cleanNumber(units * price);
    const realValue = realPrice === null ? 0 : cleanNumber(units * realPrice);

    if (offset !== 0) simulatedSymbols.push(symbol);

    porActivo[symbol] = {
      amount: units,
      realPrice,
      price,
      offset,
      isSimulated: offset !== 0,
      value,
      realValue,
      delta: cleanNumber(value - realValue)
    };

    total = cleanNumber(total + value);
    realTotal = cleanNumber(realTotal + realValue);
  });

  const totalDelta = cleanNumber(total - realTotal);
  const totalDeltaPct = realTotal > 0 ? cleanNumber((totalDelta / realTotal) * 100) : 0;

  return {
    porActivo,
    total,
    realTotal,
    totalDelta,
    totalDeltaPct,
    hasSim: simulatedSymbols.length > 0,
    simulatedSymbols
  };
}

export function formatPrice(value) {
  if (!isValidPrice(value)) return null;
  const absValue = Math.abs(value);
  const decimals = absValue >= 1 ? 2 : absValue >= 0.01 ? 4 : 6;
  return value.toFixed(decimals);
}

export function formatUsd(value, options = {}) {
  const { signed = false } = options;

  if (typeof value !== 'number' || !Number.isFinite(value)) return '0';

  const absValue = Math.abs(value);
  const body = absValue < 1000 ? absValue.toFixed(1) : Math.round(absValue).toString();

  if (value < 0) return `-${body}`;
  if (signed && value > 0) return `+${body}`;
  return body;
}

export function formatPercent(value, options = {}) {
  const { signed = true } = options;

  if (typeof value !== 'number' || !Number.isFinite(value)) return '0.0%';

  const prefix = signed && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}
