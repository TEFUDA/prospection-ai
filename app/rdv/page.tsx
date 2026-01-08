'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Calendar, Phone, Mail, MapPin, RefreshCw, Plus } from 'lucide-react'
import { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface RDV {
  id: string
  contact: {
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
  prochaine_action: string
  notes: string
}

export default function RDVPage() {
  const [rdvs, setRdvs] = useState<RDV[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRDVs()
  }, [])

  const loadRDVs = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('prospection')
        .select(`
          id,
          prochaine_action,
          notes,
          contacts (
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
        .eq('statut', 'rdv_pris')
        .order('prochaine_action', { ascending: true })

      if (error) {
        console.error('Error:', error)
      } else {
        const formattedRDVs = (data || []).map((p: any) => ({
          id: p.id,
          contact: {
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
          prochaine_action: p.prochaine_action,
          notes: p.notes || ''
        }))
        setRdvs(formattedRDVs)
      }
    } catch (err) {
      console.error('Error loading RDVs:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rendez-vous</h1>
          <p className="text-gray-500 mt-1">Gérez vos RDV de démonstration</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={loadRDVs}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Nouveau RDV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : rdvs.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun RDV planifié</h3>
          <p className="text-gray-500 mb-6">Les rendez-vous avec vos prospects apparaîtront ici.</p>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Planifier un RDV
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {rdvs.map((rdv) => (
            <div key={rdv.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="w-5 h-5 text-purple-600" />
                    <span className="font-semibold text-gray-900">
                      {rdv.prochaine_action 
                        ? new Date(rdv.prochaine_action).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                            hour: '2-digit',
                            minute: '2-digit'
                          })
                        : 'Date à définir'
                      }
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    {rdv.contact.prenom} {rdv.contact.nom}
                  </h3>
                  <p className="text-gray-600">{rdv.contact.poste} - {rdv.contact.etablissement.nom}</p>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                    <MapPin className="w-4 h-4" />
                    {rdv.contact.etablissement.ville}
                  </div>
                </div>
                <div className="flex gap-2">
                  {rdv.contact.email && (
                    <a 
                      href={`mailto:${rdv.contact.email}`}
                      className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                  {rdv.contact.etablissement.telephone && (
                    <a 
                      href={`tel:${rdv.contact.etablissement.telephone}`}
                      className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100"
                    >
                      <Phone className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
              {rdv.notes && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">{rdv.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
