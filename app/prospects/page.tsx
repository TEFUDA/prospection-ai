'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Search, Download, Plus, Mail, Eye, Edit, RefreshCw, X, LayoutGrid, List,
  Phone, Flame, Calendar, Users, GripVertical, MousePointer, Send, CheckCircle
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Prospect {
  id: string
  contact_id: string
  prospection_id: string
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
  nb_emails_envoyes: number
  nb_ouvertures: number
  nb_clics: number
  dernier_email: string | null
  score_interet: number
}

interface Template {
  id: string
  nom: string
  sujet: string
  contenu: string
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

const calculateScore = (emailStatus: string, nbEmailsEnvoyes: number, nbOuvertures: number, nbClics: number, statutProspection: string): number => {
  let score = 0
  if (emailStatus === 'valide') score += 10
  if (emailStatus === 'trouve') score += 5
  score += Math.min(nbOuvertures * 10, 30)
  score += Math.min(nbClics * 20, 40)
  if (statutProspection === 'interesse') score += 20
  if (statutProspection === 'rdv_pris') score += 40
  if (statutProspection === 'client') score += 50
  return Math.min(score, 100)
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
  const [draggedProspect, setDraggedProspect] = useState<Prospect | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  
  // Email Modal
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTarget, setEmailTarget] = useState<Prospect | null>(null)
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [emailSubject, setEmailSubject] = useState('')
  const [emailContent, setEmailContent] = useState('')
  const [sending, setSending] = useState(false)
  
  const pageSize = 50

  // Charger les templates
  const loadTemplates = async () => {
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('created_at')
    setTemplates(data || [])
  }

