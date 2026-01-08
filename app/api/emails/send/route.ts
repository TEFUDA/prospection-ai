import { NextRequest, NextResponse } from 'next/server'
import { sendProspectionEmail } from '@/lib/brevo'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      contactId,
      toEmail, 
      toName,
      subject, 
      htmlContent,
      textContent,
      etablissement,
      contactPrenom,
      contactPoste,
      typeEtablissement,
      sequenceStepId
    } = body

    // Validation
    if (!toEmail || !subject || !htmlContent) {
      return NextResponse.json(
        { error: 'Missing required fields: toEmail, subject, htmlContent' },
        { status: 400 }
      )
    }

    // Envoyer l'email via Brevo
    const result = await sendProspectionEmail({
      toEmail,
      toName: toName || '',
      subject,
      htmlContent,
      textContent,
      etablissement: etablissement || '',
      contactPrenom: contactPrenom || '',
      contactPoste: contactPoste || '',
      typeEtablissement: typeEtablissement || '',
    })

    // Enregistrer dans la base de données
    if (contactId) {
      const { error: dbError } = await supabaseAdmin
        .from('emails_sent')
        .insert({
          contact_id: contactId,
          brevo_message_id: result.messageId,
          subject,
          to_email: toEmail,
          status: 'sent',
          sequence_step_id: sequenceStepId || null,
        })

      if (dbError) {
        console.error('DB Error:', dbError)
      }

      // Mettre à jour le compteur d'emails envoyés
      await supabaseAdmin.rpc('increment_emails_sent', { 
        p_contact_id: contactId 
      })
    }

    return NextResponse.json({ 
      success: true, 
      messageId: result.messageId 
    })

  } catch (error: any) {
    console.error('Send email error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send email' },
      { status: 500 }
    )
  }
}

// Envoyer en masse
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactIds, sequenceId } = body

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400 }
      )
    }

    // Récupérer les contacts avec leurs infos
    const { data: contacts, error: contactsError } = await supabaseAdmin
      .from('contacts')
      .select(`
        *,
        etablissements (*),
        prospection (*)
      `)
      .in('id', contactIds)
      .eq('email_status', 'valid')

    if (contactsError || !contacts) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    // Récupérer le premier step de la séquence
    const { data: sequenceStep } = await supabaseAdmin
      .from('sequence_steps')
      .select('*')
      .eq('sequence_id', sequenceId || '00000000-0000-0000-0000-000000000001')
      .eq('step_number', 1)
      .single()

    if (!sequenceStep) {
      return NextResponse.json(
        { error: 'Sequence step not found' },
        { status: 404 }
      )
    }

    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Envoyer les emails
    for (const contact of contacts) {
      try {
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
            brevo_message_id: result.messageId,
            subject: sequenceStep.subject,
            to_email: contact.email,
            status: 'sent',
            sequence_step_id: sequenceStep.id,
          })

        // Mettre à jour la prospection
        await supabaseAdmin
          .from('prospection')
          .update({
            statut: 'sequence_en_cours',
            sequence_step: 1,
            nb_emails_envoyes: (contact.prospection?.[0]?.nb_emails_envoyes || 0) + 1,
            date_dernier_contact: new Date().toISOString(),
            date_premier_contact: contact.prospection?.[0]?.date_premier_contact || new Date().toISOString(),
          })
          .eq('contact_id', contact.id)

        results.sent++

        // Rate limiting - attendre 100ms entre chaque email
        await new Promise(resolve => setTimeout(resolve, 100))

      } catch (error: any) {
        results.failed++
        results.errors.push(`${contact.email}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results
    })

  } catch (error: any) {
    console.error('Bulk send error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send emails' },
      { status: 500 }
    )
  }
}
