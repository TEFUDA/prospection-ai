'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { TrendingUp, Phone, Mail, RefreshCw, Star } from 'lucide-react'
import { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Lead {
  id: string
  contact: {
    id: string
    prenom: string
    nom: string
    email: string
    poste: string
    etablissement: {
      nom: string
      ville: string
      telephone: string
    }
  }
  statut: string
  notes: string
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadLeads()
  }, [])

  const loadLeads = async () => {
    setLoading(true)
    try {
      // Récupérer les prospects intéressés ou avec RDV
      const { data, error } = await supabase
        .from('prospection')
        .select(`
          id,
          statut,
          notes,
          contacts (
            id,
            prenom,
            nom,
            email,
            poste,
            etablissements (
              nom,
              ville,
              telephone
            )
          )
        `)
        .in('statut', ['interesse', 'rdv_pris', 'client'])
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error:', error)
      } else {
        const formattedLeads = (data || []).map((p: any) => ({
          id: p.id,
          contact: {
            id: p.contacts?.id || '',
            prenom: p.contacts?.prenom || '',
            nom: p.contacts?.nom || '',
            email: p.contacts?.email || '',
            poste: p.contacts?.poste || 'Directeur',
            etablissement: {
              nom: p.contacts?.etablissements?.nom || '',
              ville: p.contacts?.etablissements?.ville || '',
              telephone: p.contacts?.etablissements?.telephone || ''
            }
          },
          statut: p.statut,
          notes: p.notes || ''
        }))
        setLeads(formattedLeads)
      }
    } catch (err) {
      console.error('Error loading leads:', err)
    } finally {
      setLoading(false)
    }
  }

  const statusColors: Record<string, string> = {
    interesse: 'bg-yellow-100 text-yellow-800',
    rdv_pris: 'bg-purple-100 text-purple-800',
    client: 'bg-green-100 text-green-800'
  }

  const statusLabels: Record<string, string> = {
    interesse: 'Intéressé',
    rdv_pris: 'RDV pris',
    client: 'Client'
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Leads chauds 🔥</h1>
          <p className="text-gray-500 mt-1">Prospects intéressés et opportunités</p>
        </div>
        <button 
          onClick={loadLeads}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <TrendingUp className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun lead chaud</h3>
          <p className="text-gray-500">Les prospects qui répondent ou montrent de l'intérêt apparaîtront ici.</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {leads.map((lead) => (
            <div key={lead.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {lead.contact.prenom} {lead.contact.nom}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[lead.statut]}`}>
                      {statusLabels[lead.statut]}
                    </span>
                    {lead.statut === 'interesse' && <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                  </div>
                  <p className="text-gray-600">{lead.contact.poste} - {lead.contact.etablissement.nom}</p>
                  <p className="text-sm text-gray-500">{lead.contact.etablissement.ville}</p>
                </div>
                <div className="flex gap-2">
                  {lead.contact.email && (
                    <a 
                      href={`mailto:${lead.contact.email}`}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                      title={lead.contact.email}
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                  {lead.contact.etablissement.telephone && (
                    <a 
                      href={`tel:${lead.contact.etablissement.telephone}`}
                      className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                      title={lead.contact.etablissement.telephone}
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
              {lead.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{lead.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
