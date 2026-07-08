import {
  addDays,
  compareDateKeys,
  fromDateKey,
  getDateRange,
  getEndOfWeek,
  getMonthEnd,
  getMonthStart,
  getStartOfWeek,
  toDateKey,
} from './date'

const VERSION = 1

function makeId(prefix) {
  const random = Math.random().toString(36).slice(2, 9)
  return `${prefix}_${Date.now()}_${random}`
}

function seedTask(categoryId, task) {
  return {
    id: makeId('task'),
    categoryId,
    label: task.label,
    type: task.type || 'checkbox',
    recurrence: task.recurrence || 'daily',
    order: task.order || 0,
    active: true,
    createdOn: toDateKey(),
    archivedOn: null,
    completedOn: null,
    placeholder: task.placeholder || '',
  }
}

export function makeDefaultState() {
  const today = toDateKey()

  const categories = [
    {
      id: makeId('cat'),
      name: 'World Politics & Current Affairs (20-30 min)',
      order: 0,
      active: true,
      createdOn: today,
      archivedOn: null,
    },
    {
      id: makeId('cat'),
      name: 'Full-Stack Web Development (2-3 hrs)',
      order: 1,
      active: true,
      createdOn: today,
      archivedOn: null,
    },
    {
      id: makeId('cat'),
      name: 'Gym & Fitness (1-1.5 hrs)',
      order: 2,
      active: true,
      createdOn: today,
      archivedOn: null,
    },
    {
      id: makeId('cat'),
      name: 'Personal Growth (20-30 min)',
      order: 3,
      active: true,
      createdOn: today,
      archivedOn: null,
    },
  ]

  const tasks = [
    seedTask(categories[0].id, { label: "Read today's world news", order: 0 }),
    seedTask(categories[0].id, { label: 'Learn one new country/event/topic', order: 1 }),
    seedTask(categories[0].id, { label: 'Understand why it matters', order: 2 }),
    seedTask(categories[0].id, {
      label: 'Write one key takeaway',
      type: 'text',
      placeholder: 'One key takeaway...',
      order: 3,
    }),

    seedTask(categories[1].id, { label: "Complete today's lesson", order: 0 }),
    seedTask(categories[1].id, { label: 'Practice coding', order: 1 }),
    seedTask(categories[1].id, { label: 'Solve 2-5 coding problems', order: 2 }),
    seedTask(categories[1].id, { label: "Review yesterday's concepts", order: 3 }),
    seedTask(categories[1].id, { label: 'Push code to GitHub (if applicable)', order: 4 }),

    seedTask(categories[2].id, { label: "Complete today's workout", order: 0 }),
    seedTask(categories[2].id, { label: 'Warm up', order: 1 }),
    seedTask(categories[2].id, { label: 'Stretch', order: 2 }),
    seedTask(categories[2].id, { label: 'Drink 3-4 L water', order: 3 }),
    seedTask(categories[2].id, {
      label: 'Protein goal 110-120g',
      type: 'number',
      placeholder: 'grams',
      order: 4,
    }),
    seedTask(categories[2].id, {
      label: 'Sleep 7.5-8.5 hrs',
      type: 'number',
      placeholder: 'hours',
      order: 5,
    }),

    seedTask(categories[3].id, { label: 'Read a book', order: 0 }),
    seedTask(categories[3].id, { label: 'Learn AI/technology', order: 1 }),
    seedTask(categories[3].id, { label: 'Practice communication', order: 2 }),
    seedTask(categories[3].id, { label: 'Learn something outside college', order: 3 }),
  ]

  return {
    version: VERSION,
    theme: 'dark',
    categories,
    tasks,
    days: {},
  }
}

export function isCategoryApplicableOnDate(category, dateKey) {
  if (!category) {
    return false
  }
  if (compareDateKeys(category.createdOn, dateKey) > 0) {
    return false
  }
  if (category.archivedOn && compareDateKeys(dateKey, category.archivedOn) >= 0) {
    return false
  }
  return true
}

export function isTaskApplicableOnDate(task, dateKey) {
  if (!task) {
    return false
  }
  if (compareDateKeys(task.createdOn, dateKey) > 0) {
    return false
  }
  if (task.archivedOn && compareDateKeys(dateKey, task.archivedOn) >= 0) {
    return false
  }
  if (task.recurrence === 'one-time' && task.completedOn && compareDateKeys(dateKey, task.completedOn) >= 0) {
    return false
  }
  return true
}

