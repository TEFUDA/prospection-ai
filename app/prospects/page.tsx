'use client'

import { useState, useRef } from 'react'
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
  ChevronDown,
  X
} from 'lucide-react'
import toast from 'react-hot-toast'

// Types
interface Prospect {
  id: string
  etablissement_nom: string
  etablissement_type: string
  etablissement_ville: string
  contact_prenom: string
  contact_nom: string
  contact_poste: string
  contact_email: string
  email_status: string
  statut_prospection: string
  nb_emails_envoyes: number
  nb_ouvertures: number
  score_interet: number
}

// Mock data
const mockProspects: Prospect[] = [
  {
    id: '1',
    etablissement_nom: 'EHPAD Résidence du Parc',
    etablissement_type: 'EHPAD',
    etablissement_ville: 'Amiens',
    contact_prenom: 'Marie',
    contact_nom: 'Dupont',
    contact_poste: 'Directrice',
    contact_email: 'marie.dupont@residenceduparc.fr',
    email_status: 'valid',
    statut_prospection: 'sequence_en_cours',
    nb_emails_envoyes: 2,
    nb_ouvertures: 3,
    score_interet: 55
  },
  {
    id: '2',
    etablissement_nom: 'IME de la Somme',
    etablissement_type: 'IME',
    etablissement_ville: 'Dury',
    contact_prenom: 'Thierry',
    contact_nom: 'Eteve',
    contact_poste: 'Directeur',
    contact_email: 'teteve@adsea80.org',
    email_status: 'valid',
    statut_prospection: 'a_prospecter',
    nb_emails_envoyes: 0,
    nb_ouvertures: 0,
    score_interet: 0
  },
  {
    id: '3',
    etablissement_nom: 'ESAT Abbeville',
    etablissement_type: 'ESAT',
    etablissement_ville: 'Abbeville',
    contact_prenom: 'Sophie',
    contact_nom: 'Martin',
    contact_poste: 'IDEC',
    contact_email: '',
    email_status: 'a_trouver',
    statut_prospection: 'a_prospecter',
    nb_emails_envoyes: 0,
    nb_ouvertures: 0,
    score_interet: 0
  },
]

const statusColors: Record<string, string> = {
  a_prospecter: 'badge-gray',
  sequence_en_cours: 'badge-blue',
  repondu: 'badge-yellow',
  rdv: 'badge-purple',
  poc: 'badge-orange',
  client: 'badge-green',
  refus: 'badge-red',
}

const statusLabels: Record<string, string> = {
  a_prospecter: 'À prospecter',
  sequence_en_cours: 'Séquence en cours',
  repondu: 'A répondu',
  rdv: 'RDV planifié',
  poc: 'POC',
  client: 'Client',
  refus: 'Refus',
}

