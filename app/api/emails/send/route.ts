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
  include_icebreaker?: boolean // Nouveau paramètre
  is_first_email?: boolean // Pour la séquence
}

export async function POST(request: NextRequest) {
  try {
    const body: SendEmailRequest = await request.json()
    const { 
      contact_id, 
      to_email, 
      to_name, 
      subject, 
      html_content, 
      template_id,
      include_icebreaker = true, // Par défaut on inclut l'ice breaker
      is_first_email = true
    } = body

    if (!to_email || !subject || !html_content) {
      return NextResponse.json({ error: 'Email, sujet et contenu requis' }, { status: 400 })
    }

    let finalContent = html_content

    // Si c'est le premier email et qu'on veut inclure l'ice breaker
    if (include_icebreaker && is_first_email && contact_id) {
      // Récupérer l'ice breaker du contact
      const { data: contact } = await supabase
        .from('contacts')
        .select('icebreaker, prenom, nom')
        .eq('id', contact_id)
        .single()

      if (contact?.icebreaker) {
        // Insérer l'ice breaker au début du contenu (après le "Bonjour")
        const icebreakHtml = `<p style="color: #374151; margin-bottom: 16px;">${contact.icebreaker}</p>`
        
        // Chercher où insérer (après le premier <p> qui contient "Bonjour")
        const bonjourRegex = /(<p[^>]*>.*?Bonjour.*?<\/p>)/i
        if (bonjourRegex.test(finalContent)) {
          finalContent = finalContent.replace(bonjourRegex, `$1\n${icebreakHtml}`)
        } else {
          // Sinon, ajouter au tout début
          finalContent = icebreakHtml + finalContent
        }
      }
    }

    // Remplacer les variables dans le contenu
    if (contact_id) {
      const { data: contactData } = await supabase
        .from('contacts')
        .select(`*, etablissements (*)`)
        .eq('id', contact_id)
        .single()

      if (contactData) {
        const etab = contactData.etablissements as any
        finalContent = finalContent
          .replace(/\{\{prenom\}\}/g, contactData.prenom || '')
          .replace(/\{\{nom\}\}/g, contactData.nom || '')
          .replace(/\{\{poste\}\}/g, contactData.poste || '')
          .replace(/\{\{nom_etablissement\}\}/g, etab?.nom || '')
          .replace(/\{\{type_etablissement\}\}/g, etab?.type || '')
          .replace(/\{\{ville\}\}/g, etab?.ville || '')
          .replace(/\{\{icebreaker\}\}/g, contactData.icebreaker || '')
      }
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
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: to_email, name: to_name || to_email }],
        subject: subject,
        htmlContent: finalContent,
        tags: ['soignantvoice', 'prospection'],
      }),
    })

    const brevoData = await brevoResponse.json()

    if (!brevoResponse.ok) {
      console.error('Brevo error:', brevoData)
      return NextResponse.json({ error: brevoData.message || 'Erreur Brevo' }, { status: 500 })
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
        is_first_email: is_first_email,
        has_icebreaker: include_icebreaker && is_first_email,
      })
      .select()
      .single()

    if (dbError) console.error('DB error:', dbError)

    // Mettre à jour le statut de prospection
    if (contact_id) {
      const { data: prospection } = await supabase
        .from('prospection')
        .select('id, etape_actuelle')
        .eq('contact_id', contact_id)
        .single()

      if (prospection) {
        await supabase.from('prospection').update({
          statut: 'en_cours',
          derniere_action: new Date().toISOString(),
          etape_actuelle: (prospection.etape_actuelle || 0) + 1,
        }).eq('id', prospection.id)
      } else {
        await supabase.from('prospection').insert({
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
      had_icebreaker: include_icebreaker && is_first_email,
    })

  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
