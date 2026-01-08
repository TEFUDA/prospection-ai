import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findEmail, verifyEmail as hunterVerify, searchDomain } from '@/lib/hunter'
import { validateEmail, mapZeroBounceStatus } from '@/lib/zerobounce'

// Enrichir un contact (trouver son email)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactId, firstName, lastName, domain, company } = body

    if (!domain || (!firstName && !lastName)) {
      return NextResponse.json(
        { error: 'Missing required fields: domain and (firstName or lastName)' },
        { status: 400 }
      )
    }

    // 1. Chercher l'email avec Hunter
    const hunterResult = await findEmail({
      domain,
      firstName,
      lastName,
      company,
    })

    if (!hunterResult || !hunterResult.email) {
      return NextResponse.json({
        success: false,
        message: 'Email not found',
        hunterResult: null,
      })
    }

    // 2. Valider l'email avec ZeroBounce
    const zbResult = await validateEmail(hunterResult.email)
    const emailStatus = zbResult ? mapZeroBounceStatus(zbResult.status) : 'a_verifier'

    // 3. Si on a un contactId, mettre à jour dans la base
    if (contactId) {
      await supabaseAdmin
        .from('contacts')
        .update({
          email: hunterResult.email,
          email_status: emailStatus,
          linkedin_url: hunterResult.linkedin_url,
          source: 'hunter',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId)
    }

    return NextResponse.json({
      success: true,
      email: hunterResult.email,
      emailStatus,
      score: hunterResult.score,
      linkedin: hunterResult.linkedin_url,
      phone: hunterResult.phone_number,
      validation: zbResult ? {
        status: zbResult.status,
        subStatus: zbResult.sub_status,
        freeEmail: zbResult.free_email,
      } : null,
    })

  } catch (error: any) {
    console.error('Enrich contact error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enrich contact' },
      { status: 500 }
    )
  }
}

// Enrichir plusieurs contacts en batch
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactIds } = body

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400 }
      )
    }

    // Récupérer les contacts
    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('*, etablissements(*)')
      .in('id', contactIds)
      .eq('email_status', 'a_trouver')

    if (error || !contacts) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    const results = {
      processed: 0,
      found: 0,
      validated: 0,
      errors: [] as string[],
    }

    for (const contact of contacts) {
      results.processed++

      // Extraire le domaine du site web ou de l'email générique
      let domain = ''
      if (contact.etablissements?.site_web) {
        domain = contact.etablissements.site_web
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0]
      } else if (contact.etablissements?.email_generique) {
        domain = contact.etablissements.email_generique.split('@')[1]
      }

      if (!domain) {
        results.errors.push(`${contact.prenom} ${contact.nom}: No domain found`)
        continue
      }

      try {
        // Chercher l'email
        const hunterResult = await findEmail({
          domain,
          firstName: contact.prenom,
          lastName: contact.nom,
          company: contact.etablissements?.nom,
        })

        if (hunterResult?.email) {
          results.found++

          // Valider l'email
          const zbResult = await validateEmail(hunterResult.email)
          const emailStatus = zbResult ? mapZeroBounceStatus(zbResult.status) : 'a_verifier'

          if (emailStatus === 'valid') {
            results.validated++
          }

          // Mettre à jour le contact
          await supabaseAdmin
            .from('contacts')
            .update({
              email: hunterResult.email,
              email_status: emailStatus,
              linkedin_url: hunterResult.linkedin_url || contact.linkedin_url,
              source: 'hunter',
              updated_at: new Date().toISOString(),
            })
            .eq('id', contact.id)
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))

      } catch (err: any) {
        results.errors.push(`${contact.prenom} ${contact.nom}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })

  } catch (error: any) {
    console.error('Batch enrich error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to enrich contacts' },
      { status: 500 }
    )
  }
}

// Valider des emails existants
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const { contactIds } = body

    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json(
        { error: 'No contacts provided' },
        { status: 400 }
      )
    }

    // Récupérer les contacts avec email à vérifier
    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select('id, email')
      .in('id', contactIds)
      .in('email_status', ['a_verifier', 'a_trouver'])
      .not('email', 'is', null)

    if (error || !contacts) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      )
    }

    const results = {
      processed: 0,
      valid: 0,
      invalid: 0,
      errors: [] as string[],
    }

    for (const contact of contacts) {
      if (!contact.email) continue
      
      results.processed++

      try {
        const zbResult = await validateEmail(contact.email)
        
        if (zbResult) {
          const emailStatus = mapZeroBounceStatus(zbResult.status)
          
          if (emailStatus === 'valid') results.valid++
          if (emailStatus === 'invalid') results.invalid++

          await supabaseAdmin
            .from('contacts')
            .update({
              email_status: emailStatus,
              updated_at: new Date().toISOString(),
            })
            .eq('id', contact.id)
        }

        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300))

      } catch (err: any) {
        results.errors.push(`${contact.email}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      results,
    })

  } catch (error: any) {
    console.error('Validate emails error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to validate emails' },
      { status: 500 }
    )
  }
}
