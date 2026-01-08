'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Search, 
  Upload, 
  Download,
  Plus,
  Mail,
  Eye,
  Edit,
  RefreshCw,
  X,
  LayoutGrid,
  List,
  Filter,
  Phone,
  Globe,
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
  etablissement_id: string
  etablissement_nom: string
  etablissement_type: string
  etablissement_ville: string
  etablissement_cp: string
  etablissement_departement: string
  etablissement_telephone: string
  etablissement_site_web: string
  contact_id: string
  contact_prenom: string
  contact_nom: string
  contact_poste: string
  contact_email: string
  email_status: string
  statut_prospection: string
  nb_emails_envoyes: number
  nb_ouvertures: number
  score_interet: number
  notes: string
  source: string
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
  const pageSize = 50

  // Charger les prospects depuis Supabase
  const loadProspects = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('etablissements')
        .select(`
          id,
          nom,
          type,
          ville,
          code_postal,
          departement,
          telephone,
          site_web,
          contacts (
            id,
            prenom,
            nom,
            poste,
            email,
            email_status,
            source,
            prospection (
              statut,
              notes,
              prochaine_action
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })

      // Filtres
      if (filterType !== 'all') {
        query = query.eq('type', filterType)
      }
      if (filterDept !== 'all') {
        query = query.eq('departement', filterDept)
      }
      if (search) {
        query = query.or(`nom.ilike.%${search}%,ville.ilike.%${search}%`)
      }

      // Pagination
      query = query.range(page * pageSize, (page + 1) * pageSize - 1)

      const { data, error, count } = await query

      if (error) {
        console.error('Error loading prospects:', error)
        toast.error('Erreur lors du chargement')
        return
      }

      const formattedProspects: Prospect[] = (data || []).map((etab: any) => {
        const contact = etab.contacts?.[0] || {}
        const prospection = contact.prospection?.[0] || {}
        
        return {
          id: etab.id,
          etablissement_id: etab.id,
          etablissement_nom: etab.nom || '',
          etablissement_type: etab.type || '',
          etablissement_ville: etab.ville || '',
          etablissement_cp: etab.code_postal || '',
          etablissement_departement: etab.departement || '',
          etablissement_telephone: etab.telephone || '',
          etablissement_site_web: etab.site_web || '',
          contact_id: contact.id || '',
          contact_prenom: contact.prenom || '',
          contact_nom: contact.nom || '',
          contact_poste: contact.poste || 'Directeur',
          contact_email: contact.email || '',
          email_status: contact.email_status || 'a_trouver',
          statut_prospection: prospection.statut || 'a_prospecter',
          nb_emails_envoyes: 0,
          nb_ouvertures: 0,
          score_interet: calculateScore(contact, prospection),
          notes: prospection.notes || '',
          source: contact.source || 'finess_import',
        }
      })

      setProspects(formattedProspects)
      setTotalCount(count || 0)
    } catch (err) {
      console.error('Error:', err)
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  // Calculer le score d'intérêt
  const calculateScore = (contact: any, prospection: any) => {
    let score = 0
    if (contact.email) score += 20
    if (contact.email_status === 'valide') score += 30
    if (prospection.statut === 'interesse') score += 40
    if (prospection.statut === 'rdv_pris') score += 60
    return score
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

    // Filtre par statut local
    if (filterStatus !== 'all') {
      filtered = filtered.filter(p => p.statut_prospection === filterStatus)
    }

    // Filtres par vue
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

  // Grouper par statut pour Kanban
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
            {Object.entries(typeStats).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
              <option key={type} value={type}>{type} ({count})</option>
            ))}
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
            <option value="PAS DE CALAIS">Pas-de-Calais (62)</option>
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
            <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm flex items-center gap-1">
              <Download className="w-4 h-4" />
              Exporter
            </button>
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-500 hover:text-gray-700">
              Désélectionner
            </button>
          </div>
        )}
      </div>

      {/* Content based on view */}
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
                    <p className="text-center text-sm text-gray-500 py-2">
                      +{columnProspects.length - 10} autres...
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <>
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
                        <p className="font-medium text-gray-900 truncate max-w-xs" title={prospect.etablissement_nom}>
                          {prospect.etablissement_nom}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {prospect.etablissement_telephone && (
                            <a href={`tel:${prospect.etablissement_telephone}`} className="text-xs text-gray-500 hover:text-purple-600 flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {prospect.etablissement_telephone}
                            </a>
                          )}
                        </div>
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
                        <p className="font-medium">
                          {prospect.contact_prenom} {prospect.contact_nom}
                        </p>
                        <p className="text-xs text-gray-500">{prospect.contact_poste}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm truncate max-w-32" title={prospect.contact_email}>
                            {prospect.contact_email || '-'}
                          </span>
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
                          <button 
                            onClick={() => setSelectedProspect(prospect)}
                            className="p-1 text-gray-400 hover:text-purple-600"
                          >
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
                  Page {page + 1} sur {Math.ceil(totalCount / pageSize)} • {filteredProspects.length} résultats
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
              </div>
            )}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">{selectedProspect.etablissement_nom}</h2>
              <button onClick={() => setSelectedProspect(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              {/* Établissement */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Établissement</h3>
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
                    <p className="text-sm text-gray-500">Code postal</p>
                    <p className="font-medium">{selectedProspect.etablissement_cp || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Téléphone</p>
                    {selectedProspect.etablissement_telephone ? (
                      <a href={`tel:${selectedProspect.etablissement_telephone}`} className="font-medium text-purple-600 hover:underline">
                        {selectedProspect.etablissement_telephone}
                      </a>
                    ) : <p>-</p>}
                  </div>
                </div>
              </div>

              {/* Contact */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Contact</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Nom</p>
                    <p className="font-medium">{selectedProspect.contact_prenom} {selectedProspect.contact_nom || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Poste</p>
                    <p className="font-medium">{selectedProspect.contact_poste}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{selectedProspect.contact_email || '-'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${emailStatusColors[selectedProspect.email_status]}`}>
                        {selectedProspect.email_status}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Prospection */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">Prospection</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Statut</p>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[selectedProspect.statut_prospection]}`}>
                      {statusLabels[selectedProspect.statut_prospection]}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Score</p>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-gray-900">{selectedProspect.score_interet}</span>
                      {selectedProspect.score_interet > 50 && <Flame className="w-5 h-5 text-orange-500" />}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Source</p>
                    <p className="font-medium">{selectedProspect.source}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                {selectedProspect.contact_email && (
                  <a 
                    href={`mailto:${selectedProspect.contact_email}`}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                  >
                    <Mail className="w-4 h-4" />
                    Envoyer email
                  </a>
                )}
                {selectedProspect.etablissement_telephone && (
                  <a 
                    href={`tel:${selectedProspect.etablissement_telephone}`}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Phone className="w-4 h-4" />
                    Appeler
                  </a>
                )}
                <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