function ensureDay(days, dateKey) {
  if (days[dateKey]) {
    return days[dateKey]
  }

  return {
    date: dateKey,
    values: {},
    notes: {
      biggestWin: '',
      learned: '',
      improveTomorrow: '',
    },
  }
}

export function upsertTaskValue({ state, dateKey, task, category, nextValue }) {
  const days = { ...state.days }
  const day = ensureDay(days, dateKey)

  const currentTaskValue = day.values[task.id] || {}
  const mergedValue = {
    ...currentTaskValue,
    ...nextValue,
    taskLabelSnapshot: task.label,
    taskTypeSnapshot: task.type,
    categoryIdSnapshot: category.id,
    categoryLabelSnapshot: category.name,
    recurrenceSnapshot: task.recurrence,
    updatedAt: Date.now(),
  }

  days[dateKey] = {
    ...day,
    values: {
      ...day.values,
      [task.id]: mergedValue,
    },
  }

  return {
    ...state,
    days,
    tasks: state.tasks.map((item) => {
      if (item.id !== task.id || item.recurrence !== 'one-time') {
        return item
      }

      const taskDone = isTaskValueComplete(mergedValue, item.type)
      return {
        ...item,
        completedOn: taskDone ? dateKey : null,
      }
    }),
  }
}

export function updateDayNotes(state, dateKey, notesPatch) {
  const days = { ...state.days }
  const day = ensureDay(days, dateKey)

  days[dateKey] = {
    ...day,
    notes: {
      ...day.notes,
      ...notesPatch,
    },
  }

  return {
    ...state,
    days,
  }
}

export function isTaskValueComplete(value, taskType) {
  if (!value) {
    return false
  }

  if (taskType === 'checkbox') {
    return value.checked === true
  }

  if (taskType === 'number') {
    const raw = value.numberValue
    if (raw === '' || raw === null || raw === undefined) {
      return false
    }
    return Number.isFinite(Number(raw))
  }

  if (taskType === 'text') {
    return typeof value.textValue === 'string' && value.textValue.trim().length > 0
  }

  return false
}

export function getActiveCategoriesForDate(state, dateKey) {
  return state.categories
    .filter((category) => isCategoryApplicableOnDate(category, dateKey))
    .sort((a, b) => a.order - b.order)
}

export function getTasksForCategoryDate(state, categoryId, dateKey) {
  return state.tasks
    .filter((task) => task.categoryId === categoryId && isTaskApplicableOnDate(task, dateKey))
    .sort((a, b) => a.order - b.order)
}

export function getDailyCategoryBreakdown(state, dateKey) {
  const day = state.days[dateKey] || { values: {} }
  const categories = getActiveCategoriesForDate(state, dateKey)

  const breakdown = categories
    .map((category) => {
      const tasks = getTasksForCategoryDate(state, category.id, dateKey)
      if (!tasks.length) {
        return null
      }

      const completedTaskCount = tasks.filter((task) =>
        isTaskValueComplete(day.values[task.id], task.type),
      ).length

      return {
        category,
        tasks,
        completedTaskCount,
        totalTaskCount: tasks.length,
        categoryComplete: completedTaskCount === tasks.length,
      }
    })
    .filter(Boolean)

  const completedCategories = breakdown.filter((entry) => entry.categoryComplete).length
  const totalCategories = breakdown.length
  const completionPercent = totalCategories === 0 ? 0 : (completedCategories / totalCategories) * 100

  return {
    breakdown,
    completedCategories,
    totalCategories,
    completionPercent,
    isPerfectDay: totalCategories > 0 && completedCategories === totalCategories,
    hasAnyCategoryDone: completedCategories > 0,
  }
}

export function getDailySummary(state, dateKey) {
  const metric = getDailyCategoryBreakdown(state, dateKey)
  return {
    date: dateKey,
    completedCategories: metric.completedCategories,
    totalCategories: metric.totalCategories,
    completionPercent: metric.completionPercent,
    isPerfectDay: metric.isPerfectDay,
    hasAnyCategoryDone: metric.hasAnyCategoryDone,
  }
}

export function getRunningStreaks(state, referenceDate = toDateKey()) {
  let perfect = 0
  let active = 0

  let cursor = referenceDate
  while (true) {
    const summary = getDailySummary(state, cursor)
    if (summary.isPerfectDay) {
      perfect += 1
      cursor = addDays(cursor, -1)
      continue
    }
    break
  }

  cursor = referenceDate
  while (true) {
    const summary = getDailySummary(state, cursor)
    if (summary.hasAnyCategoryDone) {
      active += 1
      cursor = addDays(cursor, -1)
      continue
    }
    break
  }

  return {
    perfect,
    active,
  }
}

