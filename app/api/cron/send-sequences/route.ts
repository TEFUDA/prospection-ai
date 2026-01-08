import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendProspectionEmail } from '@/lib/brevo'

// Ce endpoint doit être appelé par un CRON (Vercel, cron-job.org, etc.)
// Toutes les heures par exemple

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      processed: 0,
      sent: 0,
      errors: [] as string[]
    }

    // 1. Trouver les prospects qui doivent recevoir le prochain email
    const { data: prospects, error } = await supabaseAdmin
      .from('prospection')
      .select(`
        *,
        contacts (*, etablissements (*))
      `)
      .eq('statut', 'sequence_en_cours')
      .lte('date_prochain_contact', new Date().toISOString())
      .lt('sequence_step', 4)  // Max 4 steps dans la séquence

    if (error) {
      console.error('Error fetching prospects:', error)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!prospects || prospects.length === 0) {
      return NextResponse.json({ 
        message: 'No prospects to process',
        results 
      })
    }

    // 2. Pour chaque prospect, envoyer le prochain email de la séquence
    for (const prospect of prospects) {
      results.processed++

      const contact = prospect.contacts
      if (!contact || !contact.email || contact.email_status !== 'valid') {
        continue
      }

      const nextStep = (prospect.sequence_step || 0) + 1

      // Récupérer le template de l'email
      const { data: sequenceStep } = await supabaseAdmin
        .from('sequence_steps')
        .select('*')
        .eq('sequence_id', prospect.sequence_id || '00000000-0000-0000-0000-000000000001')
        .eq('step_number', nextStep)
        .single()

      if (!sequenceStep) {
        // Fin de la séquence
        await supabaseAdmin
          .from('prospection')
          .update({
            statut: 'a_prospecter', // Retour à prospecter (pas de réponse)
            sequence_step: 4
          })
          .eq('id', prospect.id)
        continue
      }

      try {
        // Envoyer l'email
        const result = await sendProspectionEmail({
          toEmail: contact.email,
          toName: `${contact.prenom} ${contact.nom}`,
          subject: sequenceStep.subject,
          htmlContent: sequenceStep.body_html,
          textContent: sequenceStep.body_text,
          etablissement: contact.etablissements?.nom || '',
          contactPrenom: contact.prenom || '',
          contactPoste: contact.poste || '',
          typeEtablissement: contact.etablissements?.type || '',
        })

        // Enregistrer l'email envoyé
        await supabaseAdmin
          .from('emails_sent')
          .insert({
            contact_id: contact.id,
            prospection_id: prospect.id,
            brevo_message_id: result.messageId,
            subject: sequenceStep.subject,
            to_email: contact.email,
            status: 'sent',
            sequence_step_id: sequenceStep.id,
          })

        // Calculer la prochaine date de contact
        const nextStepData = await supabaseAdmin
          .from('sequence_steps')
          .select('delay_days')
          .eq('sequence_id', prospect.sequence_id || '00000000-0000-0000-0000-000000000001')
          .eq('step_number', nextStep + 1)
          .single()

        const nextContactDate = new Date()
        if (nextStepData?.data?.delay_days) {
          nextContactDate.setDate(nextContactDate.getDate() + nextStepData.data.delay_days)
        }

        // Mettre à jour la prospection
        await supabaseAdmin
          .from('prospection')
          .update({
            sequence_step: nextStep,
            nb_emails_envoyes: prospect.nb_emails_envoyes + 1,
            date_dernier_contact: new Date().toISOString(),
            date_prochain_contact: nextContactDate.toISOString(),
          })
          .eq('id', prospect.id)

        results.sent++

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))

      } catch (error: any) {
        results.errors.push(`${contact.email}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('CRON error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
