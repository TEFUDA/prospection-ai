import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY
const HUNTER_API_KEY = process.env.HUNTER_API_KEY

// Limite quotidienne pour économiser les crédits
const MAX_VALIDATIONS_PER_RUN = 25

// Vérifier un email via ZeroBounce
async function verifyEmailZeroBounce(email: string): Promise<{ valid: boolean; status: string; sub_status?: string }> {
  if (!ZEROBOUNCE_API_KEY) return { valid: false, status: 'no_api' }
  
  try {
    const response = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${ZEROBOUNCE_API_KEY}&email=${encodeURIComponent(email)}`
    )
    const data = await response.json()
    
    return {
      valid: data.status === 'valid',
      status: data.status,
      sub_status: data.sub_status,
    }
  } catch (err) {
    return { valid: false, status: 'error' }
  }
}

// Vérifier un email via Hunter (fallback)
async function verifyEmailHunter(email: string): Promise<{ valid: boolean; score: number }> {
  if (!HUNTER_API_KEY) return { valid: false, score: 0 }
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${HUNTER_API_KEY}`
    )
    const data = await response.json()
    
    return {
      valid: data.data?.result === 'deliverable',
      score: data.data?.score || 0,
    }
  } catch (err) {
    return { valid: false, score: 0 }
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    checked: 0,
    valid: 0,
    invalid: 0,
    errors: 0,
    details: [] as any[],
  }

  try {
    // Récupérer les contacts avec email "trouvé" à valider
    const { data: contactsToValidate } = await supabase
      .from('contacts')
      .select('id, email, email_status')
      .eq('email_status', 'trouve')
      .not('email', 'is', null)
      .limit(MAX_VALIDATIONS_PER_RUN)

    if (!contactsToValidate || contactsToValidate.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Aucun email à valider',
        ...results,
      })
    }

    for (const contact of contactsToValidate) {
      results.checked++

      // Essayer ZeroBounce d'abord
      let result = await verifyEmailZeroBounce(contact.email)
      
      // Si ZeroBounce échoue, essayer Hunter
      if (result.status === 'no_api' || result.status === 'error') {
        const hunterResult = await verifyEmailHunter(contact.email)
        result = {
          valid: hunterResult.valid || hunterResult.score >= 80,
          status: hunterResult.valid ? 'valid' : 'invalid',
        }
      }

      // Mettre à jour le contact
      const newStatus = result.valid ? 'valide' : 'invalide'
      
      const { error } = await supabase
        .from('contacts')
        .update({
          email_status: newStatus,
          email_validated_at: new Date().toISOString(),
          email_validation_result: result.status,
        })
        .eq('id', contact.id)

      if (error) {
        results.errors++
      } else {
        if (result.valid) {
          results.valid++
        } else {
          results.invalid++
        }
        results.details.push({
          contact_id: contact.id,
          email: contact.email,
          result: newStatus,
          api_status: result.status,
        })
      }

      // Pause pour éviter le rate limiting (ZeroBounce limite à 10 req/sec)
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Vérifier les crédits restants ZeroBounce
    let creditsRemaining = null
    if (ZEROBOUNCE_API_KEY) {
      try {
        const creditsResponse = await fetch(
          `https://api.zerobounce.net/v2/getcredits?api_key=${ZEROBOUNCE_API_KEY}`
        )
        const creditsData = await creditsResponse.json()
        creditsRemaining = creditsData.Credits
      } catch (err) {}
    }

    return NextResponse.json({
      success: true,
      ...results,
      credits_remaining: creditsRemaining,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message, ...results }, { status: 500 })
  }
}
