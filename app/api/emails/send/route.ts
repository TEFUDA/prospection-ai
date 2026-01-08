import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const BREVO_API_KEY = process.env.BREVO_API_KEY
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'contact@soignantvoice.fr'
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Loïc - SoignantVoice'

interface SendEmailRequest {
  contact_id: string
  to_email: string
  to_name?: string
  subject: string
  html_content: string
  template_id?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json()
    const { contact_id, to_email, to_name, subject, html_content, template_id } = body

    if (!to_email || !subject || !html_content) {
      return NextResponse.json(
        { error: 'Email, sujet et contenu requis' },
        { status: 400 }
      )
    }

    // Envoyer via Brevo API
    const brevoResponse = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: {
          name: SENDER_NAME,
          email: SENDER_EMAIL,
        },
        to: [
          {
            email: to_email,
            name: to_name || to_email,
          },
        ],
        subject: subject,
        htmlContent: html_content,
        tags: ['soignantvoice', 'prospection'],
      }),
    })

    const brevoData = await brevoResponse.json()

    if (!brevoResponse.ok) {
      console.error('Brevo error:', brevoData)
      return NextResponse.json(
        { error: brevoData.message || 'Erreur Brevo' },
        { status: 500 }
      )
    }

    // Enregistrer l'email dans la base
    const { data: emailRecord, error: dbError } = await supabase
      .from('emails_envoyes')
      .insert({
        contact_id: contact_id || null,
        template_id: template_id || null,
        brevo_message_id: brevoData.messageId,
        sujet: subject,
        statut: 'envoye',
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB error:', dbError)
    }

    // Mettre à jour le statut de prospection si contact_id fourni
    if (contact_id) {
      // Vérifier si une prospection existe
      const { data: prospection } = await supabase
        .from('prospection')
        .select('id, etape_actuelle')
        .eq('contact_id', contact_id)
        .single()

      if (prospection) {
        await supabase
          .from('prospection')
          .update({
            statut: 'en_cours',
            derniere_action: new Date().toISOString(),
            etape_actuelle: (prospection.etape_actuelle || 0) + 1,
          })
          .eq('id', prospection.id)
      } else {
        // Créer une nouvelle prospection
        await supabase
          .from('prospection')
          .insert({
            contact_id,
            statut: 'en_cours',
            derniere_action: new Date().toISOString(),
            etape_actuelle: 1,
          })
      }
    }

    return NextResponse.json({
      success: true,
      messageId: brevoData.messageId,
      email_id: emailRecord?.id,
    })

  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
