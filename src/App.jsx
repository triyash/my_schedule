import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import AuthScreen from './components/AuthScreen'
import ProgressRing from './components/ProgressRing'
import {
  addCategory,
  addTask,
  archiveCategory,
  archiveTask,
  getActiveCategoriesForDate,
  getAllTimeStats,
  getCalendarGrid,
  getDailyCategoryBreakdown,
  getDailySummary,
  getExportRows,
  getMonthlyReport,
  getRunningStreaks,
  getWeeklyReport,
  isTaskValueComplete,
  makeDefaultState,
  migrateState,
  reorderById,
  serializeCsv,
  updateCategory,
  updateDayNotes,
  updateTask,
  upsertTaskValue,
} from './lib/tracker'
import { fromDateKey, humanDate, toDateKey } from './lib/date'
import {
  getCurrentSession,
  sendPasswordResetEmail,
  signInWithPassword,
  signOutUser,
  signUpWithPassword,
  subscribeToAuthChanges,
  updatePassword,
} from './lib/auth'
import { loadState, saveImportedState, saveState } from './lib/storage'

const BarChart = lazy(() => import('./components/BarChart'))
const LineChart = lazy(() => import('./components/LineChart'))

const VIEWS = [
  { id: 'today', label: 'Today' },
  { id: 'history', label: 'History' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'stats', label: 'All-time' },
]