const emailStatusColors: Record<string, string> = {
  valid: 'badge-green',
  a_trouver: 'badge-gray',
  a_verifier: 'badge-yellow',
  invalid: 'badge-red',
}

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>(mockProspects)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [showImportModal, setShowImportModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Filtrer les prospects
  const filteredProspects = prospects.filter(p => {
    const matchSearch = search === '' || 
      p.etablissement_nom.toLowerCase().includes(search.toLowerCase()) ||
      p.contact_nom.toLowerCase().includes(search.toLowerCase()) ||
      p.contact_email.toLowerCase().includes(search.toLowerCase())
    
    const matchType = filterType === 'all' || p.etablissement_type === filterType
    const matchStatus = filterStatus === 'all' || p.statut_prospection === filterStatus
    
    return matchSearch && matchType && matchStatus
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

  // Import CSV
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const csv = event.target?.result as string
      // TODO: Parse CSV and send to API
      toast.success(`Fichier ${file.name} importé avec succès!`)
      setShowImportModal(false)
    }
    reader.readAsText(file)
  }

  // Envoyer email aux sélectionnés
  const sendEmailToSelected = async () => {
    if (selectedIds.length === 0) {
      toast.error('Sélectionnez au moins un prospect')
      return
    }

    const validProspects = prospects.filter(
      p => selectedIds.includes(p.id) && p.email_status === 'valid' && p.contact_email
    )

    if (validProspects.length === 0) {
      toast.error('Aucun prospect sélectionné avec un email valide')
      return
    }

    toast.loading(`Envoi en cours à ${validProspects.length} prospects...`)
    
    // TODO: Call API to send emails
    setTimeout(() => {
      toast.dismiss()
      toast.success(`${validProspects.length} emails envoyés!`)
      setSelectedIds([])
    }, 2000)
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 mt-1">{prospects.length} prospects au total</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowImportModal(true)}
            className="btn btn-secondary"
          >
            <Upload className="w-4 h-4 mr-2" />
            Importer CSV
          </button>
          <button className="btn btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Ajouter
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher par nom, établissement, email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les types</option>
            <option value="EHPAD">EHPAD</option>
            <option value="IME">IME</option>
            <option value="ESAT">ESAT</option>
            <option value="SESSAD">SESSAD</option>
            <option value="FAM">FAM</option>
            <option value="MAS">MAS</option>
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
          >
            <option value="all">Tous les statuts</option>
            <option value="a_prospecter">À prospecter</option>
            <option value="sequence_en_cours">Séquence en cours</option>
            <option value="repondu">A répondu</option>
            <option value="rdv">RDV</option>
            <option value="poc">POC</option>
            <option value="client">Client</option>
          </select>
        </div>

        {/* Bulk actions */}
        {selectedIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {selectedIds.length} sélectionné(s)
            </span>
            <button 
              onClick={sendEmailToSelected}
              className="btn btn-primary text-sm py-1"
            >
              <Mail className="w-4 h-4 mr-1" />
              Envoyer email
            </button>
            <button className="btn btn-secondary text-sm py-1">
              <Download className="w-4 h-4 mr-1" />
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
      <div className="card p-0 overflow-hidden">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th className="w-12">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredProspects.length && filteredProspects.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                </th>
                <th>Établissement</th>
                <th>Type</th>
                <th>Contact</th>
                <th>Email</th>
                <th>Statut</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProspects.map((prospect) => (
                <tr key={prospect.id} className="hover:bg-gray-50">
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(prospect.id)}
                      onChange={() => toggleSelect(prospect.id)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                  </td>
                  <td>
                    <div>
                      <p className="font-medium text-gray-900">{prospect.etablissement_nom}</p>
                      <p className="text-xs text-gray-500">{prospect.etablissement_ville}</p>
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-blue">{prospect.etablissement_type}</span>
                  </td>
                  <td>
                    <div>
                      <p className="font-medium">{prospect.contact_prenom} {prospect.contact_nom}</p>
                      <p className="text-xs text-gray-500">{prospect.contact_poste}</p>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{prospect.contact_email || '-'}</span>
                      <span className={`badge ${emailStatusColors[prospect.email_status]}`}>
                        {prospect.email_status}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${statusColors[prospect.statut_prospection]}`}>
                      {statusLabels[prospect.statut_prospection]}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${
                        prospect.score_interet > 50 ? 'text-green-600' :
                        prospect.score_interet > 20 ? 'text-yellow-600' :
                        'text-gray-400'
                      }`}>
                        {prospect.score_interet}
                      </span>
                      {prospect.score_interet > 50 && <span>🔥</span>}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <button className="p-1 text-gray-400 hover:text-purple-600" title="Voir">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button className="p-1 text-gray-400 hover:text-blue-600" title="Éditer">
                        <Edit className="w-4 h-4" />
                      </button>
                      {prospect.contact_email && prospect.email_status === 'valid' && (
                        <button className="p-1 text-gray-400 hover:text-green-600" title="Envoyer email">
                          <Mail className="w-4 h-4" />
                        </button>
                      )}
                      <button className="p-1 text-gray-400 hover:text-red-600" title="Supprimer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredProspects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun prospect trouvé</p>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 animate-fade-in">
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
              Importez un fichier CSV avec les colonnes : etablissement_nom, etablissement_type, 
              etablissement_ville, contact_prenom, contact_nom, contact_poste, contact_email
            </p>

            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-500 cursor-pointer transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
              <p className="text-sm text-gray-600">
                Cliquez pour sélectionner un fichier CSV
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleImportCSV}
                className="hidden"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button 
                onClick={() => setShowImportModal(false)}
                className="btn btn-secondary"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
