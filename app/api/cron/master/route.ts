import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { sendEmail } from '@/lib/brevo'

// =====================================================
// CRON MASTER - ORCHESTRATEUR PRINCIPAL
// =====================================================
// Ce CRON tourne tous les matins à 9h et:
// 1. Lance le scraping de nouveaux établissements
// 2. Lance l'enrichissement des contacts
// 3. Lance la validation des emails
// 4. Lance l'envoi des séquences
// 5. Envoie un rapport à Loïc

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
const CRON_SECRET = process.env.CRON_SECRET

export async function GET(request: NextRequest) {
  // Vérifier le secret CRON
  const authHeader = request.headers.get('authorization')
  
  const isDev = process.env.NODE_ENV === 'development'
  if (!isDev && CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  
  const report = {
    date: new Date().toISOString(),
    steps: [] as { name: string; status: string; details: any }[],
    totalNewProspects: 0,
    totalEmailsEnriched: 0,
    totalEmailsValidated: 0,
    totalEmailsSent: 0,
    hotLeads: [] as { name: string; etablissement: string; score: number }[],
    errors: [] as string[]
  }

  try {
    // ========================================
    // ÉTAPE 1: Scraper nouveaux établissements
    // ========================================
    console.log('🔍 Step 1: Scraping établissements...')
    try {
      const scrapeResponse = await fetch(`${APP_URL}/api/cron/scrape-etablissements`, {
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
      })
      const scrapeResult = await scrapeResponse.json()
      
      report.steps.push({
        name: 'Scraping établissements',
        status: scrapeResult.success ? 'success' : 'failed',
        details: scrapeResult.results || scrapeResult.error
      })
      
      if (scrapeResult.results) {
        report.totalNewProspects = scrapeResult.results.newEstablishments || 0
      }
    } catch (err: any) {
      report.steps.push({ name: 'Scraping', status: 'error', details: err.message })
      report.errors.push(`Scraping: ${err.message}`)
    }

    // Pause entre les étapes
    await new Promise(r => setTimeout(r, 2000))

    // ========================================
    // ÉTAPE 2: Enrichir les contacts (Hunter)
    // ========================================
    console.log('📧 Step 2: Enriching contacts...')
    try {
      const enrichResponse = await fetch(`${APP_URL}/api/cron/enrich-contacts`, {
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
      })
      const enrichResult = await enrichResponse.json()
      
      report.steps.push({
        name: 'Enrichissement emails',
        status: enrichResult.success ? 'success' : 'failed',
        details: enrichResult.results || enrichResult.error
      })
      
      if (enrichResult.results) {
        report.totalEmailsEnriched = enrichResult.results.enriched || 0
      }
    } catch (err: any) {
      report.steps.push({ name: 'Enrichissement', status: 'error', details: err.message })
      report.errors.push(`Enrichissement: ${err.message}`)
    }

    await new Promise(r => setTimeout(r, 2000))

    // ========================================
    // ÉTAPE 3: Valider les emails (ZeroBounce)
    // ========================================
    console.log('✅ Step 3: Validating emails...')
    try {
      const validateResponse = await fetch(`${APP_URL}/api/cron/validate-emails`, {
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
      })
      const validateResult = await validateResponse.json()
      
      report.steps.push({
        name: 'Validation emails',
        status: validateResult.success ? 'success' : 'failed',
        details: validateResult.results || validateResult.error
      })
      
      if (validateResult.results) {
        report.totalEmailsValidated = validateResult.results.valid || 0
      }
    } catch (err: any) {
      report.steps.push({ name: 'Validation', status: 'error', details: err.message })
      report.errors.push(`Validation: ${err.message}`)
    }

    await new Promise(r => setTimeout(r, 2000))

    // ========================================
    // ÉTAPE 4: Envoyer les séquences
    // ========================================
    console.log('📤 Step 4: Sending sequences...')
    try {
      const sendResponse = await fetch(`${APP_URL}/api/cron/send-sequences`, {
        headers: { 'Authorization': `Bearer ${CRON_SECRET}` }
      })
      const sendResult = await sendResponse.json()
      
      report.steps.push({
        name: 'Envoi séquences',
        status: sendResult.success ? 'success' : 'failed',
        details: sendResult.results || sendResult.error
      })
      
      if (sendResult.results) {
        report.totalEmailsSent = sendResult.results.sent || 0
      }
    } catch (err: any) {
      report.steps.push({ name: 'Envoi', status: 'error', details: err.message })
      report.errors.push(`Envoi: ${err.message}`)
    }

    // ========================================
    // ÉTAPE 5: Identifier les Hot Leads
    // ========================================
    console.log('🔥 Step 5: Finding hot leads...')
    try {
      const { data: hotLeads } = await supabaseAdmin
        .from('prospection')
        .select(`
          nb_ouvertures,
          nb_clics,
          contacts (prenom, nom, etablissements (nom))
        `)
        .or('nb_ouvertures.gte.3,nb_clics.gte.1')
        .eq('a_repondu', false)
        .limit(10)

      if (hotLeads) {
        report.hotLeads = hotLeads.map((lead: any) => ({
          name: `${lead.contacts?.prenom || ''} ${lead.contacts?.nom || ''}`.trim() || 'Inconnu',
          etablissement: lead.contacts?.etablissements?.nom || 'Inconnu',
          score: (lead.nb_ouvertures * 10) + (lead.nb_clics * 25)
        }))
      }
    } catch (err: any) {
      report.errors.push(`Hot leads: ${err.message}`)
    }

    // ========================================
    // ÉTAPE 6: Envoyer le rapport par email
    // ========================================
    console.log('📊 Step 6: Sending report...')
    const duration = Math.round((Date.now() - startTime) / 1000)
    
    await sendDailyReport(report, duration)

    return NextResponse.json({
      success: true,
      message: 'Daily automation completed',
      duration: `${duration}s`,
      report
    })

  } catch (error: any) {
    console.error('Master CRON error:', error)
    
    // Envoyer une alerte d'erreur
    await sendErrorAlert(error.message)
    
    return NextResponse.json(
      { error: error.message || 'Automation failed' },
      { status: 500 }
    )
  }
}

// Envoyer le rapport quotidien
async function sendDailyReport(report: any, duration: number) {
  const hotLeadsHtml = report.hotLeads.length > 0
    ? report.hotLeads.map((lead: any) => 
        `<li>🔥 <strong>${lead.name}</strong> - ${lead.etablissement} (score: ${lead.score})</li>`
      ).join('')
    : '<li>Aucun hot lead aujourd\'hui</li>'

  const stepsHtml = report.steps.map((step: any) => 
    `<tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${step.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">
        ${step.status === 'success' ? '✅' : step.status === 'failed' ? '❌' : '⚠️'} ${step.status}
      </td>
    </tr>`
  ).join('')

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #7c3aed;">📊 Rapport SoignantVoice</h1>
      <p style="color: #666;">Rapport automatique du ${new Date().toLocaleDateString('fr-FR')}</p>
      
      <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h2 style="margin-top: 0;">📈 Résumé</h2>
        <table style="width: 100%;">
          <tr><td>Nouveaux établissements</td><td><strong>${report.totalNewProspects}</strong></td></tr>
          <tr><td>Emails enrichis</td><td><strong>${report.totalEmailsEnriched}</strong></td></tr>
          <tr><td>Emails validés</td><td><strong>${report.totalEmailsValidated}</strong></td></tr>
          <tr><td>Emails envoyés</td><td><strong>${report.totalEmailsSent}</strong></td></tr>
          <tr><td>Durée totale</td><td><strong>${duration}s</strong></td></tr>
        </table>
      </div>

      <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 20px 0;">
        <h2 style="margin-top: 0;">🔥 Hot Leads à contacter</h2>
        <ul>${hotLeadsHtml}</ul>
      </div>

      <div style="margin: 20px 0;">
        <h2>⚙️ Détail des étapes</h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${stepsHtml}
        </table>
      </div>

      ${report.errors.length > 0 ? `
        <div style="background: #fee2e2; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h2 style="margin-top: 0; color: #dc2626;">⚠️ Erreurs</h2>
          <ul>${report.errors.map((e: string) => `<li>${e}</li>`).join('')}</ul>
        </div>
      ` : ''}

      <p style="color: #666; font-size: 12px; margin-top: 30px;">
        <a href="${APP_URL}">Ouvrir le dashboard</a>
      </p>
    </div>
  `

  try {
    await sendEmail({
      to: [{ email: process.env.BREVO_SENDER_EMAIL || 'loic@soignantvoice.fr', name: 'Loïc' }],
      subject: `📊 SoignantVoice - ${report.totalEmailsSent} emails envoyés | ${report.hotLeads.length} hot leads`,
      htmlContent: html
    })
  } catch (err) {
    console.error('Failed to send daily report:', err)
  }
}

// Envoyer une alerte en cas d'erreur
async function sendErrorAlert(errorMessage: string) {
  try {
    await sendEmail({
      to: [{ email: process.env.BREVO_SENDER_EMAIL || 'loic@soignantvoice.fr', name: 'Loïc' }],
      subject: '🚨 ERREUR SoignantVoice - Action requise',
      htmlContent: `
        <div style="font-family: Arial, sans-serif;">
          <h1 style="color: #dc2626;">🚨 Erreur dans l'automatisation</h1>
          <p>Une erreur est survenue dans le CRON quotidien:</p>
          <pre style="background: #f3f4f6; padding: 15px; border-radius: 8px;">${errorMessage}</pre>
          <p><a href="${APP_URL}">Vérifier le dashboard</a></p>
        </div>
      `
    })
  } catch (err) {
    console.error('Failed to send error alert:', err)
  }
}
