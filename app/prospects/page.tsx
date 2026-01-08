'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Search, 
  Filter, 
  Upload, 
  Download,
  Plus,
  Mail,
  Eye,
  Trash2,
  Edit,
  RefreshCw,
  X
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

// Client Supabase côté client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

// Types
interface Prospect {
  id: string
  etablissement_id: string
  etablissement_nom: string
  etablissement_type: string
  etablissement_ville: string
  etablissement_telephone: string
  contact_id: string
  contact_prenom: string
  contact_nom: string
  contact_poste: string
  contact_email: string
  email_status: string
  statut_prospection: string
}

const statusColors: Record<string, string> = {
  a_prospecter: 'bg-gray-100 text-gray-800',
  en_cours: 'bg-blue-100 text-blue-800',
  interesse: 'bg-yellow-100 text-yellow-800',
  rdv_pris: 'bg-purple-100 text-purple-800',
  client: 'bg-green-100 text-green-800',
  pas_interesse: 'bg-red-100 text-red-800',
}

const statusLabels: Record<string, string> = {
  a_prospecter: 'À prospecter',
  en_cours: 'En cours',
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

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterDept, setFilterDept] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const pageSize = 50
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Charger les prospects depuis Supabase
  const loadProspects = async () => {
    setLoading(true)
    try {
      // Requête avec jointures
      let query = supabase
        .from('etablissements')
        .select(`
          id,
          nom,
          type,
          ville,
          departement,
          telephone,
          contacts (
            id,
            prenom,
            nom,
            poste,
            email,
            email_status,
            prospection (
              statut
            )
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1)

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

      const { data, error, count } = await query

      if (error) {
        console.error('Error loading prospects:', error)
        toast.error('Erreur lors du chargement')
        return
      }

      // Transformer les données
      const formattedProspects: Prospect[] = (data || []).map((etab: any) => {
        const contact = etab.contacts?.[0] || {}
        const prospection = contact.prospection?.[0] || {}
        
        return {
          id: etab.id,
          etablissement_id: etab.id,
          etablissement_nom: etab.nom || '',
          etablissement_type: etab.type || '',
          etablissement_ville: etab.ville || '',
          etablissement_telephone: etab.telephone || '',
          contact_id: contact.id || '',
          contact_prenom: contact.prenom || '',
          contact_nom: contact.nom || '',
          contact_poste: contact.poste || '',
          contact_email: contact.email || '',
          email_status: contact.email_status || 'a_trouver',
          statut_prospection: prospection.statut || 'a_prospecter',
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

  // Charger au montage et quand les filtres changent
  useEffect(() => {
    loadProspects()
  }, [page, filterType, filterDept])

  // Recherche avec debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0)
      loadProspects()
    }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // Filtrer localement par statut
  const filteredProspects = prospects.filter(p => {
    return filterStatus === 'all' || p.statut_prospection === filterStatus
  })

  // Sélectionner tout
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProspects.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredProspects.map(p => p.id))
    }
  }

  // Toggle sélection
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  // Types uniques pour le filtre
  const uniqueTypes = [...new Set(prospects.map(p => p.etablissement_type))].filter(Boolean)

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 mt-1">
            {totalCount} établissements au total
            {filteredProspects.length !== totalCount && ` (${filteredProspects.length} affichés)`}
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
          <button 
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Importer
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
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

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(0) }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les types</option>
            <option value="EHPAD">EHPAD ({prospects.filter(p => p.etablissement_type === 'EHPAD').length})</option>
            <option value="IME">IME</option>
            <option value="ESAT">ESAT</option>
            <option value="SESSAD">SESSAD</option>
            <option value="FAM">FAM</option>
            <option value="MAS">MAS</option>
            <option value="SAMSAH">SAMSAH</option>
            <option value="SAVS">SAVS</option>
            <option value="ITEP">ITEP</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="a_prospecter">À prospecter</option>
            <option value="en_cours">En cours</option>
            <option value="interesse">Intéressé</option>
            <option value="rdv_pris">RDV pris</option>
            <option value="client">Client</option>
          </select>

          {/* Département filter */}
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

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {selectedIds.length} sélectionné(s)
            </span>
            <button className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm flex items-center gap-1">
              <Mail className="w-4 h-4" />
              Envoyer email
            </button>
            <button className="px-3 py-1 border border-gray-300 rounded-lg text-sm flex items-center gap-1">
              <Download className="w-4 h-4" />
              Exporter
            </button>
            <button 
              onClick={() => setSelectedIds([])}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Désélectionner
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
            <span className="ml-3 text-gray-600">Chargement...</span>
          </div>
        ) : (
          <>
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
                        {prospect.etablissement_telephone && (
                          <p className="text-xs text-gray-500">{prospect.etablissement_telephone}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                          {prospect.etablissement_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {prospect.etablissement_ville}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {prospect.contact_prenom} {prospect.contact_nom}
                        </p>
                        <p className="text-xs text-gray-500">{prospect.contact_poste || 'Directeur'}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm truncate max-w-32" title={prospect.contact_email}>
                            {prospect.contact_email || '-'}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${emailStatusColors[prospect.email_status] || 'bg-gray-100'}`}>
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
                          <button className="p-1 text-gray-400 hover:text-purple-600" title="Voir">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button className="p-1 text-gray-400 hover:text-blue-600" title="Éditer">
                            <Edit className="w-4 h-4" />
                          </button>
                          {prospect.contact_email && (
                            <button className="p-1 text-gray-400 hover:text-green-600" title="Envoyer email">
                              <Mail className="w-4 h-4" />
                            </button>
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
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={(page + 1) * pageSize >= totalCount}
                    className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}

            {filteredProspects.length === 0 && !loading && (
              <div className="text-center py-12">
                <p className="text-gray-500">Aucun prospect trouvé</p>
                <button 
                  onClick={loadProspects}
                  className="mt-4 text-purple-600 hover:text-purple-800"
                >
                  Actualiser
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Importer des prospects</h3>
              <button 
                onClick={() => setShowImportModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-gray-600 text-sm mb-4">
              L'import se fait automatiquement via le CRON. 
              Cliquez sur "Actualiser" pour voir les nouveaux prospects.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                Fermer
              </button>
              <button 
                onClick={() => { setShowImportModal(false); loadProspects() }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg"
              >
                Actualiser
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
