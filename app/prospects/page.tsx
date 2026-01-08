'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Search, 
  Download,
  Plus,
  Mail,
  Eye,
  Edit,
  RefreshCw,
  X,
  LayoutGrid,
  List,
  Phone,
  Flame,
  Calendar,
  Users
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Prospect {
  id: string
  etablissement_nom: string
  etablissement_type: string
  etablissement_ville: string
  etablissement_cp: string
  etablissement_departement: string
  etablissement_telephone: string
  contact_poste: string
  contact_email: string
  email_status: string
  statut_prospection: string
  score_interet: number
}

type ViewType = 'all' | 'kanban' | 'a_contacter' | 'hot_leads' | 'rdv_semaine'

const statusColors: Record<string, string> = {
  a_prospecter: 'bg-gray-100 text-gray-800 border-gray-300',
  en_cours: 'bg-blue-100 text-blue-800 border-blue-300',
  interesse: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  rdv_pris: 'bg-purple-100 text-purple-800 border-purple-300',
  client: 'bg-green-100 text-green-800 border-green-300',
  pas_interesse: 'bg-red-100 text-red-800 border-red-300',
}

const statusLabels: Record<string, string> = {
  a_prospecter: 'À prospecter',
  en_cours: 'Séquence en cours',
  interesse: 'Intéressé',
  rdv_pris: 'RDV pris',
  client: 'Client',
  pas_interesse: 'Pas intéressé',
}

const emailStatusColors: Record<string, string> = {
  valide: 'bg-green-100 text-green-800',
  a_trouver: 'bg-gray-100 text-gray-800',
  trouve: 'bg-blue-100 text-blue-800',
  invalide: 'bg-red-100 text-red-800',
}

