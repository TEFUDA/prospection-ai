import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const BREVO_API_KEY = process.env.BREVO_API_KEY
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'contact@soignantvoice.fr'
const SENDER_NAME = process.env.BREVO_SENDER_NAME || 'Loïc - SoignantVoice'

// Configuration de la séquence
const SEQUENCE_STEPS = [
  { step: 1, delay_days: 0, template_index: 0 },   // J+0: Email 1
  { step: 2, delay_days: 3, template_index: 1 },   // J+3: Email 2
  { step: 3, delay_days: 7, template_index: 2 },   // J+7: Email 3
  { step: 4, delay_days: 14, template_index: 3 },  // J+14: Email 4
]

const MAX_EMAILS_PER_RUN = 50

async function sendEmail(contact: any, template: any, isFirstEmail: boolean): Promise<boolean> {
  try {
    const etab = contact.etablissements
    let content = template.contenu
      .replace(/\{\{nom_etablissement\}\}/g, etab?.nom || '')
      .replace(/\{\{ville\}\}/g, etab?.ville || '')
      .replace(/\{\{type\}\}/g, etab?.type || '')
      .replace(/\{\{prenom\}\}/g, contact.prenom || '')
      .replace(/\{\{nom\}\}/g, contact.nom || '')
      .replace(/\{\{poste\}\}/g, contact.poste || '')

    if (isFirstEmail && contact.icebreaker) {
      const icebreakHtml = `<p style="color: #374151; margin-bottom: 16px;">${contact.icebreaker}</p>`
      const bonjourRegex = /(<p[^>]*>.*?Bonjour.*?<\/p>)/i
      if (bonjourRegex.test(content)) {
        content = content.replace(bonjourRegex, `$1\n${icebreakHtml}`)
      } else {
        content = icebreakHtml + content
      }
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY || '',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: contact.email, name: `${contact.prenom || ''} ${contact.nom || ''}`.trim() || etab?.nom }],
        subject: template.sujet,
        htmlContent: content,
        tags: ['soignantvoice', 'sequence', `step-${template.step || 1}`],
      }),
    })

    if (!response.ok) return false
    const brevoData = await response.json()

    await supabase.from('emails_envoyes').insert({
      contact_id: contact.id,
      template_id: template.id,
      brevo_message_id: brevoData.messageId,
      sujet: template.sujet,
      statut: 'envoye',
      is_first_email: isFirstEmail,
      has_icebreaker: isFirstEmail && !!contact.icebreaker,
      sequence_step: template.step || 1,
    })

    return true
  } catch (err) {
    console.error('Send email error:', err)
    return false
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = { checked: 0, emails_sent: 0, errors: 0, details: [] as any[] }

  try {
    const { data: templates } = await supabase.from('email_templates').select('*').order('created_at')
    if (!templates || templates.length < 4) {
      return NextResponse.json({ error: 'Pas assez de templates (4 requis)' }, { status: 400 })
    }

    // 1. NOUVEAUX CONTACTS (J+0) - Email validé + Ice breaker prêt + Jamais contacté
    const { data: newContacts } = await supabase
      .from('contacts')
      .select(`*, etablissements (*)`)
      .eq('email_status', 'valide')
      .not('icebreaker', 'is', null)
      .is('sequence_started_at', null)
      .limit(MAX_EMAILS_PER_RUN / 2)

    for (const contact of newContacts || []) {
      results.checked++
      const template = { ...templates[0], step: 1 }
      const success = await sendEmail(contact, template, true)
      
      if (success) {
        await supabase.from('contacts').update({
          sequence_started_at: new Date().toISOString(),
          sequence_step: 1,
          last_email_at: new Date().toISOString(),
        }).eq('id', contact.id)

        const { data: existingProsp } = await supabase.from('prospection').select('id').eq('contact_id', contact.id).single()
        if (existingProsp) {
          await supabase.from('prospection').update({ statut: 'en_cours', etape_actuelle: 1, derniere_action: new Date().toISOString() }).eq('id', existingProsp.id)
        } else {
          await supabase.from('prospection').insert({ contact_id: contact.id, statut: 'en_cours', etape_actuelle: 1, derniere_action: new Date().toISOString() })
        }

        results.emails_sent++
        results.details.push({ contact_id: contact.id, email: contact.email, step: 1, type: 'new' })
      } else {
        results.errors++
      }
    }

    // 2. RELANCES (J+3, J+7, J+14)
    for (const stepConfig of SEQUENCE_STEPS.slice(1)) {
      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - stepConfig.delay_days)

      const { data: contactsToFollow } = await supabase
        .from('contacts')
        .select(`*, etablissements (*)`)
        .eq('email_status', 'valide')
        .eq('sequence_step', stepConfig.step - 1)
        .not('sequence_started_at', 'is', null)
        .lt('last_email_at', cutoffDate.toISOString())
        .is('sequence_completed_at', null)
        .limit(MAX_EMAILS_PER_RUN / 4)

      for (const contact of contactsToFollow || []) {
        results.checked++

        // Vérifier statut prospection (arrêter si intéressé/rdv/client)
        const { data: prosp } = await supabase.from('prospection').select('statut').eq('contact_id', contact.id).single()
        if (['interesse', 'rdv_pris', 'client', 'pas_interesse'].includes(prosp?.statut)) continue

        const template = { ...templates[stepConfig.template_index], step: stepConfig.step }
        const success = await sendEmail(contact, template, false)

        if (success) {
          const updateData: any = { sequence_step: stepConfig.step, last_email_at: new Date().toISOString() }
          if (stepConfig.step === 4) updateData.sequence_completed_at = new Date().toISOString()
          
          await supabase.from('contacts').update(updateData).eq('id', contact.id)
          await supabase.from('prospection').update({ etape_actuelle: stepConfig.step, derniere_action: new Date().toISOString() }).eq('contact_id', contact.id)

          results.emails_sent++
          results.details.push({ contact_id: contact.id, email: contact.email, step: stepConfig.step, type: 'followup' })
        } else {
          results.errors++
        }
      }
    }

    return NextResponse.json({ success: true, ...results, timestamp: new Date().toISOString() })
  } catch (error: any) {
    return NextResponse.json({ error: error.message, ...results }, { status: 500 })
  }
}
