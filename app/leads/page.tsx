'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Search, RefreshCw, UserPlus, Mail, CheckCircle, XCircle, 
  AlertCircle, Zap, Users, Building, Globe, ChevronDown, ChevronRight,
  Sparkles, MessageSquare, Brain, Eye
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
  icebreaker: string | null
  icebreaker_context: string | null
}

interface ApiCredits {
  hunter: { available: boolean; credits: number | null }
  zerobounce: { available: boolean; credits: number | null }
}

interface IcebreakerStats {
  total_valid_contacts: number
  with_icebreaker: number
  pending: number
  apis: { anthropic: boolean; serper: boolean }
}

export default function LeadsPage() {
  const [etablissements, setEtablissements] = useState<Etablissement[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [filterEmailStatus, setFilterEmailStatus] = useState('all')
  const [expandedIds, setExpandedIds] = useState<string[]>([])
  const [apiCredits, setApiCredits] = useState<ApiCredits | null>(null)
  const [icebreakerStats, setIcebreakerStats] = useState<IcebreakerStats | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [generatingIcebreaker, setGeneratingIcebreaker] = useState<string | null>(null)
  const [stats, setStats] = useState({ total: 0, withContacts: 0, withEmails: 0, validEmails: 0 })
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [previewIcebreaker, setPreviewIcebreaker] = useState<Contact | null>(null)
  const pageSize = 50

  useEffect(() => {
    loadData()
    loadApiCredits()
    loadIcebreakerStats()
  }, [page, filterType])

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); loadData() }, 500)
    return () => clearTimeout(timer)
  }, [search])

  const loadApiCredits = async () => {
    try {
      const response = await fetch('/api/contacts/enrich')
      const data = await response.json()
      setApiCredits(data)
    } catch (err) {}
  }

  const loadIcebreakerStats = async () => {
    try {
      const response = await fetch('/api/contacts/icebreaker')
      const data = await response.json()
      setIcebreakerStats(data)
    } catch (err) {}
  }

  const loadData = async () => {
    setLoading(true)
    try {
      let query = supabase.from('etablissements').select('*', { count: 'exact' }).order('nom')
      if (filterType !== 'all') query = query.eq('type', filterType)
      if (search) query = query.or(`nom.ilike.%${search}%,ville.ilike.%${search}%`)
      query = query.range(page * pageSize, (page + 1) * pageSize - 1)

      const { data: etabs, count } = await query
      setTotalCount(count || 0)

      const etabIds = (etabs || []).map(e => e.id)
      let contactsMap: Record<string, Contact[]> = {}
      
      if (etabIds.length > 0) {
        let contactQuery = supabase.from('contacts').select('*').in('etablissement_id', etabIds).order('poste')
        if (filterEmailStatus !== 'all') contactQuery = contactQuery.eq('email_status', filterEmailStatus)
        const { data: contacts } = await contactQuery

        if (contacts) {
          contacts.forEach(c => {
            if (!contactsMap[c.etablissement_id]) contactsMap[c.etablissement_id] = []
            contactsMap[c.etablissement_id].push(c)
          })
        }
      }

      const formattedData: Etablissement[] = (etabs || []).map(e => ({ ...e, contacts: contactsMap[e.id] || [] }))
      setEtablissements(formattedData)

      // Stats
      const { count: totalEtabs } = await supabase.from('etablissements').select('*', { count: 'exact', head: true })
      const { count: withContacts } = await supabase.from('contacts').select('etablissement_id', { count: 'exact', head: true })
      const { count: withEmails } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).not('email', 'is', null)
      const { count: validEmails } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('email_status', 'valide')

      setStats({ total: totalEtabs || 0, withContacts: withContacts || 0, withEmails: withEmails || 0, validEmails: validEmails || 0 })
    } catch (err) {
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const createContactsForEtab = async (etabId: string) => {
    setEnriching(true)
    try {
      const response = await fetch('/api/contacts/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'search_contacts', etablissement_id: etabId })
      })
      const data = await response.json()
      if (data.contacts?.length > 0) toast.success(`${data.contacts.length} contacts créés`)
      else if (data.domain) toast.success(`Domaine trouvé: ${data.domain}`)
      else toast.error('Aucun contact trouvé')
      loadData()
    } catch (err) { toast.error('Erreur enrichissement') }
    finally { setEnriching(false) }
  }

  const verifyEmail = async (contact: Contact) => {
    if (!contact.email) { toast.error('Pas d\'email'); return }
    setVerifying(true)
    try {
      const response = await fetch('/api/contacts/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_email', contact_id: contact.id, email: contact.email })
      })
      const data = await response.json()
      if (data.valid) toast.success('Email validé ✓')
      else toast.error(`Email invalide: ${data.status}`)
      loadData(); loadApiCredits()
    } catch (err) { toast.error('Erreur vérification') }
    finally { setVerifying(false) }
  }

  // Générer Ice Breaker pour un contact
  const generateIcebreaker = async (contact: Contact) => {
    setGeneratingIcebreaker(contact.id)
    try {
      const response = await fetch('/api/contacts/icebreaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', contact_id: contact.id })
      })
      const data = await response.json()
      
      if (data.success && data.icebreaker) {
        toast.success('Ice breaker généré!')
        loadData()
        loadIcebreakerStats()
      } else {
        toast.error('Erreur génération')
      }
    } catch (err) {
      toast.error('Erreur API')
    } finally {
      setGeneratingIcebreaker(null)
    }
  }

  // Génération en masse
  const bulkGenerateIcebreakers = async () => {
    if (!confirm('Générer des ice breakers pour 10 contacts avec email validé ?')) return
    setGeneratingIcebreaker('bulk')
    try {
      const response = await fetch('/api/contacts/icebreaker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'bulk_generate' })
      })
      const data = await response.json()
      toast.success(`${data.generated} ice breakers générés!`)
      loadData()
      loadIcebreakerStats()
    } catch (err) {
      toast.error('Erreur')
    } finally {
      setGeneratingIcebreaker(null)
    }
  }

  const bulkEnrich = async () => {
    if (!confirm('Créer des contacts pour les établissements sans contact ?')) return
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
    } catch (err) { toast.error('Erreur') }
    finally { setEnriching(false) }
  }

  const bulkVerify = async () => {
    const toVerify = etablissements.flatMap(e => e.contacts).filter(c => c.email && c.email_status === 'trouve').slice(0, 10)
    if (toVerify.length === 0) { toast.error('Aucun email à vérifier'); return }
    if (!confirm(`Vérifier ${toVerify.length} emails ?`)) return
    
    setVerifying(true)
    let verified = 0
    for (const contact of toVerify) {
      try {
        await fetch('/api/contacts/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify_email', contact_id: contact.id, email: contact.email })
        })
        verified++
      } catch (err) {}
    }
    toast.success(`${verified} emails vérifiés`)
    setVerifying(false)
    loadData(); loadApiCredits()
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
          <p className="text-gray-500 mt-1">Trouvez les emails et générez des ice breakers personnalisés</p>
        </div>
        <button onClick={loadData} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-4 mb-6">
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
              <p className="text-sm text-gray-500">Contacts</p>
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
              <p className="text-sm text-gray-500">Validés</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-pink-100 rounded-lg"><Sparkles className="w-5 h-5 text-pink-600" /></div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{icebreakerStats?.with_icebreaker || 0}</p>
              <p className="text-sm text-gray-500">Ice breakers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl p-6 mb-6 border border-purple-200">
        <h3 className="font-semibold text-gray-900 mb-4">🚀 Pipeline d'enrichissement</h3>
        <div className="flex items-center justify-between">
          {/* Étape 1 */}
          <div className="flex-1 text-center">
            <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">1</div>
            <p className="text-sm font-medium">Créer contacts</p>
            <p className="text-xs text-gray-500">Directeur, IDEC...</p>
            <button onClick={bulkEnrich} disabled={enriching}
              className="mt-2 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700 disabled:opacity-50">
              {enriching ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : <UserPlus className="w-3 h-3 inline" />} Go
            </button>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          
          {/* Étape 2 */}
          <div className="flex-1 text-center">
            <div className="w-12 h-12 bg-yellow-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">2</div>
            <p className="text-sm font-medium">Trouver emails</p>
            <p className="text-xs text-gray-500">Hunter.io</p>
            <p className="text-xs text-purple-600 mt-2">{apiCredits?.hunter.credits || 0} crédits</p>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          
          {/* Étape 3 */}
          <div className="flex-1 text-center">
            <div className="w-12 h-12 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">3</div>
            <p className="text-sm font-medium">Valider emails</p>
            <p className="text-xs text-gray-500">ZeroBounce</p>
            <button onClick={bulkVerify} disabled={verifying}
              className="mt-2 px-3 py-1 bg-green-600 text-white rounded-lg text-xs hover:bg-green-700 disabled:opacity-50">
              {verifying ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : <CheckCircle className="w-3 h-3 inline" />} x10
            </button>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          
          {/* Étape 4 - ICE BREAKER */}
          <div className="flex-1 text-center">
            <div className="w-12 h-12 bg-pink-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">4</div>
            <p className="text-sm font-medium">Ice Breaker IA</p>
            <p className="text-xs text-gray-500">Claude + Recherche</p>
            <button onClick={bulkGenerateIcebreakers} disabled={generatingIcebreaker === 'bulk'}
              className="mt-2 px-3 py-1 bg-pink-600 text-white rounded-lg text-xs hover:bg-pink-700 disabled:opacity-50">
              {generatingIcebreaker === 'bulk' ? <RefreshCw className="w-3 h-3 animate-spin inline" /> : <Sparkles className="w-3 h-3 inline" />} x10
            </button>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          
          {/* Étape 5 */}
          <div className="flex-1 text-center">
            <div className="w-12 h-12 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 font-bold">5</div>
            <p className="text-sm font-medium">Envoyer</p>
            <p className="text-xs text-gray-500">Brevo</p>
            <a href="/prospects" className="mt-2 px-3 py-1 bg-purple-600 text-white rounded-lg text-xs hover:bg-purple-700 inline-block">
              → Prospects
            </a>
          </div>
        </div>
      </div>

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
            <option value="all">Tous les statuts</option>
            <option value="a_trouver">À trouver</option>
            <option value="trouve">Trouvé</option>
            <option value="valide">Validé ✓</option>
            <option value="invalide">Invalide ✗</option>
          </select>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-purple-600" /></div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {etablissements.map(etab => (
              <div key={etab.id}>
                <div className="p-4 hover:bg-gray-50 cursor-pointer flex items-center justify-between" onClick={() => toggleExpand(etab.id)}>
                  <div className="flex items-center gap-4">
                    {expandedIds.includes(etab.id) ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-xs text-white bg-blue-500">{etab.type}</span>
                        <p className="font-medium text-gray-900">{etab.nom}</p>
                      </div>
                      <p className="text-sm text-gray-500">{etab.ville} • {etab.departement}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {etab.site_web && (
                      <span className="flex items-center gap-1 text-sm text-green-600">
                        <Globe className="w-4 h-4" />
                        {etab.site_web.replace('https://', '').replace('http://', '').substring(0, 25)}
                      </span>
                    )}
                    <span className={`px-3 py-1 rounded-full text-sm ${etab.contacts.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                      {etab.contacts.length} contact{etab.contacts.length !== 1 ? 's' : ''}
                    </span>
                    <button onClick={(e) => { e.stopPropagation(); createContactsForEtab(etab.id) }} disabled={enriching}
                      className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm hover:bg-purple-200 flex items-center gap-1">
                      <UserPlus className="w-4 h-4" /> Enrichir
                    </button>
                  </div>
                </div>

                {/* Contacts */}
                {expandedIds.includes(etab.id) && (
                  <div className="bg-gray-50 px-4 py-3 pl-12">
                    {etab.contacts.length > 0 ? (
                      <div className="space-y-3">
                        {etab.contacts.map(contact => (
                          <div key={contact.id} className="bg-white rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <p className="font-medium text-gray-900">
                                    {contact.prenom || contact.nom ? `${contact.prenom || ''} ${contact.nom || ''}`.trim() : contact.poste}
                                  </p>
                                  <span className="text-sm text-gray-500">• {contact.poste}</span>
                                </div>
                                
                                {/* Email */}
                                <div className="flex items-center gap-3 mb-3">
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
                                </div>

                                {/* Ice Breaker */}
                                {contact.icebreaker ? (
                                  <div className="bg-pink-50 rounded-lg p-3 border border-pink-200">
                                    <div className="flex items-center gap-2 mb-1">
                                      <Sparkles className="w-4 h-4 text-pink-500" />
                                      <span className="text-xs font-medium text-pink-600">Ice Breaker IA</span>
                                      <button onClick={() => setPreviewIcebreaker(contact)} className="ml-auto text-xs text-pink-500 hover:underline flex items-center gap-1">
                                        <Eye className="w-3 h-3" /> Voir contexte
                                      </button>
                                    </div>
                                    <p className="text-sm text-gray-700 italic">"{contact.icebreaker}"</p>
                                  </div>
                                ) : contact.email_status === 'valide' ? (
                                  <button onClick={() => generateIcebreaker(contact)} disabled={generatingIcebreaker === contact.id}
                                    className="flex items-center gap-2 px-3 py-2 bg-pink-100 text-pink-700 rounded-lg text-sm hover:bg-pink-200 disabled:opacity-50">
                                    {generatingIcebreaker === contact.id ? (
                                      <><RefreshCw className="w-4 h-4 animate-spin" /> Recherche en cours...</>
                                    ) : (
                                      <><Brain className="w-4 h-4" /> Générer Ice Breaker IA</>
                                    )}
                                  </button>
                                ) : null}
                              </div>
                              
                              <span className="text-xs text-gray-400 ml-4">{contact.source}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm py-2">Aucun contact. Cliquez sur "Enrichir".</p>
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
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 border rounded-lg disabled:opacity-50">Précédent</button>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= totalCount} className="px-3 py-1 border rounded-lg disabled:opacity-50">Suivant</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Preview Ice Breaker */}
      {previewIcebreaker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Ice Breaker - Contexte</h2>
              <button onClick={() => setPreviewIcebreaker(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Ice Breaker généré:</p>
                <p className="text-gray-900 bg-pink-50 p-3 rounded-lg border border-pink-200 italic">"{previewIcebreaker.icebreaker}"</p>
              </div>
              {previewIcebreaker.icebreaker_context && (
                <div>
                  <p className="text-sm text-gray-500 mb-1">Sources utilisées:</p>
                  <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-lg">{previewIcebreaker.icebreaker_context}</p>
                </div>
              )}
              <button onClick={() => setPreviewIcebreaker(null)} className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
