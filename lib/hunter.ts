// =====================================================
// HUNTER.IO API INTEGRATION
// =====================================================

const HUNTER_API_KEY = process.env.HUNTER_API_KEY!
const HUNTER_API_URL = 'https://api.hunter.io/v2'

interface EmailFinderResponse {
  data: {
    first_name: string
    last_name: string
    email: string
    score: number
    domain: string
    position: string
    twitter: string | null
    linkedin_url: string | null
    phone_number: string | null
    company: string
    sources: Array<{
      domain: string
      uri: string
      extracted_on: string
    }>
  }
}

interface DomainSearchResponse {
  data: {
    domain: string
    disposable: boolean
    webmail: boolean
    pattern: string
    organization: string
    emails: Array<{
      value: string
      type: string
      confidence: number
      first_name: string
      last_name: string
      position: string
      linkedin: string | null
      phone_number: string | null
    }>
  }
  meta: {
    results: number
    limit: number
    offset: number
  }
}

interface EmailVerifyResponse {
  data: {
    email: string
    result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
    score: number
    regexp: boolean
    gibberish: boolean
    disposable: boolean
    webmail: boolean
    mx_records: boolean
    smtp_server: boolean
    smtp_check: boolean
    accept_all: boolean
    block: boolean
  }
}

// Trouver l'email d'une personne
export async function findEmail(params: {
  domain: string
  firstName?: string
  lastName?: string
  fullName?: string
  company?: string
}): Promise<EmailFinderResponse['data'] | null> {
  const searchParams = new URLSearchParams({
    api_key: HUNTER_API_KEY,
    domain: params.domain,
  })

  if (params.firstName) searchParams.append('first_name', params.firstName)
  if (params.lastName) searchParams.append('last_name', params.lastName)
  if (params.fullName) searchParams.append('full_name', params.fullName)
  if (params.company) searchParams.append('company', params.company)

  try {
    const response = await fetch(`${HUNTER_API_URL}/email-finder?${searchParams}`)
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Hunter API Error:', error)
      return null
    }

    const data: EmailFinderResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Hunter findEmail error:', error)
    return null
  }
}

// Rechercher tous les emails d'un domaine
export async function searchDomain(domain: string, options?: {
  type?: 'personal' | 'generic'
  limit?: number
  offset?: number
}): Promise<DomainSearchResponse['data'] | null> {
  const searchParams = new URLSearchParams({
    api_key: HUNTER_API_KEY,
    domain,
  })

  if (options?.type) searchParams.append('type', options.type)
  if (options?.limit) searchParams.append('limit', options.limit.toString())
  if (options?.offset) searchParams.append('offset', options.offset.toString())

  try {
    const response = await fetch(`${HUNTER_API_URL}/domain-search?${searchParams}`)
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Hunter API Error:', error)
      return null
    }

    const data: DomainSearchResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Hunter searchDomain error:', error)
    return null
  }
}

// Vérifier si un email est valide
export async function verifyEmail(email: string): Promise<EmailVerifyResponse['data'] | null> {
  const searchParams = new URLSearchParams({
    api_key: HUNTER_API_KEY,
    email,
  })

  try {
    const response = await fetch(`${HUNTER_API_URL}/email-verifier?${searchParams}`)
    
    if (!response.ok) {
      const error = await response.json()
      console.error('Hunter API Error:', error)
      return null
    }

    const data: EmailVerifyResponse = await response.json()
    return data.data
  } catch (error) {
    console.error('Hunter verifyEmail error:', error)
    return null
  }
}

// Obtenir le nombre de crédits restants
export async function getAccountInfo() {
  try {
    const response = await fetch(`${HUNTER_API_URL}/account?api_key=${HUNTER_API_KEY}`)
    
    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.data
  } catch (error) {
    console.error('Hunter getAccountInfo error:', error)
    return null
  }
}

// Générer des formats d'email possibles
export function generateEmailFormats(
  firstName: string,
  lastName: string,
  domain: string
): string[] {
  const f = firstName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const l = lastName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  
  return [
    `${f}.${l}@${domain}`,
    `${f}${l}@${domain}`,
    `${f[0]}.${l}@${domain}`,
    `${f[0]}${l}@${domain}`,
    `${l}.${f}@${domain}`,
    `${l}${f[0]}@${domain}`,
    `${f}@${domain}`,
    `${l}@${domain}`,
    `direction@${domain}`,
    `contact@${domain}`,
  ]
}
