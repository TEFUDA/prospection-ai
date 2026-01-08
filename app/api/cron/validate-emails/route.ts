import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { validateEmail, mapZeroBounceStatus, getCredits } from '@/lib/zerobounce'

// =====================================================
// CRON AUTOMATIQUE - VALIDATION EMAILS
// =====================================================
// Ce CRON valide les emails trouvés par Hunter
// avant de les ajouter aux séquences d'envoi

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  const isDev = process.env.NODE_ENV === 'development'
  if (!isDev && cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const results = {
      processed: 0,
      valid: 0,
      invalid: 0,
      risky: 0,
      creditsRemaining: 0,
      errors: [] as string[]
    }

    // Vérifier les crédits ZeroBounce restants
    const credits = await getCredits()
    results.creditsRemaining = credits

    if (credits < 5) {
      return NextResponse.json({
        success: false,
        message: 'Not enough ZeroBounce credits',
        results
      })
    }

    // Limite quotidienne pour économiser les crédits
    const DAILY_LIMIT = Math.min(20, credits)

    // 1. Récupérer les contacts avec email à vérifier
    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('id, email, prenom, nom')
      .eq('email_status', 'a_verifier')
      .not('email', 'is', null)
      .limit(DAILY_LIMIT)

    if (error || !contacts) {
      return NextResponse.json({ 
        error: 'Failed to fetch contacts',
        details: error 
      }, { status: 500 })
    }

    if (contacts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No emails to validate',
        results
      })
    }

    // 2. Valider chaque email
    for (const contact of contacts) {
      if (!contact.email) continue
      
      results.processed++

      try {
        const validation = await validateEmail(contact.email)
        
        if (!validation) {
          results.errors.push(`${contact.email}: Validation failed`)
          continue
        }

        const emailStatus = mapZeroBounceStatus(validation.status)

        // Mettre à jour le statut
        await supabaseAdmin
          .from('contacts')
          .update({
            email_status: emailStatus,
            updated_at: new Date().toISOString()
          })
          .eq('id', contact.id)

        // Si l'email est valide, s'assurer que la prospection est prête
        if (emailStatus === 'valid') {
          results.valid++

          // Vérifier/créer l'entrée de prospection
          const { data: existingProspection } = await supabaseAdmin
            .from('prospection')
            .select('id')
            .eq('contact_id', contact.id)
            .single()

          if (!existingProspection) {
            await supabaseAdmin
              .from('prospection')
              .insert({
                contact_id: contact.id,
                statut: 'a_prospecter',
                sequence_id: '00000000-0000-0000-0000-000000000001',
                sequence_step: 0
              })
          }
        } else if (emailStatus === 'invalid') {
          results.invalid++
        } else {
          results.risky++
        }

        // Rate limiting ZeroBounce
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (err: any) {
        results.errors.push(`${contact.email}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Validation completed',
      results
    })

  } catch (error: any) {
    console.error('Validate CRON error:', error)
    return NextResponse.json(
      { error: error.message || 'Validation failed' },
      { status: 500 }
    )
  }
}
