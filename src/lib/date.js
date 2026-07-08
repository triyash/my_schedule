export const DATE_FMT = new Intl.DateTimeFormat('en-CA')

export function toDateKey(date = new Date()) {
  return DATE_FMT.format(date)
}

export function fromDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(dateKey, amount) {
  const dt = fromDateKey(dateKey)
  dt.setDate(dt.getDate() + amount)
  return toDateKey(dt)
}

export function compareDateKeys(a, b) {
  if (a === b) {
    return 0
  }
  return a < b ? -1 : 1
}

export function getStartOfWeek(dateKey, weekStartsOn = 1) {
  const dt = fromDateKey(dateKey)
  const day = dt.getDay()
  const delta = (day - weekStartsOn + 7) % 7
  dt.setDate(dt.getDate() - delta)
  return toDateKey(dt)
}

export function getEndOfWeek(dateKey, weekStartsOn = 1) {
  return addDays(getStartOfWeek(dateKey, weekStartsOn), 6)
}

export function getMonthStart(dateKey) {
  const dt = fromDateKey(dateKey)
  dt.setDate(1)
  return toDateKey(dt)
}

export function getMonthEnd(dateKey) {
  const dt = fromDateKey(dateKey)
  dt.setMonth(dt.getMonth() + 1, 0)
  return toDateKey(dt)
}

export function getDateRange(startDateKey, endDateKey) {
  const result = []
  let cursor = startDateKey

  while (compareDateKeys(cursor, endDateKey) <= 0) {
    result.push(cursor)
    cursor = addDays(cursor, 1)
  }

  return result
}

export function humanDate(dateKey, options = {}) {
  return fromDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: options.weekday || undefined,
    month: options.month || 'short',
    day: options.day || 'numeric',
    year: options.year || undefined,
  })
}