export function getAllTimeStats(state, referenceDate = toDateKey()) {
  const dayKeys = Object.keys(state.days)
  const startDate = dayKeys.length ? dayKeys.sort()[0] : referenceDate

  const dates = getDateRange(startDate, referenceDate)
  let perfectDays = 0
  let runningPerfect = 0
  let runningActive = 0
  let longestPerfect = 0
  let longestActive = 0
  let sumCompletion = 0

  for (const dateKey of dates) {
    const summary = getDailySummary(state, dateKey)
    sumCompletion += summary.completionPercent

    if (summary.isPerfectDay) {
      perfectDays += 1
      runningPerfect += 1
    } else {
      runningPerfect = 0
    }

    if (summary.hasAnyCategoryDone) {
      runningActive += 1
    } else {
      runningActive = 0
    }

    longestPerfect = Math.max(longestPerfect, runningPerfect)
    longestActive = Math.max(longestActive, runningActive)
  }

  return {
    totalTrackedDays: dates.length,
    perfectDays,
    overallCompletionRate: dates.length ? sumCompletion / dates.length : 0,
    longestPerfect,
    longestActive,
  }
}

export function getWeeklyReport(state, dateKey = toDateKey()) {
  const start = getStartOfWeek(dateKey)
  const end = getEndOfWeek(dateKey)
  const dates = getDateRange(start, end)

  const days = dates.map((item) => getDailySummary(state, item))
  const average = days.length
    ? days.reduce((sum, day) => sum + day.completionPercent, 0) / days.length
    : 0
  const perfectDays = days.filter((day) => day.isPerfectDay).length

  return {
    start,
    end,
    days,
    average,
    perfectDays,
  }
}

export function getMonthlyReport(state, dateKey = toDateKey()) {
  const start = getMonthStart(dateKey)
  const end = getMonthEnd(dateKey)
  const dates = getDateRange(start, end)

  const days = dates.map((item) => getDailySummary(state, item))
  const average = days.length
    ? days.reduce((sum, day) => sum + day.completionPercent, 0) / days.length
    : 0
  const perfectDays = days.filter((day) => day.isPerfectDay).length

  const categoryScores = {}

  for (const date of dates) {
    const breakdown = getDailyCategoryBreakdown(state, date).breakdown
    for (const entry of breakdown) {
      if (!categoryScores[entry.category.id]) {
        categoryScores[entry.category.id] = {
          categoryId: entry.category.id,
          name: entry.category.name,
          completedDays: 0,
          totalDays: 0,
          timeline: [],
        }
      }

      const bucket = categoryScores[entry.category.id]
      bucket.totalDays += 1
      if (entry.categoryComplete) {
        bucket.completedDays += 1
      }
      bucket.timeline.push(entry.categoryComplete ? 1 : 0)
    }
  }

  const categoryCompletion = Object.values(categoryScores).map((bucket) => {
    const percentage = bucket.totalDays ? (bucket.completedDays / bucket.totalDays) * 100 : 0

    const midpoint = Math.floor(bucket.timeline.length / 2)
    const firstHalf = bucket.timeline.slice(0, midpoint)
    const secondHalf = bucket.timeline.slice(midpoint)
    const firstRate = firstHalf.length
      ? firstHalf.reduce((sum, item) => sum + item, 0) / firstHalf.length
      : 0
    const secondRate = secondHalf.length
      ? secondHalf.reduce((sum, item) => sum + item, 0) / secondHalf.length
      : 0

    let trend = 'steady'
    if (secondRate - firstRate > 0.15) {
      trend = 'improving'
    } else if (firstRate - secondRate > 0.15) {
      trend = 'slipping'
    }

    return {
      ...bucket,
      percentage,
      trend,
    }
  })

  const sorted = [...categoryCompletion].sort((a, b) => b.percentage - a.percentage)

  return {
    start,
    end,
    days,
    average,
    perfectDays,
    categoryCompletion,
    bestCategory: sorted[0] || null,
    worstCategory: sorted.at(-1) || null,
  }
}

export function getCalendarGrid(dateKey) {
  const monthStart = getMonthStart(dateKey)
  const monthEnd = getMonthEnd(dateKey)
  const gridStart = getStartOfWeek(monthStart)
  const gridEnd = getEndOfWeek(monthEnd)
  return getDateRange(gridStart, gridEnd)
}

