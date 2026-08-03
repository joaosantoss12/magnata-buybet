import { verifySession } from './_lib/session.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'

const SELLER = 'magnata'

export default async function handler(req, res) {
  const session = verifySession(req.cookies)
  if (!session) {
    return res.status(200).json({ status: 'logged_out' })
  }

  const purchaseId = req.query.id
  if (!purchaseId || typeof purchaseId !== 'string') {
    return res.status(400).json({ status: 'error', error: 'Missing id' })
  }

  const { data: purchase, error } = await supabaseAdmin
    .from('purchases')
    .select('*')
    .eq('id', purchaseId)
    .eq('seller', SELLER)
    .single()

  if (error || !purchase) {
    return res.status(404).json({ status: 'not_found' })
  }

  // A purchase belongs to whichever Telegram account bought it — never leak
  // it to a different logged-in session even if they guess the id.
  if (String(purchase.telegram_user_id) !== String(session.id)) {
    return res.status(403).json({ status: 'forbidden' })
  }

  if (!purchase.paid) {
    return res.status(200).json({ status: 'pending' })
  }

  res.status(200).json({
    status: 'ready',
    pick: {
      id: purchase.id,
      game: purchase.game,
      bet: purchase.bet,
      odd: purchase.odd,
      analysis: purchase.analysis,
      markets: purchase.markets,
      image_url: purchase.image_url,
      paid_at: purchase.paid_at,
    },
  })
}
