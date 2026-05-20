'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://72.62.210.21:3100'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/reset-password`,
  })

  if (error) {
    redirect('/forgot-password?error=1')
  }

  redirect('/forgot-password?sent=1')
}
