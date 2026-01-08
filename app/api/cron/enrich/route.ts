import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const HUNTER_API_KEY = process.env.HUNTER_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const SERPER_API_KEY = process.env.SERPER_API_KEY

// Limites quotidiennes (pour économiser les crédits API)
const MAX_CONTACTS_TO_CREATE = 30  // Contacts à créer par run
const MAX_EMAILS_TO_FIND = 20      // Emails à chercher via Hunter
const MAX_ICEBREAKERS = 15         // Ice breakers à générer

const POSTES_PAR_TYPE: Record<string, string[]> = {
  EHPAD: ['Directeur', 'IDEC', 'Médecin coordonnateur'],
  IME: ['Directeur', 'Chef de service éducatif', 'Psychologue'],
  ESAT: ['Directeur', 'Moniteur principal', 'Responsable RH'],
  FAM: ['Directeur', 'Chef de service', 'Cadre de santé'],
  MAS: ['Directeur', 'IDEC', 'Médecin coordonnateur'],
  DEFAULT: ['Directeur', 'Responsable'],
}

// Rechercher emails via Hunter
async function searchEmailsHunter(domain: string): Promise<any[]> {
  if (!HUNTER_API_KEY || !domain) return []
  try {
    const response = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=5`)
    const data = await response.json()
    return data.data?.emails || []
  } catch (err) {
    return []
  }
}

// Trouver le domaine d'un établissement
async function findDomain(nom: string, ville: string): Promise<string | null> {
  if (!HUNTER_API_KEY) return null
  try {
    const searchQuery = encodeURIComponent(`${nom} ${ville}`)
    const response = await fetch(`https://api.hunter.io/v2/domain-search?company=${searchQuery}&api_key=${HUNTER_API_KEY}`)
    const data = await response.json()
    return data.data?.domain || null
  } catch (err) {
    return null
  }
}

// Recherche Google via Serper
async function searchGoogle(query: string): Promise<string[]> {
  if (!SERPER_API_KEY) return []
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': SERPER_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, gl: 'fr', hl: 'fr', num: 5 }),
    })
    const data = await response.json()
    const results: string[] = []
    if (data.organic) data.organic.slice(0, 5).forEach((r: any) => r.snippet && results.push(`${r.title}: ${r.snippet}`))
    if (data.news) data.news.slice(0, 2).forEach((n: any) => results.push(`[ACTU] ${n.title}`))
    return results
  } catch (err) {
    return []
  }
}

// Générer ice breaker avec Claude
async function generateIceBreaker(contact: any, searchResults: string[]): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null
  const etab = contact.etablissements

  const prompt = `Tu es un expert en prospection B2B pour SoignantVoice (transcription vocale pour soignants).

CONTEXTE:
- Établissement: ${etab?.nom} (${etab?.type})
- Ville: ${etab?.ville}
- Poste: ${contact.poste}

INFOS TROUVÉES:
${searchResults.length > 0 ? searchResults.join('\n') : 'Aucune info spécifique.'}

Génère un ice breaker de 2-3 phrases pour débuter un email de prospection. Mentionne quelque chose de SPÉCIFIQUE à l'établissement. Pas de "J'espère que vous allez bien". Ton professionnel et chaleureux.

Réponds UNIQUEMENT avec l'ice breaker.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 250,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await response.json()
    return data.content?.[0]?.text?.trim() || null
  } catch (err) {
    return null
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    contacts_created: 0,
    emails_found: 0,
    icebreakers_generated: 0,
    errors: 0,
  }

  try {
    // ============================================
    // 1. CRÉER DES CONTACTS POUR LES ÉTABLISSEMENTS SANS CONTACT
    // ============================================
    const { data: etabsSansContact } = await supabase
      .from('etablissements')
      .select('id, nom, type, ville')
      .not('id', 'in', supabase.from('contacts').select('etablissement_id'))
      .limit(MAX_CONTACTS_TO_CREATE)

    // Alternative: chercher les établissements qui n'ont pas de contacts
    const { data: allEtabs } = await supabase.from('etablissements').select('id, nom, type, ville').limit(200)
    const { data: existingContacts } = await supabase.from('contacts').select('etablissement_id')
    const etabsWithContacts = new Set((existingContacts || []).map(c => c.etablissement_id))
    const etabsToProcess = (allEtabs || []).filter(e => !etabsWithContacts.has(e.id)).slice(0, MAX_CONTACTS_TO_CREATE)

    for (const etab of etabsToProcess) {
      const postes = POSTES_PAR_TYPE[etab.type] || POSTES_PAR_TYPE.DEFAULT
      for (const poste of postes.slice(0, 2)) {
        const { error } = await supabase.from('contacts').insert({
          etablissement_id: etab.id,
          poste,
          email_status: 'a_trouver',
          source: 'cron_auto',
        })
        if (!error) results.contacts_created++
      }
    }

    // ============================================
    // 2. TROUVER LES EMAILS (Hunter.io)
    // ============================================
    if (HUNTER_API_KEY) {
      const { data: contactsSansEmail } = await supabase
        .from('contacts')
        .select(`*, etablissements (*)`)
        .eq('email_status', 'a_trouver')
        .limit(MAX_EMAILS_TO_FIND)

      for (const contact of contactsSansEmail || []) {
        const etab = contact.etablissements as any
        if (!etab) continue

        // Trouver le domaine si pas encore fait
        let domain = etab.site_web?.replace('https://', '').replace('http://', '').replace('www.', '')
        if (!domain) {
          domain = await findDomain(etab.nom, etab.ville)
          if (domain) {
            await supabase.from('etablissements').update({ site_web: `https://${domain}` }).eq('id', etab.id)
          }
        }

        if (domain) {
          const emails = await searchEmailsHunter(domain)
          if (emails.length > 0) {
            // Prendre le premier email trouvé
            const emailData = emails[0]
            await supabase.from('contacts').update({
              email: emailData.value,
              prenom: emailData.first_name || null,
              nom: emailData.last_name || null,
              email_status: emailData.confidence > 80 ? 'trouve' : 'a_verifier',
              source: 'hunter',
            }).eq('id', contact.id)
            results.emails_found++
          }
        }

        // Pause pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // ============================================
    // 3. GÉNÉRER LES ICE BREAKERS (Claude + Serper)
    // ============================================
    if (ANTHROPIC_API_KEY && SERPER_API_KEY) {
      const { data: contactsPourIcebreaker } = await supabase
        .from('contacts')
        .select(`*, etablissements (*)`)
        .eq('email_status', 'valide')
        .is('icebreaker', null)
        .limit(MAX_ICEBREAKERS)

      for (const contact of contactsPourIcebreaker || []) {
        const etab = contact.etablissements as any
        if (!etab) continue

        // Recherche Google
        const searchResults = await searchGoogle(`"${etab.nom}" ${etab.ville}`)
        
        // Générer ice breaker
        const icebreaker = await generateIceBreaker(contact, searchResults)
        
        if (icebreaker) {
          await supabase.from('contacts').update({
            icebreaker,
            icebreaker_context: searchResults.slice(0, 2).join(' | ').substring(0, 500),
            icebreaker_generated_at: new Date().toISOString(),
          }).eq('id', contact.id)
          results.icebreakers_generated++
        }

        // Pause
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    })

  } catch (error: any) {
    return NextResponse.json({ error: error.message, ...results }, { status: 500 })
  }
}
