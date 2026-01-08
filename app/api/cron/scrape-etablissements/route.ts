import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import finessData from '@/data/etablissements-finess.json'

// =====================================================
// SCRAPER AUTOMATIQUE - BASE FINESS (1495 établissements)
// =====================================================
// Source : Fichier JSON local basé sur data.gouv.fr FINESS
// Région : Hauts-de-France (02, 59, 60, 62, 80)

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
      total: finessData.etablissements.length,
      alreadyExists: 0,
      newEstablishments: 0,
      newContacts: 0,
      errors: [] as string[]
    }

    // Récupérer les établissements déjà en base (par numéro FINESS)
    const { data: existingEtabs } = await supabaseAdmin
      .from('etablissements')
      .select('finess, nom')
    
    const existingFiness = new Set(
      existingEtabs?.map(e => e.finess).filter(Boolean) || []
    )
    const existingNames = new Set(
      existingEtabs?.map(e => e.nom?.toLowerCase()).filter(Boolean) || []
    )

    console.log(`Existing: ${existingFiness.size} by FINESS, ${existingNames.size} by name`)
    console.log(`To process: ${finessData.etablissements.length} establishments`)

    // Traiter chaque établissement
    for (const etab of finessData.etablissements) {
      try {
        // Skip si déjà en base (par FINESS ou par nom)
        if (existingFiness.has(etab.finess) || existingNames.has(etab.nom?.toLowerCase())) {
          results.alreadyExists++
          continue
        }

        // Insérer l'établissement
        const { data: newEtab, error: etabError } = await supabaseAdmin
          .from('etablissements')
          .insert({
            finess: etab.finess,
            nom: etab.nom?.substring(0, 255) || '',
            type: etab.type || 'ESMS',
            ville: etab.ville?.substring(0, 100) || '',
            code_postal: etab.code_postal?.substring(0, 10) || '',
            departement: etab.departement?.substring(0, 50) || '',
            region: 'Hauts-de-France',
            telephone: etab.telephone?.substring(0, 20) || '',
            site_web: '',
          })
          .select()
          .single()

        if (etabError) {
          // Si erreur de colonne FINESS manquante, on réessaye sans
          if (etabError.message.includes('finess')) {
            const { data: newEtab2, error: etabError2 } = await supabaseAdmin
              .from('etablissements')
              .insert({
                nom: etab.nom?.substring(0, 255) || '',
                type: etab.type || 'ESMS',
                ville: etab.ville?.substring(0, 100) || '',
                code_postal: etab.code_postal?.substring(0, 10) || '',
                departement: etab.departement?.substring(0, 50) || '',
                region: 'Hauts-de-France',
                telephone: etab.telephone?.substring(0, 20) || '',
                site_web: '',
              })
              .select()
              .single()
            
            if (etabError2) {
              results.errors.push(`Insert ${etab.nom}: ${etabError2.message}`)
              continue
            }
            
            results.newEstablishments++
            existingNames.add(etab.nom?.toLowerCase())
            
            // Créer contact
            if (newEtab2) {
              await createContact(newEtab2.id, results)
            }
            continue
          }
          
          results.errors.push(`Insert ${etab.nom}: ${etabError.message}`)
          continue
        }

        results.newEstablishments++
        existingFiness.add(etab.finess)
        existingNames.add(etab.nom?.toLowerCase())

        // Créer un contact "Directeur" par défaut
        if (newEtab) {
          await createContact(newEtab.id, results)
        }

      } catch (err: any) {
        results.errors.push(`Process ${etab.nom}: ${err.message}`)
      }
    }

    console.log(`Completed: ${results.newEstablishments} new, ${results.alreadyExists} existing`)

    return NextResponse.json({
      success: true,
      message: 'Import FINESS completed',
      results: {
        ...results,
        errors: results.errors.slice(0, 10) // Limiter les erreurs affichées
      }
    })

  } catch (error: any) {
    console.error('Scraper error:', error)
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    )
  }
}

async function createContact(etablissementId: string, results: any) {
  const { data: newContact, error: contactError } = await supabaseAdmin
    .from('contacts')
    .insert({
      etablissement_id: etablissementId,
      poste: 'Directeur',
      email_status: 'a_trouver',
      source: 'finess_import',
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
      })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
