import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

const HUNTER_API_KEY = process.env.HUNTER_API_KEY
const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY

// Postes à rechercher par type d'établissement
const POSTES_PAR_TYPE: Record<string, string[]> = {
  EHPAD: ['Directeur', 'IDEC', 'Médecin coordonnateur', 'Cadre de santé', 'Responsable RH'],
  IME: ['Directeur', 'Chef de service éducatif', 'Psychologue', 'Médecin'],
  ESAT: ['Directeur', 'Moniteur principal', 'Chef de production', 'Responsable RH'],
  FAM: ['Directeur', 'Chef de service', 'Cadre de santé', 'Psychologue'],
  MAS: ['Directeur', 'IDEC', 'Médecin coordonnateur', 'Cadre de santé'],
  SESSAD: ['Directeur', 'Chef de service', 'Coordinateur'],
  SAMSAH: ['Directeur', 'Chef de service', 'Coordinateur'],
  SAVS: ['Directeur', 'Chef de service'],
  ITEP: ['Directeur', 'Chef de service éducatif', 'Psychologue'],
  DEFAULT: ['Directeur', 'Responsable', 'Adjoint de direction']
}

// Rechercher le domaine email d'un établissement via Hunter
async function findDomain(etablissementNom: string, ville: string): Promise<string | null> {
  if (!HUNTER_API_KEY) return null
  
  try {
    // Essayer de trouver le site web via recherche
    const searchQuery = encodeURIComponent(`${etablissementNom} ${ville}`)
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?company=${searchQuery}&api_key=${HUNTER_API_KEY}`
    )
    const data = await response.json()
    
    if (data.data?.domain) {
      return data.data.domain
    }
    return null
  } catch (err) {
    console.error('Hunter domain search error:', err)
    return null
  }
}

// Rechercher des emails via Hunter Domain Search
async function searchEmails(domain: string): Promise<any[]> {
  if (!HUNTER_API_KEY || !domain) return []
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}&limit=10`
    )
    const data = await response.json()
    
    if (data.data?.emails) {
      return data.data.emails
    }
    return []
  } catch (err) {
    console.error('Hunter search error:', err)
    return []
  }
}

// Générer des patterns d'email possibles
function generateEmailPatterns(prenom: string, nom: string, domain: string): string[] {
  const p = prenom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const n = nom.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  return [
    `${p}.${n}@${domain}`,
    `${p}${n}@${domain}`,
    `${p[0]}.${n}@${domain}`,
    `${p[0]}${n}@${domain}`,
    `${n}.${p}@${domain}`,
    `${n}@${domain}`,
    `contact@${domain}`,
    `direction@${domain}`,
  ]
}

// Vérifier un email via Hunter Email Verifier
async function verifyEmailHunter(email: string): Promise<{ valid: boolean; score: number }> {
  if (!HUNTER_API_KEY) return { valid: false, score: 0 }
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-verifier?email=${email}&api_key=${HUNTER_API_KEY}`
    )
    const data = await response.json()
    
    return {
      valid: data.data?.result === 'deliverable',
      score: data.data?.score || 0
    }
  } catch (err) {
    return { valid: false, score: 0 }
  }
}

// Vérifier un email via ZeroBounce
async function verifyEmailZeroBounce(email: string): Promise<{ valid: boolean; status: string }> {
  if (!ZEROBOUNCE_API_KEY) return { valid: false, status: 'unknown' }
  
  try {
    const response = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${ZEROBOUNCE_API_KEY}&email=${email}`
    )
    const data = await response.json()
    
    return {
      valid: data.status === 'valid',
      status: data.status
    }
  } catch (err) {
    return { valid: false, status: 'error' }
  }
}

