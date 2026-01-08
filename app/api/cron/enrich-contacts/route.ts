import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { findEmail, searchDomain, generateEmailFormats } from '@/lib/hunter'

// =====================================================
// CRON AUTOMATIQUE - ENRICHISSEMENT CONTACTS
// =====================================================
// Ce CRON tourne tous les jours et trouve les emails
// des contacts qui n'en ont pas encore

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
      enriched: 0,
      skipped: 0,
      errors: [] as string[]
    }

    // Limite pour ne pas épuiser les crédits Hunter (25 gratuits/mois)
    const DAILY_LIMIT = 10

    // 1. Récupérer les contacts sans email
    const { data: contacts, error } = await supabaseAdmin
      .from('contacts')
      .select(`
        *,
        etablissements (*)
      `)
      .eq('email_status', 'a_trouver')
      .is('email', null)
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
        message: 'No contacts to enrich',
        results
      })
    }

    // 2. Pour chaque contact, chercher l'email
    for (const contact of contacts) {
      results.processed++

      const etablissement = contact.etablissements
      if (!etablissement) {
        results.skipped++
        continue
      }

      // Extraire le domaine
      let domain = ''
      if (etablissement.site_web) {
        domain = etablissement.site_web
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0]
      } else if (etablissement.email_generique) {
        domain = etablissement.email_generique.split('@')[1]
      }

      // Si pas de domaine, essayer de deviner
      if (!domain) {
        // Générer un domaine probable
        const nomClean = etablissement.nom
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9]/g, '')
        
        // Essayer des formats courants
        const possibleDomains = [
          `${nomClean}.fr`,
          `ehpad-${nomClean}.fr`,
          `${nomClean}-ehpad.fr`,
        ]
        
        // Pour l'instant, on skip si pas de domaine
        results.skipped++
        results.errors.push(`${etablissement.nom}: No domain found`)
        continue
      }

      try {
        // Méthode 1: Rechercher par domaine d'abord
        const domainSearch = await searchDomain(domain, { type: 'personal', limit: 5 })
        
        let foundEmail = ''
        let foundName = { firstName: '', lastName: '' }

        if (domainSearch && domainSearch.emails && domainSearch.emails.length > 0) {
          // Chercher le directeur ou cadre
          const directorEmail = domainSearch.emails.find(e => 
            e.position?.toLowerCase().includes('directeur') ||
            e.position?.toLowerCase().includes('directrice') ||
            e.position?.toLowerCase().includes('direction')
          )

          if (directorEmail) {
            foundEmail = directorEmail.value
            foundName.firstName = directorEmail.first_name
            foundName.lastName = directorEmail.last_name
          } else {
            // Prendre le premier email trouvé
            foundEmail = domainSearch.emails[0].value
            foundName.firstName = domainSearch.emails[0].first_name
            foundName.lastName = domainSearch.emails[0].last_name
          }
        }

        // Méthode 2: Si on a un nom de contact, chercher spécifiquement
        if (!foundEmail && contact.prenom && contact.nom) {
          const emailFinder = await findEmail({
            domain,
            firstName: contact.prenom,
            lastName: contact.nom,
            company: etablissement.nom
          })

          if (emailFinder && emailFinder.email) {
            foundEmail = emailFinder.email
          }
        }

        // Méthode 3: Générer des formats probables
        if (!foundEmail) {
          // On génère mais on les marque "a_verifier"
          const formats = generateEmailFormats(
            contact.prenom || 'contact',
            contact.nom || 'direction',
            domain
          )
          
          // Prendre le format le plus commun (prenom.nom@)
          foundEmail = formats[0]
        }

        if (foundEmail) {
          // Mettre à jour le contact
          await supabaseAdmin
            .from('contacts')
            .update({
              email: foundEmail,
              email_status: 'a_verifier', // Sera validé par ZeroBounce ensuite
              prenom: foundName.firstName || contact.prenom,
              nom: foundName.lastName || contact.nom,
              source: 'hunter',
              updated_at: new Date().toISOString()
            })
            .eq('id', contact.id)

          results.enriched++
        } else {
          results.skipped++
        }

        // Rate limiting Hunter (1 requête par seconde max)
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (err: any) {
        results.errors.push(`${etablissement.nom}: ${err.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Enrichment completed',
      results
    })

  } catch (error: any) {
    console.error('Enrich CRON error:', error)
    return NextResponse.json(
      { error: error.message || 'Enrichment failed' },
      { status: 500 }
    )
  }
}
