'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Search, RefreshCw, UserPlus, Mail, CheckCircle, XCircle, 
  AlertCircle, Zap, Users, Building, Globe, ChevronDown, ChevronRight,
  Play, Pause, Settings
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Etablissement {
  id: string
  nom: string
  type: string
  ville: string
  departement: string
  site_web: string | null
  contacts: Contact[]
}

interface Contact {
  id: string
  etablissement_id: string
  prenom: string | null
  nom: string | null
  poste: string
  email: string | null
  email_status: string
  source: string
}

interface ApiCredits {
  hunter: { available: boolean; credits: number | null }
  zerobounce: { available: boolean; credits: number | null }
}

export default function LeadsPage() {
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterEmailStatus, setFilterEmailStatus] = useState('all')
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [apiCredits, setApiCredits] = useState<ApiCredits | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [stats, setStats] = useState({ total: 0, withContacts: 0, withEmails: 0, validEmails: 0 })
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50

  useEffect(() => {
    loadData()
    loadApiCredits()
  }, [page, filterType])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0)
      loadData()
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const loadApiCredits = async () => {
    try {
      const response = await fetch('/api/contacts/enrich')
      const data = await response.json()
      setApiCredits(data)
    } catch (err) {
      console.error('Error loading credits:', err)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      // Charger les établissements
      let query = supabase
        .from('etablissements')
        .select('*', { count: 'exact' })
        .order('nom')

      if (filterType !== 'all') query = query.eq('type', filterType)
      if (search) query = query.or(`nom.ilike.%${search}%,ville.ilike.%${search}%`)
      
      query = query.range(page * pageSize, (page + 1) * pageSize - 1)

      const { data: etabs, count } = await query
      setTotalCount(count || 0)

      // Charger les contacts pour ces établissements
      const etabIds = (etabs || []).map(e => e.id)
      
      let contactsMap: Record<string, Contact[]> = {}
      if (etabIds.length > 0) {
        let contactQuery = supabase
          .from('contacts')
          .select('*')
          .in('etablissement_id', etabIds)
          .order('poste')

        if (filterEmailStatus !== 'all') {
          contactQuery = contactQuery.eq('email_status', filterEmailStatus)
        }

        const { data: contacts } = await contactQuery

        if (contacts) {
          contacts.forEach(c => {
            if (!contactsMap[c.etablissement_id]) contactsMap[c.etablissement_id] = []
            contactsMap[c.etablissement_id].push(c)
          })
        }
      }

      const formattedData: Etablissement[] = (etabs || []).map(e => ({
        ...e,
        contacts: contactsMap[e.id] || []
      }))

      setEtablissements(formattedData)

      // Calculer les stats
      const { count: totalEtabs } = await supabase.from('etablissements').select('*', { count: 'exact', head: true })
      const { count: withContacts } = await supabase.from('contacts').select('etablissement_id', { count: 'exact', head: true })
      const { count: withEmails } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).not('email', 'is', null)
      const { count: validEmails } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('email_status', 'valide')

      setStats({
        total: totalEtabs || 0,
        withContacts: withContacts || 0,
        withEmails: withEmails || 0,
        validEmails: validEmails || 0
      })

    } catch (err) {
      console.error('Error:', err)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Créer des contacts pour un établissement
  const createContactsForEtab = async (etabId: string) => {
    setEnriching(true)
    try {
      const response = await fetch('/api/contacts/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search_contacts', etablissement_id: etabId })
      })
      const data = await response.json()
      
      if (data.contacts?.length > 0) {
        toast.success(`${data.contacts.length} contacts créés`)
      } else if (data.domain) {
        toast.success(`Domaine trouvé: ${data.domain}`)
      } else {
        toast.error('Aucun contact trouvé')
      }
      
      loadData()
    } catch (err) {
      toast.error('Erreur enrichissement')
    } finally {
      setEnriching(false)
    }
  }

  // Vérifier un email
  const verifyEmail = async (contact: Contact) => {
    if (!contact.email) {
      toast.error('Pas d\'email à vérifier')
      return
    }
    
    setVerifying(true)
    try {
      const response = await fetch('/api/contacts/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'verify_email', 
          contact_id: contact.id,
          email: contact.email 
        })
      })
      const data = await response.json()
      
      if (data.valid) {
        toast.success('Email validé ✓')
      } else {
        toast.error(`Email invalide: ${data.status}`)
      }
      
      loadData()
      loadApiCredits()
    } catch (err) {
      toast.error('Erreur vérification')
    } finally {
      setVerifying(false)
    }
  }

  // Enrichissement en masse
  const bulkEnrich = async () => {
    if (!confirm('Créer des contacts pour tous les établissements sans contact ? Cela peut prendre du temps.')) return
    
    setEnriching(true)
    try {
      const response = await fetch('/api/contacts/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_create_contacts' })
      })
      const data = await response.json()
      
      toast.success(`${data.created} contacts créés`)
      loadData()
    } catch (err) {
      toast.error('Erreur enrichissement')
    } finally {
      setEnriching(false)
    }
  }

  // Vérification en masse
  const bulkVerify = async () => {
    const contactsToVerify = etablissements
      .flatMap(e => e.contacts)
      .filter(c => c.email && c.email_status === 'trouve')
      .slice(0, 10) // Limiter à 10 pour économiser les crédits

    if (contactsToVerify.length === 0) {
      toast.error('Aucun email à vérifier')
      return
    }

    if (!confirm(`Vérifier ${contactsToVerify.length} emails ? (utilise des crédits API)`)) return

    setVerifying(true)
    let verified = 0
    
    for (const contact of contactsToVerify) {
      try {
        await fetch('/api/contacts/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            action: 'verify_email', 
            contact_id: contact.id,
            email: contact.email 
          })
        })
        verified++
      } catch (err) {}
    }

    toast.success(`${verified} emails vérifiés`)
    setVerifying(false)
    loadData()
    loadApiCredits()
  }

  const emailStatusIcon = (status: string) => {
    switch (status) {
      case 'valide': return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'invalide': return <XCircle className="w-4 h-4 text-red-500" />
      case 'trouve': return <AlertCircle className="w-4 h-4 text-blue-500" />
      default: return <AlertCircle className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Enrichissement Contacts</h1>
          <p className="text-gray-500 mt-1">Trouvez et validez les emails de vos prospects</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadData} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg"><Building className="w-5 h-5 text-blue-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Établissements</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg"><Users className="w-5 h-5 text-purple-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.withContacts}</p>
              <p className="text-sm text-gray-500">Contacts créés</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 rounded-lg"><Mail className="w-5 h-5 text-yellow-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.withEmails}</p>
              <p className="text-sm text-gray-500">Avec email</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="w-5 h-5 text-green-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.validEmails}</p>
              <p className="text-sm text-gray-500">Emails validés</p>
            </div>
          </div>
        </div>
      </div>

      {/* API Credits */}
      {apiCredits && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 mb-6 border border-purple-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-purple-600" />
                <span className="font-medium">Crédits API</span>
              </div>
              <div className="flex items-center gap-4">
                <div className={`flex items-center gap-2 ${apiCredits.hunter.available ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="text-sm">Hunter.io:</span>
                  <span className="font-bold">{apiCredits.hunter.credits ?? 'N/A'}</span>
                </div>
                <div className={`flex items-center gap-2 ${apiCredits.zerobounce.available ? 'text-green-600' : 'text-gray-400'}`}>
                  <span className="text-sm">ZeroBounce:</span>
                  <span className="font-bold">{apiCredits.zerobounce.credits ?? 'N/A'}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={bulkEnrich} disabled={enriching}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                {enriching ? <RefreshCw className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Créer contacts (masse)
              </button>
              <button onClick={bulkVerify} disabled={verifying}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                {verifying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Vérifier emails (x10)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Rechercher..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0) }} className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="all">Tous les types</option>
            {['EHPAD', 'IME', 'ESAT', 'SESSAD', 'FAM', 'MAS'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterEmailStatus} onChange={(e) => { setFilterEmailStatus(e.target.value); loadData() }} className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="all">Tous les statuts email</option>
            <option value="a_trouver">À trouver</option>
            <option value="trouve">Trouvé (à vérifier)</option>
            <option value="valide">Validé ✓</option>
            <option value="invalide">Invalide ✗</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {etablissements.map(etab => (
              <div key={etab.id}>
                {/* Ligne établissement */}
                <div className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between"
                  onClick={() => toggleExpand(etab.id)}>
                  <div className="flex items-center gap-4">
                    {expandedIds.includes(etab.id) ? 
                      <ChevronDown className="w-5 h-5 text-gray-400" /> : 
                      <ChevronRight className="w-5 h-5 text-gray-400" />
                    }
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs text-white bg-blue-500`}>{etab.type}</span>
                        <p className="font-medium text-gray-900">{etab.nom}</p>
                      </div>
                      <p className="text-sm text-gray-500">{etab.ville} • {etab.departement}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {etab.site_web && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <Globe className="w-4 h-4" />
                        {etab.site_web.replace('https://', '').replace('http://', '')}
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm ${etab.contacts.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {etab.contacts.length} contact{etab.contacts.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); createContactsForEtab(etab.id) }}
                      disabled={enriching}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 flex items-center gap-1">
                      <UserPlus className="w-4 h-4" /> Enrichir
                    </button>
                  </div>
                </div>

                {/* Contacts expandés */}
                {expandedIds.includes(etab.id) && (
                  <div className="bg-gray-50 px-4 py-3 pl-12">
                    {etab.contacts.length > 0 ? (
                      <div className="space-y-2">
                        {etab.contacts.map(contact => (
                          <div key={contact.id} className="bg-white rounded-lg p-3 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="font-medium text-gray-900">
                                  {contact.prenom || contact.nom 
                                    ? `${contact.prenom || ''} ${contact.nom || ''}`.trim()
                                    : contact.poste}
                                </p>
                                <p className="text-sm text-gray-500">{contact.poste}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              {contact.email ? (
                                <div className="flex items-center gap-2">
                                  {emailStatusIcon(contact.email_status)}
                                  <span className="text-sm">{contact.email}</span>
                                  {contact.email_status === 'trouve' && (
                                    <button onClick={() => verifyEmail(contact)} disabled={verifying}
                                      className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200">
                                      Vérifier
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">Email à trouver</span>
                              )}
                              <span className="text-xs text-gray-400">{contact.source}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm py-2">Aucun contact. Cliquez sur "Enrichir" pour rechercher.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">Page {page + 1} sur {Math.ceil(totalCount / pageSize)}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} 
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50">Précédent</button>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= totalCount}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50">Suivant</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
