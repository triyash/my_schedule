import { supabase, isSupabaseConfigured } from './supabase'

export function authReady() {
  return Boolean(supabase)
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured()) {
    return { session: null, error: new Error('Supabase is not configured.') }
  }

  const { data, error } = await supabase.auth.getSession()
  return {
    session: data.session || null,
    error,
  }
}

export function subscribeToAuthChanges(callback) {
  if (!isSupabaseConfigured()) {
    return { data: { subscription: { unsubscribe() {} } } }
  }

  return supabase.auth.onAuthStateChange(callback)
}

export async function signInWithPassword(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  return { data, error }
}

export async function signUpWithPassword(email, password, redirectTo) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
    },
  })

  return { data, error }
}

export async function sendPasswordResetEmail(email, redirectTo) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })

  return { error }
}

export async function updatePassword(password) {
  const { data, error } = await supabase.auth.updateUser({
    password,
  })

  return { data, error }
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut()
  return { error }
}
