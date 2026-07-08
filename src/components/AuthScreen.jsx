import { useState } from 'react'

function Field({ label, type, value, onChange, autoComplete, placeholder }) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="text-[var(--muted)]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
        className="rounded-lg border border-[var(--line)] bg-[var(--bg)] px-3 py-2 outline-none transition focus:border-[var(--accent)]"
      />
    </label>
  )
}

function AuthCard({ title, subtitle, children }) {
  return (
    <div className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-lg shadow-black/5">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

export default function AuthScreen({ mode, onModeChange, onLogin, onSignup, onForgotPassword, onResetPassword }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)

    try {
      if (mode === 'login') {
        const result = await onLogin(email, password)
        if (!result?.ok) {
          throw new Error(result?.message || 'Unable to log in.')
        }
        setMessage(result.message || 'Logged in.')
        return
      }

      if (mode === 'signup') {
        const result = await onSignup(email, password)
        if (!result?.ok) {
          throw new Error(result?.message || 'Unable to sign up.')
        }
        setMessage(result.message || 'Check your email to confirm your account.')
        return
      }

      if (mode === 'forgot') {
        const result = await onForgotPassword(email)
        if (!result?.ok) {
          throw new Error(result?.message || 'Unable to send reset email.')
        }
        setMessage(result.message || 'Password reset email sent.')
        return
      }

      if (mode === 'reset') {
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match.')
        }
        const result = await onResetPassword(password)
        if (!result?.ok) {
          throw new Error(result?.message || 'Unable to reset password.')
        }
        setMessage(result.message || 'Password updated.')
        return
      }
    } catch (submissionError) {
      setError(submissionError.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'
  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'
  const isReset = mode === 'reset'

  return (
    <div className="min-h-screen bg-[var(--bg)] px-4 py-10 text-[var(--text)]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <AuthCard
          title={isLogin ? 'Log in' : isSignup ? 'Create account' : isForgot ? 'Reset password' : 'Set new password'}
          subtitle={
            isLogin
              ? 'Use your trusted-group account to sync across devices.'
              : isSignup
                ? 'Create your account with email verification.'
                : isForgot
                  ? 'We will send a password reset email.'
                  : 'Enter a new password to finish recovery.'
          }
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="you@example.com"
            />

            {!isForgot ? (
              <Field
                label={isReset ? 'New password' : 'Password'}
                type="password"
                value={password}
                onChange={setPassword}
                autoComplete={isReset ? 'new-password' : 'current-password'}
                placeholder="••••••••"
              />
            ) : null}

            {isSignup || isReset ? (
              <Field
                label="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            ) : null}

            {error ? <p className="rounded-lg border border-[var(--danger)] bg-[color:color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 text-sm text-[var(--danger)]">{error}</p> : null}
            {message ? <p className="rounded-lg border border-[var(--line)] bg-[var(--bg)] p-3 text-sm text-[var(--muted)]">{message}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? 'Working...'
                : isLogin
                  ? 'Log in'
                  : isSignup
                    ? 'Sign up'
                    : isForgot
                      ? 'Send reset email'
                      : 'Update password'}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap gap-2 text-sm">
            {isLogin ? (
              <>
                <button type="button" className="text-[var(--accent)]" onClick={() => onModeChange('signup')}>Create account</button>
                <span className="text-[var(--muted)]">•</span>
                <button type="button" className="text-[var(--accent)]" onClick={() => onModeChange('forgot')}>Forgot password?</button>
              </>
            ) : isSignup ? (
              <button type="button" className="text-[var(--accent)]" onClick={() => onModeChange('login')}>Back to log in</button>
            ) : isForgot ? (
              <button type="button" className="text-[var(--accent)]" onClick={() => onModeChange('login')}>Back to log in</button>
            ) : (
              <p className="text-sm text-[var(--muted)]">After updating your password, you&apos;ll return to the app automatically.</p>
            )}
          </div>
        </AuthCard>
      </div>
    </div>
  )
}