const typeColors: Record<string, string> = {
  EHPAD: 'bg-blue-500',
  IME: 'bg-green-500',
  ESAT: 'bg-purple-500',
  SESSAD: 'bg-orange-500',
  FAM: 'bg-pink-500',
  MAS: 'bg-red-500',
  SAMSAH: 'bg-yellow-500',
  SAVS: 'bg-teal-500',
  ITEP: 'bg-indigo-500',
  CMPP: 'bg-cyan-500',
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDept, setFilterDept] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [currentView, setCurrentView] = useState<ViewType>('all')
  const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const pageSize = 50

  // Charger les prospects - requête simplifiée
  const loadProspects = async () => {
    setLoading(true)
    setErrorMsg('')
    
    try {
      // Requête simple sur etablissements seulement
      let query = supabase
        .from('etablissements')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      // Filtres
      if (filterType !== 'all') {
        query = query.eq('type', filterType)
      }
      if (filterDept !== 'all') {
        query = query.ilike('departement', `%${filterDept}%`)
      }
      if (search) {
        query = query.or(`nom.ilike.%${search}%,ville.ilike.%${search}%`)
      }

      // Pagination
      query = query.range(page * pageSize, (page + 1) * pageSize - 1)

      const { data: etablissements, error, count } = await query

      if (error) {
        console.error('Supabase error:', error)
        setErrorMsg(`Erreur: ${error.message}`)
        toast.error('Erreur lors du chargement')
        return
      }

      // Récupérer les contacts associés
      const etabIds = (etablissements || []).map((e: any) => e.id)
      
      let contactsMap: Record<string, any> = {}
      let prospectionMap: Record<string, any> = {}

      if (etabIds.length > 0) {
        // Récupérer les contacts
        const { data: contacts } = await supabase
          .from('contacts')
          .select('*')
          .in('etablissement_id', etabIds)

        if (contacts) {
          contacts.forEach((c: any) => {
            if (!contactsMap[c.etablissement_id]) {
              contactsMap[c.etablissement_id] = c
            }
          })

          // Récupérer les prospections
          const contactIds = contacts.map((c: any) => c.id)
          if (contactIds.length > 0) {
            const { data: prospections } = await supabase
              .from('prospection')
              .select('*')
              .in('contact_id', contactIds)

            if (prospections) {
              prospections.forEach((p: any) => {
                prospectionMap[p.contact_id] = p
              })
            }
          }
        }
      }

      // Formater les données
      const formattedProspects: Prospect[] = (etablissements || []).map((etab: any) => {
        const contact = contactsMap[etab.id] || {}
        const prospection = prospectionMap[contact.id] || {}
        
        return {
          id: etab.id,
          etablissement_nom: etab.nom || '',
          etablissement_type: etab.type || '',
          etablissement_ville: etab.ville || '',
          etablissement_cp: etab.code_postal || '',
          etablissement_departement: etab.departement || '',
          etablissement_telephone: etab.telephone || '',
          contact_poste: contact.poste || 'Directeur',
          contact_email: contact.email || '',
          email_status: contact.email_status || 'a_trouver',
          statut_prospection: prospection.statut || 'a_prospecter',
          score_interet: contact.email ? (contact.email_status === 'valide' ? 50 : 20) : 0,
        }
      })

      setProspects(formattedProspects)
      setTotalCount(count || 0)
    } catch (err: any) {
      console.error('Error:', err)
      setErrorMsg(`Erreur: ${err.message}`)
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProspects()
  }, [page, filterType, filterDept])

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0)
      loadProspects()
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Filtrer selon la vue
  const getFilteredProspects = () => {
    let filtered = prospects

    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.statut_prospection === filterStatus)
    }

    switch (currentView) {
      case 'a_contacter':
        filtered = filtered.filter(p => 
          p.statut_prospection === 'a_prospecter' && 
          (p.email_status === 'valide' || p.email_status === 'trouve')
        )
        break
      case 'hot_leads':
        filtered = filtered.filter(p => p.score_interet > 30)
        break
      case 'rdv_semaine':
        filtered = filtered.filter(p => p.statut_prospection === 'rdv_pris')
        break
    }

    return filtered
  }

  const filteredProspects = getFilteredProspects()
  const kanbanColumns = ['a_prospecter', 'en_cours', 'interesse', 'rdv_pris', 'client']

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProspects.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredProspects.map(p => p.id))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Stats par type
  const typeStats = prospects.reduce((acc, p) => {
    acc[p.etablissement_type] = (acc[p.etablissement_type] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 mt-1">
            {totalCount} établissements au total
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={loadProspects}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Exporter
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Error message */}
      {errorMsg && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Vue Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
        <button
          onClick={() => setCurrentView('all')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            currentView === 'all' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <List className="w-4 h-4" />
          Tous ({totalCount})
        </button>
        <button
          onClick={() => setCurrentView('kanban')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            currentView === 'kanban' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Kanban
        </button>
        <button
          onClick={() => setCurrentView('a_contacter')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            currentView === 'a_contacter' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Mail className="w-4 h-4" />
          À contacter
        </button>
        <button
          onClick={() => setCurrentView('hot_leads')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            currentView === 'hot_leads' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Flame className="w-4 h-4" />
          Hot Leads 🔥
        </button>
        <button
          onClick={() => setCurrentView('rdv_semaine')}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
            currentView === 'rdv_semaine' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Calendar className="w-4 h-4" />
          RDV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, ville..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0) }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les types</option>
            <option value="EHPAD">EHPAD</option>
            <option value="IME">IME</option>
            <option value="ESAT">ESAT</option>
            <option value="SESSAD">SESSAD</option>
            <option value="FAM">FAM</option>
            <option value="MAS">MAS</option>
            <option value="SAMSAH">SAMSAH</option>
            <option value="SAVS">SAVS</option>
            <option value="ITEP">ITEP</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(statusLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>

          <select
            value={filterDept}
            onChange={(e) => { setFilterDept(e.target.value); setPage(0) }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les départements</option>
            <option value="AISNE">Aisne (02)</option>
            <option value="NORD">Nord (59)</option>
            <option value="OISE">Oise (60)</option>
            <option value="PAS">Pas-de-Calais (62)</option>
            <option value="SOMME">Somme (80)</option>
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
            <span className="text-sm text-gray-600">{selectedIds.length} sélectionné(s)</span>
            <button className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm flex items-center gap-1">
              <Mail className="w-4 h-4" />
              Envoyer séquence
            </button>
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-500 hover:text-gray-700">
              Désélectionner
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
          <span className="ml-3 text-gray-600">Chargement...</span>
        </div>
      ) : currentView === 'kanban' ? (
        /* KANBAN VIEW */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map(status => {
            const columnProspects = prospects.filter(p => p.statut_prospection === status)
            return (
              <div key={status} className="flex-shrink-0 w-72">
                <div className={`rounded-t-lg px-4 py-2 ${statusColors[status]} border-b-2`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{statusLabels[status]}</span>
                    <span className="bg-white/50 px-2 py-0.5 rounded-full text-sm">{columnProspects.length}</span>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-b-lg p-2 min-h-96 space-y-2">
                  {columnProspects.slice(0, 10).map(prospect => (
                    <div 
                      key={prospect.id} 
                      className="bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedProspect(prospect)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs text-white ${typeColors[prospect.etablissement_type] || 'bg-gray-500'}`}>
                          {prospect.etablissement_type}
                        </span>
                        {prospect.score_interet > 30 && <Flame className="w-4 h-4 text-orange-500" />}
                      </div>
                      <p className="font-medium text-gray-900 text-sm truncate">{prospect.etablissement_nom}</p>
                      <p className="text-xs text-gray-500">{prospect.etablissement_ville}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                        <span>{prospect.contact_poste}</span>
                        <span className={`px-1.5 py-0.5 rounded ${emailStatusColors[prospect.email_status]}`}>
                          {prospect.email_status}
                        </span>
                      </div>
                    </div>
                  ))}
                  {columnProspects.length > 10 && (
                    <p className="text-center text-sm text-gray-500 py-2">+{columnProspects.length - 10} autres...</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === filteredProspects.length && filteredProspects.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Établissement</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ville</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProspects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(prospect.id)}
                        onChange={() => toggleSelect(prospect.id)}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-xs">{prospect.etablissement_nom}</p>
                      {prospect.etablissement_telephone && (
                        <p className="text-xs text-gray-500">{prospect.etablissement_telephone}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs text-white ${typeColors[prospect.etablissement_type] || 'bg-gray-500'}`}>
                        {prospect.etablissement_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600">{prospect.etablissement_ville}</p>
                      <p className="text-xs text-gray-400">{prospect.etablissement_departement}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-gray-500">{prospect.contact_poste}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className="text-sm truncate max-w-32">{prospect.contact_email || '-'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs w-fit ${emailStatusColors[prospect.email_status] || 'bg-gray-100'}`}>
                          {prospect.email_status}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[prospect.statut_prospection] || 'bg-gray-100'}`}>
                        {statusLabels[prospect.statut_prospection] || prospect.statut_prospection}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <span className={`text-lg font-bold ${prospect.score_interet > 50 ? 'text-green-600' : prospect.score_interet > 20 ? 'text-yellow-600' : 'text-gray-400'}`}>
                          {prospect.score_interet}
                        </span>
                        {prospect.score_interet > 50 && <Flame className="w-4 h-4 text-orange-500" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedProspect(prospect)} className="p-1 text-gray-400 hover:text-purple-600">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button className="p-1 text-gray-400 hover:text-blue-600">
                          <Edit className="w-4 h-4" />
                        </button>
                        {prospect.contact_email && (
                          <a href={`mailto:${prospect.contact_email}`} className="p-1 text-gray-400 hover:text-green-600">
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                        {prospect.etablissement_telephone && (
                          <a href={`tel:${prospect.etablissement_telephone}`} className="p-1 text-gray-400 hover:text-blue-600">
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalCount > pageSize && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Page {page + 1} sur {Math.ceil(totalCount / pageSize)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Précédent
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={(page + 1) * pageSize >= totalCount}
                  className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 hover:bg-gray-50"
                >
                  Suivant
                </button>
              </div>
            </div>
          )}

          {filteredProspects.length === 0 && !loading && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Aucun prospect trouvé</p>
              <button onClick={loadProspects} className="mt-4 text-purple-600 hover:underline">
                Actualiser
              </button>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 truncate pr-4">{selectedProspect.etablissement_nom}</h2>
              <button onClick={() => setSelectedProspect(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Type</p>
                  <span className={`px-2 py-1 rounded text-xs text-white ${typeColors[selectedProspect.etablissement_type] || 'bg-gray-500'}`}>
                    {selectedProspect.etablissement_type}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Ville</p>
                  <p className="font-medium">{selectedProspect.etablissement_ville}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Département</p>
                  <p className="font-medium">{selectedProspect.etablissement_departement}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Téléphone</p>
                  {selectedProspect.etablissement_telephone ? (
                    <a href={`tel:${selectedProspect.etablissement_telephone}`} className="font-medium text-purple-600 hover:underline">
                      {selectedProspect.etablissement_telephone}
                    </a>
                  ) : <p>-</p>}
                </div>
                <div>
                  <p className="text-sm text-gray-500">Contact</p>
                  <p className="font-medium">{selectedProspect.contact_poste}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{selectedProspect.contact_email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut email</p>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${emailStatusColors[selectedProspect.email_status]}`}>
                    {selectedProspect.email_status}
                  </span>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Statut prospection</p>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedProspect.statut_prospection]}`}>
                    {statusLabels[selectedProspect.statut_prospection]}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedProspect.etablissement_telephone && (
                  <a href={`tel:${selectedProspect.etablissement_telephone}`} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Appeler
                  </a>
                )}
                {selectedProspect.contact_email && (
                  <a href={`mailto:${selectedProspect.contact_email}`} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
