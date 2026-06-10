import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTelegram } from '@/lib/telegram'
import OpenAI from 'openai'

const MODELS = [
  'google/gemma-3-12b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'qwen/qwen-2.5-7b-instruct:free',
  'google/gemma-2-9b-it:free',
  'meta-llama/llama-3.1-8b-instruct:free',
]

export async function POST(request: NextRequest) {
  // Telegram sends this header when a secret_token is set on the webhook
  const secret = request.headers.get('x-telegram-bot-api-secret-token')
  if (!secret || secret !== process.env.POSTMARK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let body: any
  try { body = await request.json() } catch { return NextResponse.json({ ok: true }) }

  const message = body?.message
  if (!message?.text) return NextResponse.json({ ok: true })

  const chatId  = String(message.chat.id)
  const text    = message.text.trim()
  const fromName = message.from?.first_name ?? 'Someone'

  // Only respond to our own chat
  if (chatId !== process.env.TELEGRAM_CHAT_ID) {
    return NextResponse.json({ ok: true })
  }

  // Acknowledge immediately — fetch data + LLM in background
  const supabase = createServiceClient()
  handleQuestion(supabase, text, fromName).catch(err =>
    console.error('[TelegramBot] error:', err)
  )

  return NextResponse.json({ ok: true })
}

async function handleQuestion(supabase: any, question: string, fromName: string) {
  const today = new Date().toISOString().slice(0, 10)

  // ── Fetch live context in parallel ────────────────────────────────────────
  const [ordersRes, productsRes, customersRes, suggestionsRes, invoicesRes, sessionRes] =
    await Promise.all([
      // Pending wholesale orders
      supabase
        .from('wholesale_orders')
        .select('id, delivery_date, status, customer:wholesale_customers(name), items:wholesale_order_items(quantity, unit_price, product:products(name))')
        .in('status', ['draft', 'confirmed'])
        .order('delivery_date', { ascending: true, nullsFirst: false })
        .limit(20),

      // Active products with costs and prices
      supabase
        .from('products')
        .select('name, purchase_cost, retail_price, case_size, category')
        .eq('is_active', true)
        .order('name')
        .limit(150),

      // Wholesale customers with unpaid invoice totals
      supabase
        .from('wholesale_invoices')
        .select('customer:wholesale_customers(name), total_amount, amount_paid, payment_status, due_date')
        .neq('payment_status', 'paid')
        .order('due_date', { ascending: true })
        .limit(30),

      // Pending price suggestions
      supabase
        .from('price_suggestions')
        .select('product:products(name), current_retail_price, suggested_retail_price, margin_percentage, rule_applied')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),

      // Recent invoices (last 14 days)
      supabase
        .from('purchase_invoices')
        .select('supplier_name, invoice_date, total_amount, status')
        .gte('invoice_date', new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10))
        .order('invoice_date', { ascending: false })
        .limit(20),

      // Today's market session
      supabase
        .from('market_session_items')
        .select('qty_boxes, price_pence, product:products(name), supplier:purchase_suppliers(name)')
        .eq('session_id',
          (await supabase
            .from('market_sessions')
            .select('id')
            .eq('session_date', today)
            .order('opened_at', { ascending: false })
            .limit(1)
            .single()
          ).data?.id ?? '00000000-0000-0000-0000-000000000000'
        )
        .limit(30),
    ])

  // ── Build context string ───────────────────────────────────────────────────
  const lines: string[] = [`Today: ${today}\n`]

  // Pending orders
  const orders = ordersRes.data ?? []
  if (orders.length > 0) {
    lines.push('## Pending wholesale orders')
    for (const o of orders) {
      const due = o.delivery_date ?? 'no date'
      const items = ((o.items ?? []) as any[])
        .map((i: any) => `${Number(i.quantity)}× ${i.product?.name ?? '?'} @ £${(i.unit_price / 100).toFixed(2)}`)
        .join(', ')
      lines.push(`- ${o.customer?.name} (${due}, ${o.status}): ${items}`)
    }
    lines.push('')
  }

  // Unpaid invoices / customer balances
  const unpaid = customersRes.data ?? []
  if (unpaid.length > 0) {
    lines.push('## Outstanding customer balances')
    const byCustomer = new Map<string, number>()
    for (const inv of unpaid as any[]) {
      const name = inv.customer?.name ?? 'Unknown'
      const owed = inv.total_amount - inv.amount_paid
      byCustomer.set(name, (byCustomer.get(name) ?? 0) + owed)
    }
    for (const [name, owed] of byCustomer) {
      lines.push(`- ${name}: owes £${(owed / 100).toFixed(2)}`)
    }
    lines.push('')
  }

  // Products (compact)
  const products = productsRes.data ?? []
  if (products.length > 0) {
    lines.push('## Products (name, cost, retail)')
    for (const p of products as any[]) {
      const cost   = p.purchase_cost ? `cost £${(p.purchase_cost / 100).toFixed(2)}` : 'no cost'
      const retail = p.retail_price  ? `retail £${(p.retail_price / 100).toFixed(2)}` : 'no price'
      lines.push(`- ${p.name}: ${cost}, ${retail}`)
    }
    lines.push('')
  }

  // Price suggestions
  const suggestions = suggestionsRes.data ?? []
  if (suggestions.length > 0) {
    lines.push('## Pending price suggestions')
    for (const s of suggestions as any[]) {
      lines.push(`- ${s.product?.name}: currently £${(s.current_retail_price / 100).toFixed(2)}, suggest £${(s.suggested_retail_price / 100).toFixed(2)} (${s.rule_applied})`)
    }
    lines.push('')
  }

  // Recent deliveries
  const invoices = invoicesRes.data ?? []
  if (invoices.length > 0) {
    lines.push('## Recent supplier deliveries (last 14 days)')
    for (const inv of invoices as any[]) {
      const total = inv.total_amount ? `£${(inv.total_amount / 100).toFixed(2)}` : 'no total'
      lines.push(`- ${inv.supplier_name} ${inv.invoice_date}: ${total} (${inv.status})`)
    }
    lines.push('')
  }

  // Today's market buys
  const sessionItems = sessionRes.data ?? []
  if (sessionItems.length > 0) {
    lines.push("## Today's market buys")
    for (const item of sessionItems as any[]) {
      const price = item.price_pence ? `£${(item.price_pence / 100).toFixed(2)}/box` : 'no price'
      lines.push(`- ${item.product?.name ?? '?'}: ${item.qty_boxes} box${item.qty_boxes !== 1 ? 'es' : ''} ${price}`)
    }
    lines.push('')
  }

  const context = lines.join('\n')

  // ── LLM ───────────────────────────────────────────────────────────────────
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    await sendTelegram('Sorry, AI is not configured (no OpenRouter key).')
    return
  }

  const client = new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey })

  const systemPrompt = `You are FreshBot — the AI assistant for Fresh & Fruity, a greengrocer in Newcastle run by David.
You have live data from the system (orders, prices, deliveries, customer balances).
Answer questions directly and concisely. David has ADHD — keep answers short, use £ amounts, no bullet points unless listing items, no waffle.
If you don't know something from the data provided, say so clearly.
Never make up prices or numbers not in the data.`

  const userPrompt = `${fromName} asks: ${question}\n\n--- LIVE DATA ---\n${context}`

  const reply = await Promise.race([
    Promise.any(
      MODELS.map(model =>
        client.chat.completions.create({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt   },
          ],
          temperature: 0.2,
          max_tokens:  300,
          stream:      false,
        }).then(r => {
          const text = r.choices[0]?.message?.content?.trim()
          if (!text) throw new Error('empty')
          return text
        })
      )
    ).catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), 15000)),
  ])

  if (!reply) {
    await sendTelegram('Sorry, all AI models timed out. Try again in a moment.')
    return
  }

  await sendTelegram(reply)
}
