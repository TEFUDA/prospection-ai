import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Types d'events Brevo
type BrevoEventType = 
  | 'delivered' 
  | 'opened' 
  | 'clicked' 
  | 'soft_bounce' 
  | 'hard_bounce' 
  | 'spam' 
  | 'unsubscribed'
  | 'blocked'

interface BrevoWebhookPayload {
  event: BrevoEventType
  email: string
  'message-id': string
  date: string
  ts: number
  link?: string
  ip?: string
  'user-agent'?: string
  tag?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const payload: BrevoWebhookPayload = await request.json()
    
    console.log('Brevo Webhook received:', payload.event, payload.email)

    const { 
      event, 
      email, 
      'message-id': messageId,
      link,
      ip,
      'user-agent': userAgent 
    } = payload

    // Trouver l'email envoyé correspondant
    const { data: emailSent, error: findError } = await supabaseAdmin
      .from('emails_sent')
      .select('*, contacts(*)')
      .eq('brevo_message_id', messageId)
      .single()

    if (findError || !emailSent) {
      // Essayer de trouver par email
      const { data: emailByAddress } = await supabaseAdmin
        .from('emails_sent')
        .select('*, contacts(*)')
        .eq('to_email', email)
        .order('sent_at', { ascending: false })
        .limit(1)
        .single()

      if (!emailByAddress) {
        console.log('Email not found:', messageId, email)
        return NextResponse.json({ received: true, found: false })
      }
    }

    const targetEmail = emailSent || null

    // Enregistrer l'event
    if (targetEmail) {
      await supabaseAdmin
        .from('email_events')
        .insert({
          email_sent_id: targetEmail.id,
          event_type: event,
          event_data: payload,
          ip_address: ip,
          user_agent: userAgent,
          link_clicked: link,
        })

      // Mettre à jour l'email envoyé
      const updates: Record<string, any> = {}
      
      switch (event) {
        case 'delivered':
          updates.status = 'delivered'
          break
          
        case 'opened':
          updates.status = 'opened'
          updates.opened_at = new Date().toISOString()
          updates.open_count = (targetEmail.open_count || 0) + 1
          break
          
        case 'clicked':
          updates.status = 'clicked'
          updates.clicked_at = new Date().toISOString()
          updates.click_count = (targetEmail.click_count || 0) + 1
          break
          
        case 'hard_bounce':
        case 'soft_bounce':
          updates.status = 'bounced'
          break
          
        case 'spam':
          updates.status = 'spam'
          break
          
        case 'unsubscribed':
          updates.status = 'unsubscribed'
          break
      }

      if (Object.keys(updates).length > 0) {
        await supabaseAdmin
          .from('emails_sent')
          .update(updates)
          .eq('id', targetEmail.id)
      }

      // Mettre à jour les stats de prospection
      if (targetEmail.contact_id) {
        const prospectionUpdates: Record<string, any> = {}

        if (event === 'opened') {
          // Incrémenter le compteur d'ouvertures
          await supabaseAdmin.rpc('increment_opens', { 
            p_contact_id: targetEmail.contact_id 
          })
        }

        if (event === 'clicked') {
          // Incrémenter le compteur de clics
          await supabaseAdmin.rpc('increment_clicks', { 
            p_contact_id: targetEmail.contact_id 
          })
        }

        if (event === 'hard_bounce') {
          // Marquer l'email comme invalide
          await supabaseAdmin
            .from('contacts')
            .update({ email_status: 'invalid' })
            .eq('id', targetEmail.contact_id)
        }
      }
    }

    return NextResponse.json({ 
      received: true,
      event,
      processed: true
    })

  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}

// Brevo envoie parfois en GET pour vérifier le webhook
export async function GET() {
  return NextResponse.json({ status: 'Webhook active' })
}