// Trouver un email via Hunter Email Finder
async function findEmail(domain: string, firstName: string, lastName: string): Promise<string | null> {
  if (!HUNTER_API_KEY || !domain) return null
  
  try {
    const response = await fetch(
      `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${HUNTER_API_KEY}`
    )
    const data = await response.json()
    
    if (data.data?.email) {
      return data.data.email
    }
    return null
  } catch (err) {
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, etablissement_id, contact_id, email } = await request.json()

    switch (action) {
      case 'find_domain': {
        // Trouver le domaine d'un établissement
        const { data: etab } = await supabase
          .from('etablissements')
          .select('*')
          .eq('id', etablissement_id)
          .single()

        if (!etab) return NextResponse.json({ error: 'Établissement non trouvé' }, { status: 404 })

        const domain = await findDomain(etab.nom, etab.ville)
        
        if (domain) {
          await supabase
            .from('etablissements')
            .update({ site_web: `https://${domain}` })
            .eq('id', etablissement_id)
        }

        return NextResponse.json({ domain })
      }

      case 'search_contacts': {
        // Rechercher les contacts d'un établissement via son domaine
        const { data: etab } = await supabase
          .from('etablissements')
          .select('*')
          .eq('id', etablissement_id)
          .single()

        if (!etab) return NextResponse.json({ error: 'Établissement non trouvé' }, { status: 404 })

        let domain = etab.site_web?.replace('https://', '').replace('http://', '').replace('www.', '')
        
        if (!domain) {
          domain = await findDomain(etab.nom, etab.ville)
          if (domain) {
            await supabase.from('etablissements').update({ site_web: `https://${domain}` }).eq('id', etablissement_id)
          }
        }

        if (!domain) {
          return NextResponse.json({ error: 'Domaine non trouvé', contacts: [] })
        }

        const emails = await searchEmails(domain)
        const postes = POSTES_PAR_TYPE[etab.type] || POSTES_PAR_TYPE.DEFAULT
        const createdContacts = []

        for (const emailData of emails) {
          // Vérifier si le contact existe déjà
          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .eq('etablissement_id', etablissement_id)
            .eq('email', emailData.value)
            .single()

          if (!existing) {
            // Déterminer le poste basé sur le type ou position
            let poste = 'Contact'
            if (emailData.position) {
              poste = emailData.position
            } else if (emailData.department) {
              poste = emailData.department
            }

            const { data: newContact } = await supabase
              .from('contacts')
              .insert({
                etablissement_id,
                prenom: emailData.first_name || '',
                nom: emailData.last_name || '',
                email: emailData.value,
                email_status: emailData.confidence > 80 ? 'trouve' : 'a_verifier',
                poste,
                source: 'hunter',
              })
              .select()
              .single()

            if (newContact) createdContacts.push(newContact)
          }
        }

        // Si pas assez de contacts trouvés, créer des contacts génériques pour chaque poste
        if (createdContacts.length < 3) {
          for (const poste of postes.slice(0, 3)) {
            const { data: existingPoste } = await supabase
              .from('contacts')
              .select('id')
              .eq('etablissement_id', etablissement_id)
              .eq('poste', poste)
              .single()

            if (!existingPoste) {
              const { data: newContact } = await supabase
                .from('contacts')
                .insert({
                  etablissement_id,
                  poste,
                  email_status: 'a_trouver',
                  source: 'auto_generated',
                })
                .select()
                .single()

              if (newContact) createdContacts.push(newContact)
            }
          }
        }

        return NextResponse.json({ 
          domain,
          contacts: createdContacts,
          total_found: emails.length 
        })
      }

      case 'verify_email': {
        // Vérifier un email spécifique
        if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

        // Essayer ZeroBounce d'abord, sinon Hunter
        let result = await verifyEmailZeroBounce(email)
        
        if (result.status === 'unknown' || result.status === 'error') {
          const hunterResult = await verifyEmailHunter(email)
          result = { valid: hunterResult.valid, status: hunterResult.valid ? 'valid' : 'invalid' }
        }

        // Mettre à jour le contact si contact_id fourni
        if (contact_id) {
          await supabase
            .from('contacts')
            .update({ 
              email_status: result.valid ? 'valide' : 'invalide',
            })
            .eq('id', contact_id)
        }

        return NextResponse.json(result)
      }

      case 'bulk_create_contacts': {
        // Créer des contacts pour tous les établissements sans contact
        const { data: etablissements } = await supabase
          .from('etablissements')
          .select('id, nom, type, ville')
          .limit(100)

        let created = 0
        for (const etab of etablissements || []) {
          const { data: existingContacts } = await supabase
            .from('contacts')
            .select('id')
            .eq('etablissement_id', etab.id)

          if (!existingContacts || existingContacts.length === 0) {
            const postes = POSTES_PAR_TYPE[etab.type] || POSTES_PAR_TYPE.DEFAULT
            
            for (const poste of postes.slice(0, 3)) {
              await supabase
                .from('contacts')
                .insert({
                  etablissement_id: etab.id,
                  poste,
                  email_status: 'a_trouver',
                  source: 'auto_generated',
                })
              created++
            }
          }
        }

        return NextResponse.json({ created })
      }

      default:
        return NextResponse.json({ error: 'Action non reconnue' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('Enrich error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// GET pour vérifier le statut des crédits API
export async function GET() {
  const status: any = {
    hunter: { available: !!HUNTER_API_KEY, credits: null },
    zerobounce: { available: !!ZEROBOUNCE_API_KEY, credits: null },
  }

  // Vérifier crédits Hunter
  if (HUNTER_API_KEY) {
    try {
      const response = await fetch(`https://api.hunter.io/v2/account?api_key=${HUNTER_API_KEY}`)
      const data = await response.json()
      status.hunter.credits = data.data?.requests?.searches?.available || 0
    } catch (err) {}
  }

  // Vérifier crédits ZeroBounce
  if (ZEROBOUNCE_API_KEY) {
    try {
      const response = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${ZEROBOUNCE_API_KEY}`)
      const data = await response.json()
      status.zerobounce.credits = data.Credits || 0
    } catch (err) {}
  }

  return NextResponse.json(status)
}
