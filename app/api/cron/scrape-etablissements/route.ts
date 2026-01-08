import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import finessData from '@/data/etablissements-finess.json'

// =====================================================
// IMPORT FINESS PAR LOTS (100 par exécution)
// =====================================================
// Vercel limite à 60s, donc on fait des petits lots

const BATCH_SIZE = 100  // Établissements par exécution

export async function GET(request: NextRequest) {
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

    // Récupérer les noms existants (plus rapide que FINESS)
    const { data: existingEtabs } = await supabaseAdmin
      .from('etablissements')
      .select('nom')
    
    const existingNames = new Set(
      existingEtabs?.map(e => e.nom?.toLowerCase().trim()).filter(Boolean) || []
    )

    console.log(`Existing: ${existingNames.size} establishments`)

    // Filtrer les établissements à insérer
    const toInsert = finessData.etablissements.filter(etab => {
      const nomLower = etab.nom?.toLowerCase().trim()
      return nomLower && !existingNames.has(nomLower)
    })

    console.log(`To insert: ${toInsert.length} new establishments`)

    if (toInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All establishments already imported!',
        results: { ...results, alreadyExists: finessData.etablissements.length }
      })
    }

    // Prendre seulement BATCH_SIZE établissements
    const batch = toInsert.slice(0, BATCH_SIZE)
    console.log(`Processing batch of ${batch.length} establishments`)

    // Préparer les données pour insertion en masse
    const etablissementsToInsert = batch.map(etab => ({
      nom: etab.nom?.substring(0, 255) || '',
      type: etab.type || 'ESMS',
      ville: etab.ville?.substring(0, 100) || '',
      code_postal: etab.code_postal?.substring(0, 10) || '',
      departement: etab.departement?.substring(0, 50) || '',
      region: 'Hauts-de-France',
      telephone: etab.telephone?.substring(0, 20) || '',
      site_web: '',
    }))

    // Insertion en masse des établissements
    const { data: insertedEtabs, error: bulkError } = await supabaseAdmin
      .from('etablissements')
      .insert(etablissementsToInsert)
      .select('id')

    if (bulkError) {
      console.error('Bulk insert error:', bulkError.message)
      results.errors.push(bulkError.message)
      
      // Fallback : insertion un par un
      for (const etabData of etablissementsToInsert) {
        const { data: newEtab, error } = await supabaseAdmin
          .from('etablissements')
          .insert(etabData)
          .select('id')
          .single()
        
        if (!error && newEtab) {
          results.newEstablishments++
          
          // Créer contact
          await supabaseAdmin.from('contacts').insert({
            etablissement_id: newEtab.id,
            poste: 'Directeur',
            email_status: 'a_trouver',
            source: 'finess_import',
          })
          results.newContacts++
        }
      }
    } else if (insertedEtabs) {
      results.newEstablishments = insertedEtabs.length
      
      // Créer les contacts en masse
      const contactsToInsert = insertedEtabs.map(etab => ({
        etablissement_id: etab.id,
        poste: 'Directeur',
        email_status: 'a_trouver',
        source: 'finess_import',
      }))

      const { data: insertedContacts } = await supabaseAdmin
        .from('contacts')
        .insert(contactsToInsert)
        .select('id')

      if (insertedContacts) {
        results.newContacts = insertedContacts.length

        // Créer prospection en masse
        const prospectionToInsert = insertedContacts.map(contact => ({
          contact_id: contact.id,
          statut: 'a_prospecter',
        }))

        await supabaseAdmin.from('prospection').insert(prospectionToInsert)
      }
    }

    const remaining = toInsert.length - batch.length
    
    return NextResponse.json({
      success: true,
      message: remaining > 0 
        ? `Batch complete! ${remaining} remaining - run again to continue`
        : 'All establishments imported!',
      results,
      remaining
    })

  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
