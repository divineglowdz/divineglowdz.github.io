import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export default { async fetch(request: Request) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const authHeader = request.headers.get('Authorization') || ''
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) throw new Error('Non autorise')
    const { data: profile } = await admin.from('profiles').select('role,active').eq('id', user.id).single()
    if (!profile?.active || profile.role !== 'admin') throw new Error('Acces administrateur requis')

    const body = await request.json()
    if (body.action === 'create') {
      const { email, password, full_name, role } = body.user
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })
      if (error) throw error
      await admin.from('profiles').update({ full_name, role: role === 'admin' ? 'admin' : 'staff', active: true }).eq('id', data.user.id)
      return Response.json({ user_id: data.user.id }, { headers: corsHeaders })
    }
    if (body.action === 'update') {
      const { error } = await admin.from('profiles').update(body.updates).eq('id', body.user_id)
      if (error) throw error
      return Response.json({ ok: true }, { headers: corsHeaders })
    }
    if (body.action === 'delete') {
      if (body.user_id === user.id) throw new Error('Vous ne pouvez pas supprimer votre propre compte')
      const { error } = await admin.auth.admin.deleteUser(body.user_id)
      if (error) throw error
      return Response.json({ ok: true }, { headers: corsHeaders })
    }
    throw new Error('Action inconnue')
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erreur interne' }, { status: 400, headers: corsHeaders })
  }
} }
