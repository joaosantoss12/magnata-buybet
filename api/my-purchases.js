import { verifySession } from './_lib/session.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'

const SELLER = 'magnata'

export default async function handler(req, res) {
  const session = verifySession(req.cookies)
  if (!session) {
    return res.status(200).json({ status: 'logged_out', purchases: [] })
  }

  const { data, error } = await supabaseAdmin
    .from('purchases')
    .select('id,game,bet,odd,analysis,markets,image_url,paid_at')
    .eq('seller', SELLER)
    .eq('telegram_user_id', session.id)
    .eq('paid', true)
    .order('paid_at', { ascending: false })

  if (error) {
    console.error('[my-purchases]', error.message)
    return res.status(500).json({ status: 'error', purchases: [] })
  }

  res.status(200).json({ status: 'ok', purchases: data ?? [] })
}