  // Charger les prospects
  const loadProspects = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('etablissements')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })

      if (filterType !== 'all') query = query.eq('type', filterType)
      if (filterDept !== 'all') query = query.ilike('departement', `%${filterDept}%`)
      if (search) query = query.or(`nom.ilike.%${search}%,ville.ilike.%${search}%`)
      query = query.range(page * pageSize, (page + 1) * pageSize - 1)

      const { data: etablissements, error, count } = await query
      if (error) { toast.error('Erreur chargement'); return }

      const etabIds = (etablissements || []).map((e: any) => e.id)
      let contactsMap: Record<string, any> = {}
      let prospectionMap: Record<string, any> = {}
      let emailsMap: Record<string, { sent: number, opened: number, clicked: number, lastDate: string | null }> = {}

      if (etabIds.length > 0) {
        const { data: contacts } = await supabase.from('contacts').select('*').in('etablissement_id', etabIds)
        if (contacts) {
          contacts.forEach((c: any) => { if (!contactsMap[c.etablissement_id]) contactsMap[c.etablissement_id] = c })
          const contactIds = contacts.map((c: any) => c.id)
          if (contactIds.length > 0) {
            const { data: prospections } = await supabase.from('prospection').select('*').in('contact_id', contactIds)
            if (prospections) prospections.forEach((p: any) => { prospectionMap[p.contact_id] = p })
            const { data: emails } = await supabase.from('emails_envoyes').select('contact_id, ouvert_at, clique_at, created_at').in('contact_id', contactIds)
            if (emails) {
              emails.forEach((e: any) => {
                if (!emailsMap[e.contact_id]) emailsMap[e.contact_id] = { sent: 0, opened: 0, clicked: 0, lastDate: null }
                emailsMap[e.contact_id].sent++
                if (e.ouvert_at) emailsMap[e.contact_id].opened++
                if (e.clique_at) emailsMap[e.contact_id].clicked++
                if (!emailsMap[e.contact_id].lastDate || e.created_at > emailsMap[e.contact_id].lastDate) emailsMap[e.contact_id].lastDate = e.created_at
              })
            }
          }
        }
      }

      const formattedProspects: Prospect[] = (etablissements || []).map((etab: any) => {
        const contact = contactsMap[etab.id] || {}
        const prospection = prospectionMap[contact.id] || {}
        const emailStats = emailsMap[contact.id] || { sent: 0, opened: 0, clicked: 0, lastDate: null }
        const emailStatus = contact.email_status || 'a_trouver'
        const statutProspection = prospection.statut || 'a_prospecter'
        return {
          id: etab.id, contact_id: contact.id || '', prospection_id: prospection.id || '',
          etablissement_nom: etab.nom || '', etablissement_type: etab.type || '',
          etablissement_ville: etab.ville || '', etablissement_cp: etab.code_postal || '',
          etablissement_departement: etab.departement || '', etablissement_telephone: etab.telephone || '',
          contact_poste: contact.poste || 'Directeur', contact_email: contact.email || '',
          email_status: emailStatus, statut_prospection: statutProspection,
          nb_emails_envoyes: emailStats.sent, nb_ouvertures: emailStats.opened,
          nb_clics: emailStats.clicked, dernier_email: emailStats.lastDate,
          score_interet: calculateScore(emailStatus, emailStats.sent, emailStats.opened, emailStats.clicked, statutProspection),
        }
      })

      setProspects(formattedProspects)
      setTotalCount(count || 0)
    } catch (err: any) {
      toast.error('Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProspects(); loadTemplates() }, [page, filterType, filterDept])
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); loadProspects() }, 500)
    return () => clearTimeout(timer)
  }, [search])

  // DRAG & DROP
  const handleDragStart = (e: React.DragEvent, prospect: Prospect) => { setDraggedProspect(prospect); e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver = (e: React.DragEvent, status: string) => { e.preventDefault(); setDragOverColumn(status) }
  const handleDragLeave = () => { setDragOverColumn(null) }
  const handleDrop = async (e: React.DragEvent, newStatus: string) => {
    e.preventDefault(); setDragOverColumn(null)
    if (!draggedProspect || draggedProspect.statut_prospection === newStatus) { setDraggedProspect(null); return }
    const prospectToUpdate = draggedProspect; setDraggedProspect(null)
    setProspects(prev => prev.map(p => p.id === prospectToUpdate.id ? { ...p, statut_prospection: newStatus, score_interet: calculateScore(p.email_status, p.nb_emails_envoyes, p.nb_ouvertures, p.nb_clics, newStatus) } : p))
    try {
      if (prospectToUpdate.prospection_id) {
        await supabase.from('prospection').update({ statut: newStatus, derniere_action: new Date().toISOString() }).eq('id', prospectToUpdate.prospection_id)
      } else if (prospectToUpdate.contact_id) {
        await supabase.from('prospection').insert({ contact_id: prospectToUpdate.contact_id, statut: newStatus })
      }
      toast.success(`Statut: ${statusLabels[newStatus]}`)
    } catch (err) { toast.error('Erreur'); loadProspects() }
  }
  const handleDragEnd = () => { setDraggedProspect(null); setDragOverColumn(null) }

  const changeStatus = async (prospect: Prospect, newStatus: string) => {
    if (prospect.statut_prospection === newStatus) return
    setProspects(prev => prev.map(p => p.id === prospect.id ? { ...p, statut_prospection: newStatus, score_interet: calculateScore(p.email_status, p.nb_emails_envoyes, p.nb_ouvertures, p.nb_clics, newStatus) } : p))
    try {
      if (prospect.prospection_id) await supabase.from('prospection').update({ statut: newStatus, derniere_action: new Date().toISOString() }).eq('id', prospect.prospection_id)
      else if (prospect.contact_id) await supabase.from('prospection').insert({ contact_id: prospect.contact_id, statut: newStatus })
      toast.success(`Statut: ${statusLabels[newStatus]}`)
    } catch (err) { toast.error('Erreur'); loadProspects() }
  }

  // ENVOI EMAIL
  const openEmailModal = (prospect: Prospect) => {
    if (!prospect.contact_email) { toast.error('Pas d\'email pour ce contact'); return }
    setEmailTarget(prospect)
    setSelectedTemplate('')
    setEmailSubject('')
    setEmailContent('')
    setShowEmailModal(true)
  }

  const selectTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setSelectedTemplate(templateId)
      // Remplacer les variables
      let subject = template.sujet
      let content = template.contenu
      if (emailTarget) {
        content = content.replace(/\{\{nom_etablissement\}\}/g, emailTarget.etablissement_nom)
        content = content.replace(/\{\{ville\}\}/g, emailTarget.etablissement_ville)
        content = content.replace(/\{\{type\}\}/g, emailTarget.etablissement_type)
      }
      setEmailSubject(subject)
      setEmailContent(content)
    }
  }

  const sendEmail = async () => {
    if (!emailTarget || !emailSubject || !emailContent) {
      toast.error('Remplissez tous les champs')
      return
    }

    setSending(true)
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact_id: emailTarget.contact_id,
          to_email: emailTarget.contact_email,
          to_name: emailTarget.etablissement_nom,
          subject: emailSubject,
          html_content: emailContent,
          template_id: selectedTemplate || null,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error)

      toast.success('Email envoyé avec succès!')
      setShowEmailModal(false)
      
      // Mettre à jour localement
      setProspects(prev => prev.map(p => 
        p.id === emailTarget.id 
          ? { ...p, nb_emails_envoyes: p.nb_emails_envoyes + 1, statut_prospection: 'en_cours' }
          : p
      ))
    } catch (err: any) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setSending(false)
    }
  }

  // Envoi groupé
  const sendBulkEmails = async () => {
    const selectedProspects = prospects.filter(p => selectedIds.includes(p.id) && p.contact_email)
    if (selectedProspects.length === 0) { toast.error('Aucun prospect avec email sélectionné'); return }
    
    const template = templates[0]
    if (!template) { toast.error('Créez d\'abord un template'); return }
    
    if (!confirm(`Envoyer l'email "${template.sujet}" à ${selectedProspects.length} contacts ?`)) return

    let sent = 0
    for (const prospect of selectedProspects) {
      try {
        let content = template.contenu
          .replace(/\{\{nom_etablissement\}\}/g, prospect.etablissement_nom)
          .replace(/\{\{ville\}\}/g, prospect.etablissement_ville)

        await fetch('/api/emails/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contact_id: prospect.contact_id,
            to_email: prospect.contact_email,
            to_name: prospect.etablissement_nom,
            subject: template.sujet,
            html_content: content,
            template_id: template.id,
          }),
        })
        sent++
      } catch (err) {
        console.error('Error sending to', prospect.contact_email)
      }
    }

    toast.success(`${sent} emails envoyés!`)
    setSelectedIds([])
    loadProspects()
  }

  const getFilteredProspects = () => {
    let filtered = prospects
    if (filterStatus !== 'all') filtered = filtered.filter(p => p.statut_prospection === filterStatus)
    switch (currentView) {
      case 'a_contacter': filtered = filtered.filter(p => p.statut_prospection === 'a_prospecter' && (p.email_status === 'valide' || p.email_status === 'trouve')); break
      case 'hot_leads': filtered = filtered.filter(p => p.score_interet >= 30); break
      case 'rdv_semaine': filtered = filtered.filter(p => p.statut_prospection === 'rdv_pris'); break
    }
    return filtered
  }

  const filteredProspects = getFilteredProspects()
  const kanbanColumns = ['a_prospecter', 'en_cours', 'interesse', 'rdv_pris', 'client']
  const hotLeadsCount = prospects.filter(p => p.score_interet >= 30).length

  const toggleSelectAll = () => { selectedIds.length === filteredProspects.length ? setSelectedIds([]) : setSelectedIds(filteredProspects.map(p => p.id)) }
  const toggleSelect = (id: string) => { setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]) }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Prospects</h1>
          <p className="text-gray-500 mt-1">{totalCount} établissements au total</p>
        </div>
        <div className="flex gap-3">
          <button onClick={loadProspects} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Actualiser
          </button>
          <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" /> Exporter
          </button>
        </div>
      </div>

      {/* Vue Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 pb-4">
        {[
          { key: 'all', icon: List, label: `Tous (${totalCount})` },
          { key: 'kanban', icon: LayoutGrid, label: 'Kanban' },
          { key: 'a_contacter', icon: Mail, label: 'À contacter' },
          { key: 'hot_leads', icon: Flame, label: `Hot Leads 🔥 (${hotLeadsCount})` },
          { key: 'rdv_semaine', icon: Calendar, label: 'RDV' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setCurrentView(tab.key as ViewType)}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${currentView === tab.key ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'}`}>
            <tab.icon className="w-4 h-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-64">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Rechercher par nom, ville..." value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(0) }} className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="all">Tous les types</option>
            {['EHPAD', 'IME', 'ESAT', 'SESSAD', 'FAM', 'MAS', 'SAMSAH', 'SAVS', 'ITEP'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterDept} onChange={(e) => { setFilterDept(e.target.value); setPage(0) }} className="px-4 py-2 border border-gray-300 rounded-lg">
            <option value="all">Tous les départements</option>
            {[['AISNE', 'Aisne (02)'], ['NORD', 'Nord (59)'], ['OISE', 'Oise (60)'], ['PAS', 'Pas-de-Calais (62)'], ['SOMME', 'Somme (80)']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {selectedIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 flex items-center gap-4">
            <span className="text-sm text-gray-600">{selectedIds.length} sélectionné(s)</span>
            <button onClick={sendBulkEmails} className="px-3 py-1 bg-purple-600 text-white rounded-lg text-sm flex items-center gap-1">
              <Send className="w-4 h-4" /> Envoyer séquence
            </button>
            <button onClick={() => setSelectedIds([])} className="text-sm text-gray-500 hover:text-gray-700">Désélectionner</button>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><RefreshCw className="w-8 h-8 animate-spin text-purple-600" /></div>
      ) : currentView === 'kanban' ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {kanbanColumns.map(status => {
            const columnProspects = prospects.filter(p => p.statut_prospection === status)
            const isOver = dragOverColumn === status
            return (
              <div key={status} className="flex-shrink-0 w-72" onDragOver={(e) => handleDragOver(e, status)} onDragLeave={handleDragLeave} onDrop={(e) => handleDrop(e, status)}>
                <div className={`rounded-t-lg px-4 py-2 ${statusColors[status]} border-b-2`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{statusLabels[status]}</span>
                    <span className="bg-white/50 px-2 py-0.5 rounded-full text-sm">{columnProspects.length}</span>
                  </div>
                </div>
                <div className={`bg-gray-50 rounded-b-lg p-2 min-h-96 space-y-2 transition-colors ${isOver ? 'bg-purple-50 ring-2 ring-purple-300' : ''}`}>
                  {columnProspects.slice(0, 15).map(prospect => (
                    <div key={prospect.id} draggable onDragStart={(e) => handleDragStart(e, prospect)} onDragEnd={handleDragEnd}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-gray-200 cursor-grab hover:shadow-md transition-all ${draggedProspect?.id === prospect.id ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded text-xs text-white ${typeColors[prospect.etablissement_type] || 'bg-gray-500'}`}>{prospect.etablissement_type}</span>
                        <div className="flex items-center gap-1">
                          {prospect.score_interet >= 30 && <Flame className="w-4 h-4 text-orange-500" />}
                          <GripVertical className="w-4 h-4 text-gray-300" />
                        </div>
                      </div>
                      <p className="font-medium text-gray-900 text-sm truncate">{prospect.etablissement_nom}</p>
                      <p className="text-xs text-gray-500">{prospect.etablissement_ville}</p>
                      {prospect.nb_emails_envoyes > 0 && (
                        <div className="mt-2 flex items-center gap-3 text-xs">
                          <span className="text-gray-500"><Send className="w-3 h-3 inline" /> {prospect.nb_emails_envoyes}</span>
                          <span className={prospect.nb_ouvertures > 0 ? 'text-green-600' : 'text-gray-400'}><Eye className="w-3 h-3 inline" /> {prospect.nb_ouvertures}</span>
                          <span className={prospect.nb_clics > 0 ? 'text-orange-600' : 'text-gray-400'}><MousePointer className="w-3 h-3 inline" /> {prospect.nb_clics}</span>
                        </div>
                      )}
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`px-1.5 py-0.5 rounded text-xs ${emailStatusColors[prospect.email_status]}`}>{prospect.email_status}</span>
                        <button onClick={(e) => { e.stopPropagation(); openEmailModal(prospect) }} className="text-purple-600 hover:bg-purple-50 p-1 rounded" title="Envoyer email">
                          <Mail className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {columnProspects.length > 15 && <p className="text-center text-sm text-gray-500 py-2">+{columnProspects.length - 15} autres...</p>}
                  {columnProspects.length === 0 && <p className="text-center text-sm text-gray-400 py-8">Déposez ici</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 text-left w-10"><input type="checkbox" checked={selectedIds.length === filteredProspects.length && filteredProspects.length > 0} onChange={toggleSelectAll} className="rounded border-gray-300 text-purple-600" /></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Établissement</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ville</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase"><Send className="w-3 h-3 inline" /> <Eye className="w-3 h-3 inline" /> <MousePointer className="w-3 h-3 inline" /></th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Score</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredProspects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(prospect.id)} onChange={() => toggleSelect(prospect.id)} className="rounded border-gray-300 text-purple-600" /></td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-gray-900 truncate max-w-48">{prospect.etablissement_nom}</p>
                      <p className="text-xs text-gray-500">{prospect.etablissement_telephone}</p>
                    </td>
                    <td className="px-3 py-3"><span className={`px-2 py-1 rounded text-xs text-white ${typeColors[prospect.etablissement_type] || 'bg-gray-500'}`}>{prospect.etablissement_type}</span></td>
                    <td className="px-3 py-3"><p className="text-gray-600 text-sm">{prospect.etablissement_ville}</p></td>
                    <td className="px-3 py-3">
                      <p className="text-sm truncate max-w-32">{prospect.contact_email || '-'}</p>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${emailStatusColors[prospect.email_status]}`}>{prospect.email_status}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-gray-600">{prospect.nb_emails_envoyes}</span>
                        <span className={prospect.nb_ouvertures > 0 ? 'text-green-600 font-medium' : 'text-gray-400'}>{prospect.nb_ouvertures}</span>
                        <span className={prospect.nb_clics > 0 ? 'text-orange-600 font-medium' : 'text-gray-400'}>{prospect.nb_clics}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <select value={prospect.statut_prospection} onChange={(e) => changeStatus(prospect, e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 cursor-pointer ${statusColors[prospect.statut_prospection]}`}>
                        {Object.entries(statusLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <span className={`text-lg font-bold ${prospect.score_interet >= 50 ? 'text-green-600' : prospect.score_interet >= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>{prospect.score_interet}</span>
                        {prospect.score_interet >= 50 && <Flame className="w-4 h-4 text-orange-500" />}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedProspect(prospect)} className="p-1 text-gray-400 hover:text-purple-600"><Eye className="w-4 h-4" /></button>
                        {prospect.contact_email && (
                          <button onClick={() => openEmailModal(prospect)} className="p-1 text-gray-400 hover:text-green-600" title="Envoyer email"><Mail className="w-4 h-4" /></button>
                        )}
                        {prospect.etablissement_telephone && (
                          <a href={`tel:${prospect.etablissement_telephone}`} className="p-1 text-gray-400 hover:text-blue-600"><Phone className="w-4 h-4" /></a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCount > pageSize && (
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
              <p className="text-sm text-gray-600">Page {page + 1} sur {Math.ceil(totalCount / pageSize)}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50">Précédent</button>
                <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * pageSize >= totalCount} className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50">Suivant</button>
              </div>
            </div>
          )}
          {filteredProspects.length === 0 && <div className="text-center py-12"><Users className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">Aucun prospect trouvé</p></div>}
        </div>
      )}

      {/* Modal Envoi Email */}
      {showEmailModal && emailTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Envoyer un email</h2>
                <p className="text-gray-500 text-sm">{emailTarget.etablissement_nom} - {emailTarget.contact_email}</p>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Choisir un template</label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => selectTemplate(t.id)}
                      className={`p-3 text-left rounded-lg border-2 transition-colors ${selectedTemplate === t.id ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <p className="font-medium text-sm">{t.nom}</p>
                      <p className="text-xs text-gray-500 truncate">{t.sujet}</p>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet</label>
                <input type="text" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500" placeholder="Sujet de l'email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu</label>
                <textarea value={emailContent} onChange={(e) => setEmailContent(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 h-64 font-mono text-sm" placeholder="Contenu HTML..." />
              </div>
              {emailContent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Aperçu</label>
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: emailContent }} />
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button onClick={sendEmail} disabled={sending || !emailSubject || !emailContent}
                  className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2">
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? 'Envoi...' : 'Envoyer'}
                </button>
                <button onClick={() => setShowEmailModal(false)} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détail */}
      {selectedProspect && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 truncate pr-4">{selectedProspect.etablissement_nom}</h2>
              <button onClick={() => setSelectedProspect(null)} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-gray-500">Type</p><span className={`px-2 py-1 rounded text-xs text-white ${typeColors[selectedProspect.etablissement_type]}`}>{selectedProspect.etablissement_type}</span></div>
                <div><p className="text-sm text-gray-500">Ville</p><p className="font-medium">{selectedProspect.etablissement_ville}</p></div>
                <div><p className="text-sm text-gray-500">Téléphone</p>{selectedProspect.etablissement_telephone ? <a href={`tel:${selectedProspect.etablissement_telephone}`} className="font-medium text-purple-600">{selectedProspect.etablissement_telephone}</a> : <p>-</p>}</div>
                <div><p className="text-sm text-gray-500">Email</p><p className="font-medium">{selectedProspect.contact_email || '-'}</p></div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">📧 Historique emails</h3>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div><div className="text-2xl font-bold text-gray-900">{selectedProspect.nb_emails_envoyes}</div><div className="text-xs text-gray-500">Envoyés</div></div>
                  <div><div className={`text-2xl font-bold ${selectedProspect.nb_ouvertures > 0 ? 'text-green-600' : 'text-gray-400'}`}>{selectedProspect.nb_ouvertures}</div><div className="text-xs text-gray-500">Ouverts</div></div>
                  <div><div className={`text-2xl font-bold ${selectedProspect.nb_clics > 0 ? 'text-orange-600' : 'text-gray-400'}`}>{selectedProspect.nb_clics}</div><div className="text-xs text-gray-500">Clics</div></div>
                </div>
              </div>
              <div className="flex items-center justify-between bg-purple-50 rounded-lg p-4">
                <div><p className="text-sm text-purple-600">Score d'intérêt</p></div>
                <div className="flex items-center gap-2">
                  <span className={`text-3xl font-bold ${selectedProspect.score_interet >= 50 ? 'text-green-600' : selectedProspect.score_interet >= 30 ? 'text-yellow-600' : 'text-gray-400'}`}>{selectedProspect.score_interet}</span>
                  {selectedProspect.score_interet >= 50 && <Flame className="w-6 h-6 text-orange-500" />}
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                {selectedProspect.contact_email && (
                  <button onClick={() => { setSelectedProspect(null); openEmailModal(selectedProspect) }} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Envoyer email
                  </button>
                )}
                {selectedProspect.etablissement_telephone && (
                  <a href={`tel:${selectedProspect.etablissement_telephone}`} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Appeler
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
