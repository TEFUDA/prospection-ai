import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// =====================================================
// SCRAPER AUTOMATIQUE - BASE FINESS (DATA.GOUV.FR)
// =====================================================
// Source : API officielle data.gouv.fr
// Contient TOUS les établissements médico-sociaux de France

// Types d'établissements qu'on cible
const TYPES_CIBLES = [
  '500', '501', '502', // EHPAD, EHPA
  '183', '186', '188', '189', '190', // IME, ITEP
  '194', '382', // SESSAD
  '238', '246', '249', // ESAT
  '252', '253', // FAM
  '255', // MAS
  '195', '196', // CMPP, CAMSP
  '390', '395', '445', '446', // SAVS, SAMSAH
]

// Mapping codes catégories vers types lisibles
const CATEGORY_LABELS: Record<string, string> = {
  '500': 'EHPAD', '501': 'EHPA', '502': 'EHPAD',
  '183': 'IME', '186': 'ITEP', '188': 'IME', '189': 'IME', '190': 'IME',
  '194': 'SESSAD', '382': 'SESSAD',
  '238': 'ESAT', '246': 'ESAT', '249': 'ESAT',
  '252': 'FAM', '253': 'FAM',
  '255': 'MAS',
  '195': 'CMPP', '196': 'CAMSP',
  '390': 'SAVS', '395': 'SAMSAH', '445': 'SAVS', '446': 'SAMSAH',
}

// Départements Hauts-de-France
const DEPARTEMENTS_HDF = ['02', '59', '60', '62', '80']

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
      fetched: 0,
      filtered: 0,
      newEstablishments: 0,
      newContacts: 0,
      errors: [] as string[]
    }

    // Récupérer les établissements déjà en base (pour éviter les doublons)
    const { data: existingEtabs } = await supabaseAdmin
      .from('etablissements')
      .select('nom, ville')
    
    const existingSet = new Set(
      existingEtabs?.map(e => `${e.nom?.toLowerCase()}-${e.ville?.toLowerCase()}`) || []
    )

    console.log(`Existing establishments: ${existingSet.size}`)

    // Pour chaque département des Hauts-de-France
    for (const dept of DEPARTEMENTS_HDF) {
      try {
        console.log(`Fetching department ${dept}...`)
        
        // Utiliser l'API OpenDataSoft qui héberge FINESS (plus stable)
        const apiUrl = `https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/finess-etablissements-sanitaires-sociaux/records?where=dep_code%3D%22${dept}%22&limit=50`
        
        const response = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/json',
          },
          signal: AbortSignal.timeout(20000) // 20s timeout
        })

        if (!response.ok) {
          console.log(`API response not OK for dept ${dept}: ${response.status}`)
          results.errors.push(`Dept ${dept}: API returned ${response.status}`)
          continue
        }

        const data = await response.json()
        const records = data.results || []
        results.fetched += records.length

        console.log(`Dept ${dept}: fetched ${records.length} records`)

        // Filtrer par type d'établissement cible
        const etablissementsFiltres = records.filter((etab: any) => {
          const catCode = etab.cat || etab.categetab || ''
          return TYPES_CIBLES.includes(catCode.toString())
        })

        results.filtered += etablissementsFiltres.length
        console.log(`Dept ${dept}: ${etablissementsFiltres.length} matching our criteria`)

        // Insérer chaque établissement
        for (const etab of etablissementsFiltres) {
          try {
            const nom = etab.rs || etab.raison_sociale || etab.nom || ''
            const ville = etab.commune || etab.libcommune || ''
            const key = `${nom.toLowerCase()}-${ville.toLowerCase()}`

            // Skip si déjà en base ou nom vide
            if (existingSet.has(key) || !nom) {
              continue
            }

            // Ajouter au set pour éviter les doublons
            existingSet.add(key)

            const catCode = (etab.cat || etab.categetab || '').toString()
            const type = CATEGORY_LABELS[catCode] || 'ESMS'
            const codePostal = etab.cp || etab.codepostal || ''
            const telephone = etab.telephone || ''
            const departement = etab.dep_name || etab.libdepartement || ''

            // Insérer l'établissement
            const { data: newEtab, error: etabError } = await supabaseAdmin
              .from('etablissements')
              .insert({
                nom: nom.substring(0, 255),
                type,
                ville: ville.substring(0, 100),
                code_postal: codePostal.toString().substring(0, 10),
                departement: departement.substring(0, 50),
                region: 'Hauts-de-France',
                telephone: telephone.substring(0, 20),
                site_web: '',
              })
              .select()
              .single()

            if (etabError) {
              results.errors.push(`Insert ${nom}: ${etabError.message}`)
              continue
            }

            results.newEstablishments++

            // Créer un contact "Directeur" par défaut
            const { data: newContact, error: contactError } = await supabaseAdmin
              .from('contacts')
              .insert({
                etablissement_id: newEtab.id,
                poste: 'Directeur',
                email_status: 'a_trouver',
                source: 'finess_scrape',
              })
              .select()
              .single()

            if (!contactError && newContact) {
              results.newContacts++

              // Créer l'entrée de prospection
              await supabaseAdmin
                .from('prospection')
                .insert({
                  contact_id: newContact.id,
                  statut: 'a_prospecter',
                  sequence_id: '00000000-0000-0000-0000-000000000001',
                })
            }

          } catch (err: any) {
            results.errors.push(`Process: ${err.message}`)
          }
        }

      } catch (err: any) {
        console.error(`Error fetching dept ${dept}:`, err.message)
        results.errors.push(`Dept ${dept}: ${err.message}`)
      }

      // Pause entre les départements
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    return NextResponse.json({
      success: true,
      message: 'Scraping completed',
      results
    })

  } catch (error: any) {
    console.error('Scraper error:', error)
    return NextResponse.json(
      { error: error.message || 'Scraping failed' },
      { status: 500 }
    )
  }
}

// POST : Lancer le scraping avec paramètres personnalisés
export async function POST(request: NextRequest) {
  return NextResponse.json({
    success: true,
    message: 'Use GET endpoint for scraping'
  })
}
