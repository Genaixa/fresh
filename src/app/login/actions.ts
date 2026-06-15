'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Wholesale customers sign in with a simple username (e.g. "oneg"); staff use
// their full email. A bare username is mapped to an internal portal address.
const PORTAL_EMAIL_DOMAIN = 'portal.freshnfruity.com'

function toEmail(identifier: string) {
  const id = (identifier ?? '').trim()
  return id.includes('@') ? id : `${id.toLowerCase()}@${PORTAL_EMAIL_DOMAIN}`
}

export async function login(formData: FormData) {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithPassword({
    email: toEmail(formData.get('email') as string),
    password: formData.get('password') as string,
  })

  if (error) {
    redirect('/login?error=invalid_credentials')
  }

  // Customers go straight to their ordering portal; staff to the app home.
  const { data: customer } = await supabase
    .from('wholesale_customers')
    .select('id')
    .eq('portal_user_id', data.user!.id)
    .maybeSingle()

  revalidatePath('/', 'layout')
  redirect(customer ? '/portal' : '/')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
