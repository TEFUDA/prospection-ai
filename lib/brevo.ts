// =====================================================
// BREVO API INTEGRATION
// =====================================================

const BREVO_API_KEY = process.env.BREVO_API_KEY!
const BREVO_API_URL = 'https://api.brevo.com/v3'

interface SendEmailParams {
  to: { email: string; name?: string }[]
  subject: string
  htmlContent: string
  textContent?: string
  replyTo?: { email: string; name?: string }
  tags?: string[]
  params?: Record<string, string>
}

interface EmailResponse {
  messageId: string
}

// Envoyer un email transactionnel
export async function sendEmail(params: SendEmailParams): Promise<EmailResponse> {
  const response = await fetch(`${BREVO_API_URL}/smtp/email`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || 'Loïc - SoignantVoice',
        email: process.env.BREVO_SENDER_EMAIL || 'loic@soignantvoice.fr',
      },
      to: params.to,
      subject: params.subject,
      htmlContent: params.htmlContent,
      textContent: params.textContent,
      replyTo: params.replyTo || {
        email: process.env.BREVO_SENDER_EMAIL || 'loic@soignantvoice.fr',
      },
      tags: params.tags || ['soignantvoice', 'prospection'],
      params: params.params,
      headers: {
        'X-Mailin-custom': 'soignantvoice-crm',
      },
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    console.error('Brevo API Error:', error)
    throw new Error(`Brevo API Error: ${error.message || response.statusText}`)
  }

  return response.json()
}

// Remplacer les variables dans le template
export function replaceTemplateVariables(
  template: string,
  variables: Record<string, string>
): string {
  let result = template
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), value || '')
  }
  return result
}

// Envoyer un email de prospection
export async function sendProspectionEmail(params: {
  toEmail: string
  toName: string
  subject: string
  htmlContent: string
  textContent?: string
  etablissement: string
  contactPrenom: string
  contactPoste: string
  typeEtablissement: string
}): Promise<EmailResponse> {
  // Remplacer les variables
  const variables = {
    prenom: params.contactPrenom,
    nom: params.toName,
    etablissement: params.etablissement,
    type: params.typeEtablissement,
    poste: params.contactPoste,
  }

  const subject = replaceTemplateVariables(params.subject, variables)
  const htmlContent = replaceTemplateVariables(params.htmlContent, variables)
  const textContent = params.textContent 
    ? replaceTemplateVariables(params.textContent, variables)
    : undefined

  // Ajouter le pixel de tracking
  const trackingPixel = `<img src="${process.env.NEXT_PUBLIC_APP_URL}/api/track/open?email=${encodeURIComponent(params.toEmail)}" width="1" height="1" style="display:none" />`
  const htmlWithTracking = htmlContent + trackingPixel

  return sendEmail({
    to: [{ email: params.toEmail, name: params.toName }],
    subject,
    htmlContent: htmlWithTracking,
    textContent,
    tags: ['prospection', params.typeEtablissement.toLowerCase()],
  })
}

// Obtenir les statistiques d'un email
export async function getEmailStats(messageId: string) {
  const response = await fetch(`${BREVO_API_URL}/smtp/statistics/events?messageId=${messageId}`, {
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get email stats')
  }

  return response.json()
}

// Valider une adresse email via Brevo
export async function validateEmail(email: string): Promise<{
  valid: boolean
  disposable: boolean
  role: boolean
}> {
  const response = await fetch(`${BREVO_API_URL}/smtp/email/validate`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    // Si l'API de validation n'est pas dispo, on considère l'email valide
    return { valid: true, disposable: false, role: false }
  }

  const data = await response.json()
  return {
    valid: data.valid || false,
    disposable: data.disposable || false,
    role: data.role || false,
  }
}

// Créer un contact dans Brevo
export async function createContact(params: {
  email: string
  firstName?: string
  lastName?: string
  attributes?: Record<string, any>
  listIds?: number[]
}) {
  const response = await fetch(`${BREVO_API_URL}/contacts`, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      attributes: {
        PRENOM: params.firstName,
        NOM: params.lastName,
        ...params.attributes,
      },
      listIds: params.listIds,
      updateEnabled: true,
    }),
  })

  return response.json()
}

// Obtenir les statistiques globales
export async function getGlobalStats() {
  const response = await fetch(`${BREVO_API_URL}/smtp/statistics/aggregatedReport`, {
    headers: {
      'accept': 'application/json',
      'api-key': BREVO_API_KEY,
    },
  })

  if (!response.ok) {
    throw new Error('Failed to get global stats')
  }

  return response.json()
}