export function addCategory(state, categoryName, dateKey = toDateKey()) {
  const category = {
    id: makeId('cat'),
    name: categoryName,
    order: state.categories.length,
    active: true,
    createdOn: dateKey,
    archivedOn: null,
  }

  return {
    ...state,
    categories: [...state.categories, category],
  }
}

export function updateCategory(state, categoryId, patch) {
  return {
    ...state,
    categories: state.categories.map((item) => (item.id === categoryId ? { ...item, ...patch } : item)),
  }
}

export function archiveCategory(state, categoryId, dateKey = toDateKey()) {
  return {
    ...state,
    categories: state.categories.map((item) =>
      item.id === categoryId ? { ...item, active: false, archivedOn: dateKey } : item,
    ),
    tasks: state.tasks.map((task) =>
      task.categoryId === categoryId
        ? {
            ...task,
            active: false,
            archivedOn: task.archivedOn || dateKey,
          }
        : task,
    ),
  }
}

export function addTask(state, categoryId, taskInput, dateKey = toDateKey()) {
  const tasksForCategory = state.tasks.filter((task) => task.categoryId === categoryId)
  const task = {
    id: makeId('task'),
    categoryId,
    label: taskInput.label,
    type: taskInput.type,
    recurrence: taskInput.recurrence,
    order: tasksForCategory.length,
    active: true,
    createdOn: dateKey,
    archivedOn: null,
    completedOn: null,
    placeholder: taskInput.placeholder || '',
  }

  return {
    ...state,
    tasks: [...state.tasks, task],
  }
}

export function updateTask(state, taskId, patch) {
  return {
    ...state,
    tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
  }
}

export function archiveTask(state, taskId, dateKey = toDateKey()) {
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId ? { ...task, active: false, archivedOn: dateKey } : task,
    ),
  }
}

export function reorderById(items, orderedIds) {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  return items
    .map((item) => ({ ...item }))
    .sort((a, b) => {
      const rankA = rank.has(a.id) ? rank.get(a.id) : Number.MAX_SAFE_INTEGER
      const rankB = rank.has(b.id) ? rank.get(b.id) : Number.MAX_SAFE_INTEGER
      return rankA - rankB
    })
    .map((item, index) => ({ ...item, order: index }))
}

export function migrateState(data) {
  if (!data || typeof data !== 'object') {
    return makeDefaultState()
  }

  if (!data.version) {
    return {
      ...makeDefaultState(),
      ...data,
      version: VERSION,
      theme: data.theme || 'dark',
      days: data.days || {},
      categories: (data.categories || []).map((category, index) => ({
        ...category,
        order: typeof category.order === 'number' ? category.order : index,
        createdOn: category.createdOn || toDateKey(),
        active: category.active ?? !category.archivedOn,
      })),
      tasks: (data.tasks || []).map((task, index) => ({
        ...task,
        order: typeof task.order === 'number' ? task.order : index,
        createdOn: task.createdOn || toDateKey(),
        active: task.active ?? !task.archivedOn,
        recurrence: task.recurrence || 'daily',
        type: task.type || 'checkbox',
      })),
    }
  }

  return {
    ...data,
    version: VERSION,
  }
}

export function getExportRows(state) {
  const dayKeys = Object.keys(state.days).sort()
  if (!dayKeys.length) {
    return []
  }

  return dayKeys.map((dateKey) => {
    const summary = getDailySummary(state, dateKey)
    const notes = state.days[dateKey]?.notes || {}
    return {
      date: dateKey,
      completed_categories: summary.completedCategories,
      total_categories: summary.totalCategories,
      completion_percent: summary.completionPercent.toFixed(2),
      perfect_day: summary.isPerfectDay ? 'yes' : 'no',
      biggest_win: notes.biggestWin || '',
      learned_today: notes.learned || '',
      improve_tomorrow: notes.improveTomorrow || '',
    }
  })
}

export function serializeCsv(rows) {
  if (!rows.length) {
    return ''
  }

  const headers = Object.keys(rows[0])
  const lines = [headers.join(',')]

  for (const row of rows) {
    const line = headers
      .map((header) => {
        const value = row[header] ?? ''
        const escaped = String(value).replaceAll('"', '""')
        return `"${escaped}"`
      })
      .join(',')
    lines.push(line)
  }

  return lines.join('\n')
}

export function getWeekdayLabels(startDateKey) {
  return getDateRange(startDateKey, addDays(startDateKey, 6)).map((dateKey) =>
    fromDateKey(dateKey).toLocaleDateString(undefined, { weekday: 'short' }),
  )
}