function swapInArray(items, from, to) {
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) {
    return items
  }

  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function completionTone(percent) {
  if (percent >= 100) {
    return 'var(--heat-5)'
  }
  if (percent >= 75) {
    return 'var(--heat-4)'
  }
  if (percent >= 50) {
    return 'var(--heat-3)'
  }
  if (percent >= 25) {
    return 'var(--heat-2)'
  }
  if (percent > 0) {
    return 'var(--heat-1)'
  }
  return 'var(--heat-0)'
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
      <p className="text-xs uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  )
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const importInputRef = useRef(null)
  const saveRunIdRef = useRef(0)
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const todayKey = toDateKey()
  const [state, setState] = useState(() => makeDefaultState())
  const [isHydrated, setIsHydrated] = useState(false)
  const [syncStatus, setSyncStatus] = useState('loading')
  const [view, setView] = useState('today')
  const [selectedHistoryDate, setSelectedHistoryDate] = useState(todayKey)
  const [historyMonthAnchor, setHistoryMonthAnchor] = useState(todayKey)
  const [monthlyAnchor, setMonthlyAnchor] = useState(todayKey)
  const [manageMode, setManageMode] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [taskDrafts, setTaskDrafts] = useState({})

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      const { session: currentSession } = await getCurrentSession()
      if (!isMounted) {
        return
      }

      setSession(currentSession)
      setAuthReady(true)
      if (!currentSession) {
        setAuthMode('login')
        setIsHydrated(false)
      }
    }

    initializeAuth()

    const { data } = subscribeToAuthChanges((event, nextSession) => {
      if (!isMounted) {
        return
      }

      if (event === 'PASSWORD_RECOVERY') {
        setSession(nextSession)
        setAuthReady(true)
        setAuthMode('reset')
        return
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setState(makeDefaultState())
        setIsHydrated(false)
        setSyncStatus('saved')
        setAuthMode('login')
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(nextSession)
        setAuthReady(true)
        if (authMode !== 'reset') {
          setAuthMode('login')
        }
      }
    })

    return () => {
      isMounted = false
      data?.subscription?.unsubscribe?.()
    }
  }, [authMode])

  useEffect(() => {
    let cancelled = false

    async function hydrateState() {
      if (!session?.user?.id) {
        return
      }

      const loaded = await loadState(session.user.id)
      if (cancelled) {
        return
      }

      setState(loaded.state)
      setIsHydrated(true)
      setSyncStatus(loaded.offline ? 'offline' : 'saved')
    }

    hydrateState()

    return () => {
      cancelled = true
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (!isHydrated) {
      return undefined
    }

    if (!session?.user?.id) {
      return undefined
    }

    const saveRunId = ++saveRunIdRef.current

    async function persistState() {
      const result = await saveState(state, {
        mode: 'current',
        dateKey: todayKey,
        userId: session.user.id,
      })
      if (saveRunId !== saveRunIdRef.current) {
        return
      }

      setSyncStatus(result.ok ? 'saved' : 'offline')
    }

    persistState()

    return () => {}
  }, [state, isHydrated, session?.user?.id, todayKey])

  useEffect(() => {
    document.documentElement.dataset.theme = state.theme || 'dark'
  }, [state.theme])

  const todayBreakdown = useMemo(
    () => getDailyCategoryBreakdown(state, todayKey),
    [state, todayKey],
  )
  const todaySummary = useMemo(() => getDailySummary(state, todayKey), [state, todayKey])
  const streaks = useMemo(() => getRunningStreaks(state, todayKey), [state, todayKey])
  const allTimeStats = useMemo(() => getAllTimeStats(state, todayKey), [state, todayKey])
  const weeklyReport = useMemo(() => getWeeklyReport(state, todayKey), [state, todayKey])
  const monthlyReport = useMemo(() => getMonthlyReport(state, monthlyAnchor), [state, monthlyAnchor])

  const selectedHistoryBreakdown = useMemo(
    () => getDailyCategoryBreakdown(state, selectedHistoryDate),
    [state, selectedHistoryDate],
  )
  const selectedHistorySummary = useMemo(
    () => getDailySummary(state, selectedHistoryDate),
    [state, selectedHistoryDate],
  )

  const selectedDayNotes = state.days[todayKey]?.notes || {
    biggestWin: '',
    learned: '',
    improveTomorrow: '',
  }

  const calendarDates = useMemo(() => getCalendarGrid(historyMonthAnchor), [historyMonthAnchor])

  const eveningReminder = useMemo(() => {
    const hour = new Date().getHours()
    return hour >= 19 && !todaySummary.isPerfectDay
  }, [todaySummary.isPerfectDay])

  const historyExtraLogs = useMemo(() => {
    const values = state.days[selectedHistoryDate]?.values || {}
    const knownTaskIds = new Set(
      selectedHistoryBreakdown.breakdown.flatMap((entry) => entry.tasks.map((task) => task.id)),
    )

    return Object.entries(values)
      .filter(([taskId]) => !knownTaskIds.has(taskId))
      .map(([taskId, value]) => ({
        taskId,
        label: value.taskLabelSnapshot || 'Unknown task',
        category: value.categoryLabelSnapshot || 'Archived category',
        type: value.taskTypeSnapshot || 'checkbox',
        checked: value.checked,
        numberValue: value.numberValue,
        textValue: value.textValue,
      }))
  }, [state.days, selectedHistoryDate, selectedHistoryBreakdown.breakdown])

  function patchState(updater) {
    setState((current) => updater(current))
  }

  function getTaskValue(dateKey, taskId) {
    return state.days[dateKey]?.values?.[taskId] || {}
  }

  function handleTaskValueChange({ dateKey, category, task, field, value }) {
    patchState((current) =>
      upsertTaskValue({
        state: current,
        dateKey,
        category,
        task,
        nextValue: { [field]: value },
      }),
    )
  }

  function handleNoteChange(field, value) {
    patchState((current) => updateDayNotes(current, todayKey, { [field]: value }))
  }

  function reorderActiveCategories(categoryId, direction) {
    patchState((current) => {
      const active = current.categories
        .filter((category) => !category.archivedOn)
        .sort((a, b) => a.order - b.order)

      const index = active.findIndex((category) => category.id === categoryId)
      const next = swapInArray(active, index, index + direction)
      const reorderedActive = reorderById(active, next.map((item) => item.id))
      const orderMap = new Map(reorderedActive.map((item) => [item.id, item.order]))

      return {
        ...current,
        categories: current.categories.map((category) =>
          orderMap.has(category.id)
            ? { ...category, order: orderMap.get(category.id) }
            : category,
        ),
      }
    })
  }

  function reorderActiveTasks(categoryId, taskId, direction) {
    patchState((current) => {
      const activeTasks = current.tasks
        .filter((task) => task.categoryId === categoryId && !task.archivedOn)
        .sort((a, b) => a.order - b.order)

      const index = activeTasks.findIndex((task) => task.id === taskId)
      const next = swapInArray(activeTasks, index, index + direction)
      const reordered = reorderById(activeTasks, next.map((item) => item.id))
      const orderMap = new Map(reordered.map((item) => [item.id, item.order]))

      return {
        ...current,
        tasks: current.tasks.map((task) =>
          orderMap.has(task.id) ? { ...task, order: orderMap.get(task.id) } : task,
        ),
      }
    })
  }

  function submitTaskDraft(categoryId) {
    const draft = taskDrafts[categoryId]
    if (!draft?.label?.trim()) {
      return
    }

    patchState((current) =>
      addTask(
        current,
        categoryId,
        {
          label: draft.label.trim(),
          type: draft.type || 'checkbox',
          recurrence: draft.recurrence || 'daily',
          placeholder: draft.placeholder || '',
        },
        todayKey,
      ),
    )

    setTaskDrafts((current) => ({
      ...current,
      [categoryId]: {
        label: '',
        type: 'checkbox',
        recurrence: 'daily',
        placeholder: '',
      },
    }))
  }

  function handleExportJson() {
    downloadFile(
      `habit-tracker-backup-${todayKey}.json`,
      JSON.stringify(state, null, 2),
      'application/json',
    )
  }

  function handleExportCsv() {
    const csv = serializeCsv(getExportRows(state))
    downloadFile(`habit-tracker-summary-${todayKey}.csv`, csv, 'text/csv;charset=utf-8')
  }

  function mergeImportedState(currentState, incomingState) {
    const mergedCategoryMap = new Map()
    for (const item of currentState.categories) {
      mergedCategoryMap.set(item.id, item)
    }
    for (const item of incomingState.categories) {
      mergedCategoryMap.set(item.id, item)
    }

    const mergedTaskMap = new Map()
    for (const item of currentState.tasks) {
      mergedTaskMap.set(item.id, item)
    }
    for (const item of incomingState.tasks) {
      mergedTaskMap.set(item.id, item)
    }

    const mergedDays = { ...currentState.days }
    for (const [dateKey, incomingDay] of Object.entries(incomingState.days || {})) {
      const existing = mergedDays[dateKey]
      if (!existing) {
        mergedDays[dateKey] = incomingDay
        continue
      }

      mergedDays[dateKey] = {
        ...existing,
        ...incomingDay,
        values: {
          ...(existing.values || {}),
          ...(incomingDay.values || {}),
        },
        notes: {
          ...(existing.notes || {}),
          ...(incomingDay.notes || {}),
        },
      }
    }

    return {
      ...currentState,
      version: incomingState.version || currentState.version,
      theme: incomingState.theme || currentState.theme,
      categories: [...mergedCategoryMap.values()].sort((a, b) => a.order - b.order),
      tasks: [...mergedTaskMap.values()].sort((a, b) => a.order - b.order),
      days: mergedDays,
    }
  }

  async function handleImportFileChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) {
      return
    }

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)
      const incomingState = migrateState(parsed)

      const shouldReplace = window.confirm(
        'Click OK to replace current data. Click Cancel to merge imported data into current data.',
      )

      const nextState = shouldReplace
        ? incomingState
        : mergeImportedState(state, incomingState)

      setState(nextState)
      setSyncStatus('loading')
      const result = await saveImportedState(nextState, session.user.id)
      setSyncStatus(result.ok ? 'saved' : 'offline')
    } catch (error) {
      console.error(error)
      setSyncStatus('offline')
      window.alert('Unable to import file. Please select a valid tracker JSON export.')
    }
  }

  function shiftDate(dateKey, months) {
    const date = fromDateKey(dateKey)
    date.setMonth(date.getMonth() + months)
    return toDateKey(date)
  }

  const monthStart = fromDateKey(historyMonthAnchor)
  monthStart.setDate(1)
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const monthlyStart = fromDateKey(monthlyAnchor)
  monthlyStart.setDate(1)
  const monthlyLabel = monthlyStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  const weeklyBarData = weeklyReport.days.map((day) => ({
    key: day.date,
    label: fromDateKey(day.date).toLocaleDateString(undefined, { weekday: 'short' }),
    value: day.completionPercent,
  }))

  const monthlyLineData = monthlyReport.days.map((day) => ({
    key: day.date,
    label: fromDateKey(day.date).getDate(),
    value: day.completionPercent,
  }))

  const monthlyCategoryBars = monthlyReport.categoryCompletion.map((item) => ({
    key: item.categoryId,
    label: item.name.split(' ')[0],
    value: item.percentage,
  }))

  const orderedTodayCategories = getActiveCategoriesForDate(state, todayKey)

  async function handleLogin(email, password) {
    const { error } = await signInWithPassword(email, password)
    if (error) {
      return { ok: false, message: error.message }
    }
    return { ok: true, message: 'Logged in.' }
  }

  async function handleSignup(email, password) {
    const { error, data } = await signUpWithPassword(email, password, window.location.origin)
    if (error) {
      return { ok: false, message: error.message }
    }
    if (data.session) {
      return { ok: true, message: 'Account created. Loading your workspace.' }
    }
    return { ok: true, message: 'Check your email to verify your account.' }
  }

  async function handleForgotPassword(email) {
    const { error } = await sendPasswordResetEmail(email, window.location.origin)
    if (error) {
      return { ok: false, message: error.message }
    }
    return { ok: true, message: 'Password reset email sent.' }
  }

  async function handleResetPassword(newPassword) {
    const { error } = await updatePassword(newPassword)
    if (error) {
      return { ok: false, message: error.message }
    }
    setAuthMode('login')
    return { ok: true, message: 'Password updated. You can now log in.' }
  }

  async function handleLogout() {
    const { error } = await signOutUser()
    if (error) {
      window.alert(error.message)
    }
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
        <div className="mx-auto max-w-xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
          Checking account...
        </div>
      </div>
    )
  }

  if (!session?.user?.id && authMode !== 'reset') {
    return (
      <AuthScreen
        mode={authMode}
        onModeChange={setAuthMode}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
      />
    )
  }

  if (authMode === 'reset') {
    return (
      <AuthScreen
        mode="reset"
        onModeChange={setAuthMode}
        onLogin={handleLogin}
        onSignup={handleSignup}
        onForgotPassword={handleForgotPassword}
        onResetPassword={handleResetPassword}
      />
    )
  }

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
        <div className="mx-auto max-w-xl rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 text-sm text-[var(--muted)]">
          Loading from Supabase...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color:color-mix(in_srgb,var(--bg)_86%,transparent)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <ProgressRing percent={todaySummary.completionPercent} />
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Today</p>
              <p className="text-lg font-semibold">
                {todaySummary.completedCategories}/{todaySummary.totalCategories} categories
              </p>
              <p className="text-xs text-[var(--muted)]">
                Perfect streak: {streaks.perfect} day(s) • Active streak: {streaks.active} day(s)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-full border border-[var(--line)] px-3 py-2 text-xs text-[var(--muted)]">
              {syncStatus === 'offline' ? 'Offline, changes not saved' : 'Synced'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--panel)]"
            >
              Log out
            </button>
            <button
              type="button"
              onClick={() =>
                patchState((current) => ({
                  ...current,
                  theme: current.theme === 'dark' ? 'light' : 'dark',
                }))
              }
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--panel)]"
            >
              {state.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--panel)]"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--panel)]"
            >
              Export CSV
            </button>
            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--panel)]"
            >
              Import JSON
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleImportFileChange}
              className="hidden"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-5 sm:px-6">
        {eveningReminder ? (
          <div className="mb-4 rounded-xl border border-[var(--amber)] bg-[color:color-mix(in_srgb,var(--amber)_15%,transparent)] p-3 text-sm text-[var(--text)]">
            Evening check-in: you are not at a complete day yet. Try finishing at least one more category before bed.
          </div>
        ) : null}

        <nav className="mb-5 flex flex-wrap gap-2">
          {VIEWS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setView(item.id)}
              className={`rounded-lg px-3 py-2 text-sm ${
                view === item.id
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--line)] hover:bg-[var(--panel)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {view === 'today' ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div>
                <p className="text-sm text-[var(--muted)]">{humanDate(todayKey, { weekday: 'long', year: 'numeric' })}</p>
                <p className="text-lg font-semibold">
                  Daily score: {todaySummary.completedCategories}/{todaySummary.totalCategories}
                  {todaySummary.isPerfectDay ? ' • Perfect Day' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManageMode((value) => !value)}
                className="rounded-lg border border-[var(--line)] px-3 py-2 text-sm hover:bg-[var(--bg)]"
              >
                {manageMode ? 'Done editing' : 'Edit categories/tasks'}
              </button>
            </div>

            {todayBreakdown.breakdown.map((entry, categoryIndex) => (
              <article key={entry.category.id} className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  {manageMode ? (
                    <input
                      value={entry.category.name}
                      onChange={(event) =>
                        patchState((current) =>
                          updateCategory(current, entry.category.id, { name: event.target.value }),
                        )
                      }
                      className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm sm:w-auto sm:min-w-96"
                    />
                  ) : (
                    <h2 className="text-base font-semibold">{entry.category.name}</h2>
                  )}

                  <div className="flex items-center gap-2 text-xs">
                    <span className="rounded-full bg-[var(--chip)] px-3 py-1">
                      {entry.completedTaskCount}/{entry.totalTaskCount}
                    </span>
                    {manageMode ? (
                      <>
                        <button
                          type="button"
                          onClick={() => reorderActiveCategories(entry.category.id, -1)}
                          disabled={categoryIndex === 0}
                          className="rounded border border-[var(--line)] px-2 py-1 disabled:opacity-35"
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          onClick={() => reorderActiveCategories(entry.category.id, 1)}
                          disabled={categoryIndex === orderedTodayCategories.length - 1}
                          className="rounded border border-[var(--line)] px-2 py-1 disabled:opacity-35"
                        >
                          Down
                        </button>
                        <button
                          type="button"
                          onClick={() => patchState((current) => archiveCategory(current, entry.category.id, todayKey))}
                          className="rounded border border-[var(--danger)] px-2 py-1 text-[var(--danger)]"
                        >
                          Delete
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  {entry.tasks.map((task, taskIndex) => {
                    const value = getTaskValue(todayKey, task.id)
                    const complete = isTaskValueComplete(value, task.type)

                    return (
                      <div key={task.id} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          {manageMode ? (
                            <input
                              value={task.label}
                              onChange={(event) =>
                                patchState((current) =>
                                  updateTask(current, task.id, { label: event.target.value }),
                                )
                              }
                              className="flex-1 rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-sm"
                            />
                          ) : (
                            <p className="flex-1 text-sm font-medium">{task.label}</p>
                          )}

                          <span
                            className={`rounded px-2 py-1 text-xs ${
                              complete
                                ? 'bg-[var(--ok-bg)] text-[var(--ok)]'
                                : 'bg-[var(--chip)] text-[var(--muted)]'
                            }`}
                          >
                            {complete ? 'Done' : 'Pending'}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {task.type === 'checkbox' ? (
                            <label className="flex cursor-pointer items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={value.checked || false}
                                onChange={(event) =>
                                  handleTaskValueChange({
                                    dateKey: todayKey,
                                    category: entry.category,
                                    task,
                                    field: 'checked',
                                    value: event.target.checked,
                                  })
                                }
                                className="h-4 w-4"
                              />
                              Mark complete
                            </label>
                          ) : null}

                          {task.type === 'number' ? (
                            <input
                              type="number"
                              value={value.numberValue || ''}
                              onChange={(event) =>
                                handleTaskValueChange({
                                  dateKey: todayKey,
                                  category: entry.category,
                                  task,
                                  field: 'numberValue',
                                  value: event.target.value,
                                })
                              }
                              placeholder={task.placeholder || 'Enter number'}
                              className="w-full rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm sm:w-60"
                            />
                          ) : null}

                          {task.type === 'text' ? (
                            <input
                              type="text"
                              value={value.textValue || ''}
                              onChange={(event) =>
                                handleTaskValueChange({
                                  dateKey: todayKey,
                                  category: entry.category,
                                  task,
                                  field: 'textValue',
                                  value: event.target.value,
                                })
                              }
                              placeholder={task.placeholder || 'Write here'}
                              className="w-full rounded border border-[var(--line)] bg-[var(--panel)] px-3 py-2 text-sm"
                            />
                          ) : null}

                          {manageMode ? (
                            <>
                              <select
                                value={task.type}
                                onChange={(event) =>
                                  patchState((current) =>
                                    updateTask(current, task.id, { type: event.target.value }),
                                  )
                                }
                                className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs"
                              >
                                <option value="checkbox">Checkbox</option>
                                <option value="number">Number</option>
                                <option value="text">Text</option>
                              </select>

                              <select
                                value={task.recurrence}
                                onChange={(event) =>
                                  patchState((current) =>
                                    updateTask(current, task.id, { recurrence: event.target.value }),
                                  )
                                }
                                className="rounded border border-[var(--line)] bg-[var(--panel)] px-2 py-1 text-xs"
                              >
                                <option value="daily">Recurring daily</option>
                                <option value="one-time">One-time</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => reorderActiveTasks(entry.category.id, task.id, -1)}
                                disabled={taskIndex === 0}
                                className="rounded border border-[var(--line)] px-2 py-1 text-xs disabled:opacity-35"
                              >
                                Up
                              </button>
                              <button
                                type="button"
                                onClick={() => reorderActiveTasks(entry.category.id, task.id, 1)}
                                disabled={taskIndex === entry.tasks.length - 1}
                                className="rounded border border-[var(--line)] px-2 py-1 text-xs disabled:opacity-35"
                              >
                                Down
                              </button>
                              <button
                                type="button"
                                onClick={() => patchState((current) => archiveTask(current, task.id, todayKey))}
                                className="rounded border border-[var(--danger)] px-2 py-1 text-xs text-[var(--danger)]"
                              >
                                Delete
                              </button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {manageMode ? (
                  <div className="mt-3 rounded-lg border border-dashed border-[var(--line)] p-3">
                    <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Add task</p>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <input
                        value={taskDrafts[entry.category.id]?.label || ''}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [entry.category.id]: {
                              ...(current[entry.category.id] || {
                                type: 'checkbox',
                                recurrence: 'daily',
                                placeholder: '',
                              }),
                              label: event.target.value,
                            },
                          }))
                        }
                        placeholder="Task name"
                        className="rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-sm"
                      />

                      <select
                        value={taskDrafts[entry.category.id]?.type || 'checkbox'}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [entry.category.id]: {
                              ...(current[entry.category.id] || {
                                label: '',
                                recurrence: 'daily',
                                placeholder: '',
                              }),
                              type: event.target.value,
                            },
                          }))
                        }
                        className="rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-sm"
                      >
                        <option value="checkbox">Checkbox</option>
                        <option value="number">Number</option>
                        <option value="text">Text</option>
                      </select>

                      <select
                        value={taskDrafts[entry.category.id]?.recurrence || 'daily'}
                        onChange={(event) =>
                          setTaskDrafts((current) => ({
                            ...current,
                            [entry.category.id]: {
                              ...(current[entry.category.id] || {
                                label: '',
                                type: 'checkbox',
                                placeholder: '',
                              }),
                              recurrence: event.target.value,
                            },
                          }))
                        }
                        className="rounded border border-[var(--line)] bg-[var(--bg)] px-2 py-2 text-sm"
                      >
                        <option value="daily">Recurring daily</option>
                        <option value="one-time">One-time</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => submitTaskDraft(entry.category.id)}
                        className="rounded bg-[var(--accent)] px-3 py-2 text-sm text-white"
                      >
                        Add task
                      </button>
                    </div>
                  </div>
                ) : null}
              </article>
            ))}

            <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                Daily reflection
              </h3>

              <div className="grid gap-3">
                <label className="grid gap-1 text-sm">
                  <span>Today&apos;s Biggest Win</span>
                  <textarea
                    rows={2}
                    value={selectedDayNotes.biggestWin}
                    onChange={(event) => handleNoteChange('biggestWin', event.target.value)}
                    className="rounded border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span>What I Learned Today</span>
                  <textarea
                    rows={2}
                    value={selectedDayNotes.learned}
                    onChange={(event) => handleNoteChange('learned', event.target.value)}
                    className="rounded border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span>What I&apos;ll Improve Tomorrow</span>
                  <textarea
                    rows={2}
                    value={selectedDayNotes.improveTomorrow}
                    onChange={(event) => handleNoteChange('improveTomorrow', event.target.value)}
                    className="rounded border border-[var(--line)] bg-[var(--bg)] px-3 py-2"
                  />
                </label>
              </div>
            </article>

            {manageMode ? (
              <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Add new category
                </h3>
                <div className="flex flex-wrap gap-2">
                  <input
                    value={newCategoryName}
                    onChange={(event) => setNewCategoryName(event.target.value)}
                    placeholder="e.g. Finance, Meditation"
                    className="flex-1 rounded border border-[var(--line)] bg-[var(--bg)] px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newCategoryName.trim()) {
                        return
                      }
                      patchState((current) => addCategory(current, newCategoryName.trim(), todayKey))
                      setNewCategoryName('')
                    }}
                    className="rounded bg-[var(--accent)] px-3 py-2 text-sm text-white"
                  >
                    Add category
                  </button>
                </div>
              </article>
            ) : null}
          </section>
        ) : null}

        {view === 'history' ? (
          <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <div className="mb-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setHistoryMonthAnchor(shiftDate(historyMonthAnchor, -1))}
                  className="rounded border border-[var(--line)] px-2 py-1 text-sm"
                >
                  Prev
                </button>
                <p className="text-sm font-semibold">{monthLabel}</p>
                <button
                  type="button"
                  onClick={() => setHistoryMonthAnchor(shiftDate(historyMonthAnchor, 1))}
                  className="rounded border border-[var(--line)] px-2 py-1 text-sm"
                >
                  Next
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-2 text-center text-xs text-[var(--muted)]">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <div key={label}>{label}</div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-2">
                {calendarDates.map((dateKey) => {
                  const summary = getDailySummary(state, dateKey)
                  const inTargetMonth = dateKey.slice(0, 7) === historyMonthAnchor.slice(0, 7)
                  const active = selectedHistoryDate === dateKey

                  return (
                    <button
                      key={dateKey}
                      type="button"
                      onClick={() => setSelectedHistoryDate(dateKey)}
                      className={`rounded-lg border p-2 text-left text-xs transition ${
                        active ? 'border-[var(--accent)]' : 'border-[var(--line)]'
                      }`}
                      style={{
                        background: completionTone(summary.completionPercent),
                        opacity: inTargetMonth ? 1 : 0.45,
                      }}
                    >
                      <div className="font-semibold text-[var(--text)]">{fromDateKey(dateKey).getDate()}</div>
                      <div className="text-[10px] text-[var(--muted)]">{Math.round(summary.completionPercent)}%</div>
                    </button>
                  )
                })}
              </div>
            </article>

            <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Day detail</p>
              <h3 className="text-lg font-semibold">{humanDate(selectedHistoryDate, { weekday: 'long', year: 'numeric' })}</h3>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {selectedHistorySummary.completedCategories}/{selectedHistorySummary.totalCategories} categories •{' '}
                {Math.round(selectedHistorySummary.completionPercent)}%
              </p>

              <div className="mt-3 space-y-2">
                {selectedHistoryBreakdown.breakdown.map((entry) => (
                  <div key={entry.category.id} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2">
                    <p className="text-sm font-medium">{entry.category.name}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {entry.completedTaskCount}/{entry.totalTaskCount} tasks
                    </p>
                  </div>
                ))}
              </div>

              {historyExtraLogs.length ? (
                <div className="mt-4">
                  <p className="mb-1 text-xs uppercase tracking-wide text-[var(--muted)]">
                    Completed one-time / archived task logs
                  </p>
                  <div className="space-y-2">
                    {historyExtraLogs.map((item) => (
                      <div key={item.taskId} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2">
                        <p className="text-sm">{item.label}</p>
                        <p className="text-xs text-[var(--muted)]">{item.category}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 grid gap-2 text-sm">
                <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Today&apos;s Biggest Win</p>
                  <p>{state.days[selectedHistoryDate]?.notes?.biggestWin || '-'}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">What I Learned Today</p>
                  <p>{state.days[selectedHistoryDate]?.notes?.learned || '-'}</p>
                </div>
                <div className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted)]">What I&apos;ll Improve Tomorrow</p>
                  <p>{state.days[selectedHistoryDate]?.notes?.improveTomorrow || '-'}</p>
                </div>
              </div>
            </article>
          </section>
        ) : null}

        {view === 'weekly' ? (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Week average" value={`${Math.round(weeklyReport.average)}%`} />
              <StatCard label="Perfect days" value={weeklyReport.perfectDays} hint="in current week" />
              <StatCard
                label="Date range"
                value={`${fromDateKey(weeklyReport.start).toLocaleDateString()} - ${fromDateKey(weeklyReport.end).toLocaleDateString()}`}
              />
            </div>
            <Suspense fallback={<div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">Loading chart...</div>}>
              <BarChart data={weeklyBarData} />
            </Suspense>
          </section>
        ) : null}

        {view === 'monthly' ? (
          <section className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-[var(--line)] bg-[var(--panel)] p-3">
              <button
                type="button"
                onClick={() => setMonthlyAnchor(shiftDate(monthlyAnchor, -1))}
                className="rounded border border-[var(--line)] px-2 py-1 text-sm"
              >
                Prev month
              </button>
              <p className="text-sm font-semibold">{monthlyLabel}</p>
              <button
                type="button"
                onClick={() => setMonthlyAnchor(shiftDate(monthlyAnchor, 1))}
                className="rounded border border-[var(--line)] px-2 py-1 text-sm"
              >
                Next month
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Month average" value={`${Math.round(monthlyReport.average)}%`} />
              <StatCard label="Perfect days" value={monthlyReport.perfectDays} />
              <StatCard
                label="Best / Worst"
                value={`${monthlyReport.bestCategory?.name || '-'} / ${monthlyReport.worstCategory?.name || '-'}`}
              />
            </div>

            <Suspense fallback={<div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">Loading chart...</div>}>
              <LineChart data={monthlyLineData} />
            </Suspense>

            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr]">
              <Suspense fallback={<div className="rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">Loading chart...</div>}>
                <BarChart data={monthlyCategoryBars} colorByValue />
              </Suspense>

              <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">Category trend</p>
                <div className="space-y-2">
                  {monthlyReport.categoryCompletion.map((item) => (
                    <div key={item.categoryId} className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-2">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-[var(--muted)]">
                        {Math.round(item.percentage)}% complete • {item.trend}
                      </p>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          </section>
        ) : null}

        {view === 'stats' ? (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Longest perfect streak" value={`${allTimeStats.longestPerfect} days`} />
              <StatCard label="Longest active streak" value={`${allTimeStats.longestActive} days`} />
              <StatCard label="Total perfect days" value={allTimeStats.perfectDays} />
              <StatCard
                label="Overall completion"
                value={`${Math.round(allTimeStats.overallCompletionRate)}%`}
                hint={`${allTimeStats.totalTrackedDays} tracked days`}
              />
            </div>

            <article className="rounded-xl border border-[var(--line)] bg-[var(--panel)] p-4 text-sm text-[var(--muted)]">
              <p>
                Completion rate is computed as the average of daily category completion percentages from your first tracked day until today.
              </p>
            </article>
          </section>
        ) : null}
      </main>
    </div>
  )
}

export default App
