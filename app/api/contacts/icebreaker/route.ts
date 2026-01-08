import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const SERPER_API_KEY = process.env.SERPER_API_KEY

interface ContactInfo {
  id: string
  prenom: string | null
  nom: string | null
  poste: string
  email: string | null
  etablissement_nom: string
  etablissement_type: string
  etablissement_ville: string
  site_web: string | null
}

// Rechercher des infos sur Google via Serper API
async function searchGoogle(query: string): Promise<string[]> {
  if (!SERPER_API_KEY) return []
  
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, gl: 'fr', hl: 'fr', num: 5 }),
    })
    
    const data = await response.json()
    const results: string[] = []
    
    if (data.organic) {
      for (const result of data.organic.slice(0, 5)) {
        if (result.snippet) results.push(`${result.title}: ${result.snippet}`)
      }
    }
    if (data.news) {
      for (const news of data.news.slice(0, 3)) {
        results.push(`[ACTUALITÉ] ${news.title}: ${news.snippet || ''}`)
      }
    }
    return results
  } catch (err) {
    console.error('Serper search error:', err)
    return []
  }
}

// Générer l'ice breaker avec Claude
async function generateIceBreaker(contactInfo: ContactInfo, searchResults: string[]): Promise<{ icebreaker: string; context: string }> {
  if (!ANTHROPIC_API_KEY) {
    return { icebreaker: '', context: 'API Anthropic non configurée' }
  }

  const prompt = `Tu es un expert en prospection B2B pour SoignantVoice, une solution de transcription vocale pour les soignants en EHPAD et établissements médico-sociaux.

CONTEXTE DU CONTACT:
- Établissement: ${contactInfo.etablissement_nom}
- Type: ${contactInfo.etablissement_type}
- Ville: ${contactInfo.etablissement_ville}
- Poste du contact: ${contactInfo.poste}
- Nom: ${contactInfo.prenom || ''} ${contactInfo.nom || ''}
- Site web: ${contactInfo.site_web || 'Non trouvé'}

INFORMATIONS TROUVÉES SUR INTERNET:
${searchResults.length > 0 ? searchResults.join('\n\n') : 'Aucune information spécifique trouvée.'}

MISSION:
Génère un "ice breaker" personnalisé de 2-3 phrases MAXIMUM pour débuter un email de prospection.

RÈGLES:
1. Mentionne quelque chose de SPÉCIFIQUE à l'établissement ou à la personne (actualité, projet, rénovation, certification, événement, agrandissement, nouveau service...)
2. Montre que tu as fait des recherches (sans être creepy)
3. Fais le lien naturellement avec les problématiques des transmissions soignantes
4. Ton chaleureux et professionnel, comme un vrai humain
5. PAS de formules génériques type "J'espère que vous allez bien"
6. Si pas d'info spécifique trouvée, utilise le contexte local (ville, région) ou le type d'établissement

EXEMPLES DE BONS ICE BREAKERS:
- "J'ai vu que votre EHPAD a obtenu la certification Qualité de vie au travail en 2023 - félicitations ! C'est d'ailleurs en discutant avec des directeurs engagés comme vous sur le bien-être des équipes que nous avons créé SoignantVoice."
- "Suite à l'agrandissement de votre IME annoncé dans La Voix du Nord, vous devez gérer une équipe encore plus grande. Les transmissions quotidiennes doivent représenter un défi logistique !"
- "En tant que directeur d'EHPAD à Lille, vous connaissez sûrement les défis de recrutement dans la région. Nos utilisateurs nous disent que SoignantVoice les aide à fidéliser leurs équipes en réduisant la charge administrative."

Réponds UNIQUEMENT avec le ice breaker, rien d'autre.`

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
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await response.json()
    
    if (data.content && data.content[0]?.text) {
      return {
        icebreaker: data.content[0].text.trim(),
        context: searchResults.slice(0, 3).join(' | ').substring(0, 500),
      }
    }
    return { icebreaker: '', context: 'Erreur génération' }
  } catch (err) {
    console.error('Claude API error:', err)
    return { icebreaker: '', context: 'Erreur API' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, contact_id } = await request.json()

    if (action === 'generate') {
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select(`*, etablissements (*)`)
        .eq('id', contact_id)
        .single()

      if (contactError || !contact) {
        return NextResponse.json({ error: 'Contact non trouvé' }, { status: 404 })
      }

      const etab = contact.etablissements as any
      
      const contactInfo: ContactInfo = {
        id: contact.id, prenom: contact.prenom, nom: contact.nom,
        poste: contact.poste, email: contact.email,
        etablissement_nom: etab.nom, etablissement_type: etab.type,
        etablissement_ville: etab.ville, site_web: etab.site_web,
      }

      // Recherches Google
      const searchQueries = [
        `"${etab.nom}" ${etab.ville}`,
        `${etab.nom} actualité projet`,
      ]
      if (contact.nom) searchQueries.push(`"${contact.prenom || ''} ${contact.nom}" ${etab.nom}`)

      let allResults: string[] = []
      for (const query of searchQueries) {
        const results = await searchGoogle(query)
        allResults = [...allResults, ...results]
      }
      allResults = [...new Set(allResults)]

      const { icebreaker, context } = await generateIceBreaker(contactInfo, allResults)

      await supabase
        .from('contacts')
        .update({
          icebreaker,
          icebreaker_context: context,
          icebreaker_generated_at: new Date().toISOString(),
        })
        .eq('id', contact_id)

      return NextResponse.json({
        success: true, icebreaker, context,
        search_results_count: allResults.length,
      })
    }

    if (action === 'bulk_generate') {
      const { data: contacts } = await supabase
        .from('contacts')
        .select(`id, prenom, nom, poste, email, email_status, icebreaker, etablissements (*)`)
        .eq('email_status', 'valide')
        .is('icebreaker', null)
        .limit(10)

      let generated = 0
      for (const contact of contacts || []) {
        const etab = contact.etablissements as any
        
        const contactInfo: ContactInfo = {
          id: contact.id, prenom: contact.prenom, nom: contact.nom,
          poste: contact.poste, email: contact.email,
          etablissement_nom: etab.nom, etablissement_type: etab.type,
          etablissement_ville: etab.ville, site_web: etab.site_web,
        }

        const results = await searchGoogle(`"${etab.nom}" ${etab.ville}`)
        const { icebreaker, context } = await generateIceBreaker(contactInfo, results)

        if (icebreaker) {
          await supabase.from('contacts').update({
            icebreaker, icebreaker_context: context,
            icebreaker_generated_at: new Date().toISOString(),
          }).eq('id', contact.id)
          generated++
        }
        await new Promise(resolve => setTimeout(resolve, 1000))
      }

      return NextResponse.json({ success: true, generated })
    }

    return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })

  } catch (error: any) {
    console.error('Ice breaker error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  const { count: totalContacts } = await supabase
    .from('contacts').select('*', { count: 'exact', head: true }).eq('email_status', 'valide')
  const { count: withIcebreaker } = await supabase
    .from('contacts').select('*', { count: 'exact', head: true }).eq('email_status', 'valide').not('icebreaker', 'is', null)

  return NextResponse.json({
    total_valid_contacts: totalContacts || 0,
    with_icebreaker: withIcebreaker || 0,
    pending: (totalContacts || 0) - (withIcebreaker || 0),
    apis: { anthropic: !!ANTHROPIC_API_KEY, serper: !!SERPER_API_KEY }
  })
}
