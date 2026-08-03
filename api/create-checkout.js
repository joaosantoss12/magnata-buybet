import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { verifySession } from './_lib/session.js'
import { supabaseAdmin } from './_lib/supabaseAdmin.js'

const SELLER = 'magnata'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[create-checkout] STRIPE_SECRET_KEY is not set')
    return res.status(500).json({ error: 'Stripe não configurado.' })
  }

  // Telegram login is mandatory — the pick is delivered on-site to whoever's
  // logged in, so an unauthenticated request can never start a purchase.
  const tgSession = verifySession(req.cookies)
  if (!tgSession) {
    return res.status(401).json({ error: 'Tens de iniciar sessão com o Telegram antes de comprar.' })
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY
  )

  try {
    // Fetch the current pick and snapshot it now: the admin panel overwrites
    // this same row in place for the next pick, so we must copy its content
    // into the purchase record rather than referencing it by id — otherwise
    // a buyer could end up seeing tomorrow's pick instead of the one they paid for.
    const { data: pick, error: pickError } = await supabase
      .from('picks')
      .select('*')
      .eq('active', true)
      .eq('seller', SELLER)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (pickError || !pick) {
      return res.status(409).json({ error: 'Não há nenhuma aposta disponível de momento.' })
    }

    const priceInCents = Math.round(parseFloat(pick.price || '14.99') * 100)

    const { data: purchase, error: insertError } = await supabaseAdmin
      .from('purchases')
      .insert({
        seller: SELLER,
        telegram_user_id: tgSession.id,
        telegram_username: tgSession.username ?? null,
        telegram_name: tgSession.first_name,
        game: pick.game,
        bet: pick.bet,
        odd: pick.odd,
        analysis: pick.analysis,
        markets: pick.markets,
        image_url: pick.image_url,
        price: pick.price,
        paid: false,
      })
      .select('id')
      .single()

    if (insertError || !purchase) {
      console.error('[create-checkout] purchase insert failed:', insertError?.message)
      return res.status(500).json({ error: 'Não foi possível preparar a compra.' })
    }

    const origin = req.headers.origin || process.env.FRONTEND_URL || 'https://magnataapostas.vercel.app'
    const session = await stripe.checkout.sessions.create({
      locale: 'pt',
      metadata: { seller: SELLER, purchase_id: purchase.id },
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: 'Análise Desportiva Premium',
              description:
                'Análise completa e aposta recomendada, disponível no site após o pagamento.',
            },
            unit_amount: priceInCents,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      payment_method_types: ['card', 'mb_way'],
      billing_address_collection: 'auto',
      customer_creation: 'always',
      success_url: `${origin}/?success=1&purchase_id=${purchase.id}`,
      cancel_url: `${origin}/`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[create-checkout]', err.message)
    res.status(500).json({ error: 'Não foi possível criar a sessão de pagamento.' })
  }
}
