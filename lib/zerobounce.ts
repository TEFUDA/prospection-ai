// =====================================================
// ZEROBOUNCE API INTEGRATION
// =====================================================

const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY!
const ZEROBOUNCE_API_URL = 'https://api.zerobounce.net/v2'

interface ValidateResponse {
  address: string
  status: 'valid' | 'invalid' | 'catch-all' | 'unknown' | 'spamtrap' | 'abuse' | 'do_not_mail'
  sub_status: string
  free_email: boolean
  did_you_mean: string | null
  account: string
  domain: string
  domain_age_days: string
  smtp_provider: string
  mx_found: string
  mx_record: string
  firstname: string
  lastname: string
  gender: string
  country: string
  region: string
  city: string
  zipcode: string
  processed_at: string
}

interface CreditsResponse {
  Credits: string
}

interface BatchValidateResponse {
  email_batch: Array<{
    address: string
    status: string
    sub_status: string
    free_email: boolean
    did_you_mean: string | null
  }>
  errors: Array<{
    email_address: string
    error: string
  }>
}

// Valider un email unique
export async function validateEmail(email: string): Promise<ValidateResponse | null> {
  try {
    const params = new URLSearchParams({
      api_key: ZEROBOUNCE_API_KEY,
      email,
    })

    const response = await fetch(`${ZEROBOUNCE_API_URL}/validate?${params}`)
    
    if (!response.ok) {
      console.error('ZeroBounce API Error:', response.statusText)
      return null
    }

    return response.json()
  } catch (error) {
    console.error('ZeroBounce validateEmail error:', error)
    return null
  }
}

// Valider plusieurs emails en batch
export async function validateBatch(emails: string[]): Promise<BatchValidateResponse | null> {
  try {
    const response = await fetch(`${ZEROBOUNCE_API_URL}/validatebatch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: ZEROBOUNCE_API_KEY,
        email_batch: emails.map(email => ({ email_address: email })),
      }),
    })
    
    if (!response.ok) {
      console.error('ZeroBounce API Error:', response.statusText)
      return null
    }

    return response.json()
  } catch (error) {
    console.error('ZeroBounce validateBatch error:', error)
    return null
  }
}

// Obtenir le nombre de crédits restants
export async function getCredits(): Promise<number> {
  try {
    const params = new URLSearchParams({
      api_key: ZEROBOUNCE_API_KEY,
    })

    const response = await fetch(`${ZEROBOUNCE_API_URL}/getcredits?${params}`)
    
    if (!response.ok) {
      return 0
    }

    const data: CreditsResponse = await response.json()
    return parseInt(data.Credits, 10) || 0
  } catch (error) {
    console.error('ZeroBounce getCredits error:', error)
    return 0
  }
}

// Vérifier si un email est "safe" à envoyer
export function isEmailSafe(result: ValidateResponse): boolean {
  const safeStatuses = ['valid', 'catch-all']
  return safeStatuses.includes(result.status)
}

// Convertir le status ZeroBounce vers notre status interne
export function mapZeroBounceStatus(status: string): 'valid' | 'invalid' | 'a_verifier' {
  switch (status) {
    case 'valid':
      return 'valid'
    case 'invalid':
    case 'spamtrap':
    case 'abuse':
    case 'do_not_mail':
      return 'invalid'
    case 'catch-all':
    case 'unknown':
    default:
      return 'a_verifier'
  }
}

// Estimer le coût en crédits pour une liste d'emails
export function estimateCost(emailCount: number): {
  credits: number
  estimatedCost: string
} {
  // ZeroBounce pricing: environ $0.008 par email
  const credits = emailCount
  const cost = emailCount * 0.008
  
  return {
    credits,
    estimatedCost: `$${cost.toFixed(2)} (~${Math.ceil(cost * 0.95)}€)`,
  }
}
