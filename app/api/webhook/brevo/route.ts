import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Client Supabase avec service role pour les webhooks
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

// Types d'events Brevo
interface BrevoWebhookPayload {
  event: string
  email: string
  'message-id'?: string
  date?: string
  ts?: number
  link?: string
  ip?: string
  tag?: string[]
}

export async function POST(request: NextRequest) {
  try {
    const payload: BrevoWebhookPayload = await request.json()
    
    console.log('📨 Brevo Webhook:', payload.event, payload.email)

    const { event, email, 'message-id': messageId, link } = payload

    // Trouver l'email envoyé correspondant par l'adresse email
    const { data: emailRecord, error: findError } = await supabase
      .from('emails_envoyes')
      .select('*, contacts!inner(id, email, email_status)')
      .eq('contacts.email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (findError) {
      console.error('Erreur recherche email:', findError)
    }

    if (!emailRecord) {
      console.log('Email non trouvé dans la base:', email)
      // Même si on ne trouve pas, on retourne OK pour que Brevo ne réessaye pas
      return NextResponse.json({ received: true, found: false })
    }

    const now = new Date().toISOString()

    // Mettre à jour selon le type d'événement
    switch (event) {
      case 'delivered':
        await supabase
          .from('emails_envoyes')
          .update({ statut: 'delivered' })
          .eq('id', emailRecord.id)
        break
        
      case 'opened':
      case 'unique_opened':
        await supabase
          .from('emails_envoyes')
          .update({ 
            statut: 'opened',
            ouvert_at: emailRecord.ouvert_at || now // Ne met à jour que si pas déjà ouvert
          })
          .eq('id', emailRecord.id)
        
        console.log('✅ Email ouvert:', email)
        break
        
      case 'click':
      case 'clicked':
        await supabase
          .from('emails_envoyes')
          .update({ 
            statut: 'clicked',
            clique_at: emailRecord.clique_at || now,
            lien_clique: link
          })
          .eq('id', emailRecord.id)
        
        console.log('✅ Lien cliqué:', email, link)
        break
        
      case 'hard_bounce':
      case 'soft_bounce':
        await supabase
          .from('emails_envoyes')
          .update({ statut: 'bounced' })
          .eq('id', emailRecord.id)
        
        // Marquer l'email du contact comme invalide
        if (emailRecord.contact_id) {
          await supabase
            .from('contacts')
            .update({ email_status: 'invalide' })
            .eq('id', emailRecord.contact_id)
        }
        
        console.log('❌ Bounce:', email)
        break
        
      case 'spam':
      case 'complaint':
        await supabase
          .from('emails_envoyes')
          .update({ statut: 'spam' })
          .eq('id', emailRecord.id)
        
        console.log('⚠️ Spam:', email)
        break
        
      case 'unsubscribed':
        await supabase
          .from('emails_envoyes')
          .update({ statut: 'unsubscribed' })
          .eq('id', emailRecord.id)
        
        // Mettre à jour le statut de prospection
        if (emailRecord.contact_id) {
          await supabase
            .from('prospection')
            .update({ statut: 'pas_interesse' })
            .eq('contact_id', emailRecord.contact_id)
        }
        
        console.log('🚫 Désabonné:', email)
        break
    }

    return NextResponse.json({ 
      received: true,
      event,
      email,
      processed: true
    })

  } catch (error: any) {
    console.error('❌ Webhook error:', error)
    // On retourne quand même 200 pour éviter les retry de Brevo
    return NextResponse.json({ 
      received: true,
      error: error.message 
    })
  }
}

// GET pour vérifier que le webhook est actif
export async function GET() {
  return NextResponse.json({ 
    status: 'active',
    message: 'SoignantVoice Brevo Webhook',
    timestamp: new Date().toISOString()
  })
}
