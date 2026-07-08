import { supabase, isSupabaseConfigured } from './supabase'
import { makeDefaultState, migrateState, upsertTaskValue, updateDayNotes } from './tracker'
import { toDateKey } from './date'

const SETTINGS_TABLE = 'tracker_settings'
const DAYS_TABLE = 'tracker_days'

function normalizeDayRow(row) {
  return {
    date: row.day,
    values: row.task_values || {},
    notes: {
      biggestWin: row.biggest_win || '',
      learned: row.learned_today || '',
      improveTomorrow: row.improve_tomorrow || '',
    },
  }
}

function serializeSettingsRow(state, userId) {
  return {
    user_id: userId,
    theme: state.theme || 'dark',
    categories: state.categories || [],
    tasks: state.tasks || [],
  }
}

function serializeDayRow(dateKey, state, userId) {
  const day = state.days?.[dateKey] || {
    values: {},
    notes: {
      biggestWin: '',
      learned: '',
      improveTomorrow: '',
    },
  }

  const categoryCompletion = Object.values(day.values || {}).reduce((accumulator, value) => {
    const categoryId = value.categoryIdSnapshot
    if (!categoryId) {
      return accumulator
    }

    if (!accumulator[categoryId]) {
      accumulator[categoryId] = {
        categoryId,
        categoryLabelSnapshot: value.categoryLabelSnapshot || '',
        completed: 0,
        total: 0,
      }
    }

    accumulator[categoryId].total += 1
    const taskComplete =
      value.checked === true ||
      (typeof value.numberValue !== 'undefined' && value.numberValue !== '' && value.numberValue !== null) ||
      (typeof value.textValue === 'string' && value.textValue.trim().length > 0)

    if (taskComplete) {
      accumulator[categoryId].completed += 1
    }

    return accumulator
  }, {})

  return {
    user_id: userId,
    day: dateKey,
    category_completion: categoryCompletion,
    task_values: day.values || {},
    biggest_win: day.notes?.biggestWin || '',
    learned_today: day.notes?.learned || '',
    improve_tomorrow: day.notes?.improveTomorrow || '',
  }
}

export async function loadState(userId) {
  if (!isSupabaseConfigured()) {
    return {
      state: makeDefaultState(),
      offline: true,
      error: new Error('Supabase environment variables are missing.'),
      needsSeed: false,
    }
  }

  if (!userId) {
    return {
      state: makeDefaultState(),
      offline: true,
      error: new Error('Missing authenticated user.'),
      needsSeed: false,
    }
  }

  try {
    const [settingsResponse, daysResponse] = await Promise.all([
      supabase.from(SETTINGS_TABLE).select('*').eq('user_id', userId).maybeSingle(),
      supabase.from(DAYS_TABLE).select('*').eq('user_id', userId).order('day', { ascending: true }),
    ])

    if (settingsResponse.error) {
      throw settingsResponse.error
    }
    if (daysResponse.error) {
      throw daysResponse.error
    }

    const settings = settingsResponse.data
    const defaultState = makeDefaultState()
    const baseState = settings
      ? {
          ...defaultState,
          theme: settings.theme || defaultState.theme,
          categories: Array.isArray(settings.categories) ? settings.categories : defaultState.categories,
          tasks: Array.isArray(settings.tasks) ? settings.tasks : defaultState.tasks,
        }
      : defaultState

    const days = {}
    for (const row of daysResponse.data || []) {
      days[row.day] = normalizeDayRow(row)
    }

    return {
      state: migrateState({
        ...baseState,
        days,
      }),
      offline: false,
      error: null,
      needsSeed: !settings,
    }
  } catch (error) {
    console.error('Failed to load tracker data from Supabase.', error)
    return {
      state: makeDefaultState(),
      offline: true,
      error,
      needsSeed: false,
    }
  }
}

export async function saveState(state, options = {}) {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      offline: true,
      error: new Error('Supabase environment variables are missing.'),
    }
  }

  const userId = options.userId
  if (!userId) {
    return {
      ok: false,
      offline: true,
      error: new Error('Missing authenticated user.'),
    }
  }

  const mode = options.mode || 'current'
  const targetDayKeys =
    mode === 'all'
      ? Object.keys(state.days || {})
      : [options.dateKey || toDateKey()]

  try {
    const settingsResponse = await supabase.from(SETTINGS_TABLE).upsert(serializeSettingsRow(state, userId), {
      onConflict: 'user_id',
    })

    if (settingsResponse.error) {
      throw settingsResponse.error
    }

    if (targetDayKeys.length) {
      const rows = targetDayKeys.map((dateKey) => serializeDayRow(dateKey, state, userId))
      const daysResponse = await supabase.from(DAYS_TABLE).upsert(rows, {
        onConflict: 'user_id,day',
      })

      if (daysResponse.error) {
        throw daysResponse.error
      }
    }

    return {
      ok: true,
      offline: false,
      error: null,
    }
  } catch (error) {
    console.error('Failed to save tracker data to Supabase.', error)
    return {
      ok: false,
      offline: true,
      error,
    }
  }
}

export async function saveImportedState(state, userId) {
  return saveState(state, { mode: 'all', userId })
}

export async function saveCurrentDayValue({ state, dateKey, task, category, nextValue, userId }) {
  const nextState = upsertTaskValue({ state, dateKey, task, category, nextValue })
  return {
    state: nextState,
    result: await saveState(nextState, { mode: 'current', dateKey, userId }),
  }
}

export async function saveCurrentDayNotes(state, dateKey, notesPatch, userId) {
  const nextState = updateDayNotes(state, dateKey, notesPatch)
  return {
    state: nextState,
    result: await saveState(nextState, { mode: 'current', dateKey, userId }),
  }
}
