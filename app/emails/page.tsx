'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Mail, Eye, MousePointer, RefreshCw, Search } from 'lucide-react'
import { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface EmailSent {
  id: string
  contact_id: string
  sujet: string
  statut: string
  ouvert_at: string | null
  clique_at: string | null
  created_at: string
  contact?: {
    prenom: string
    nom: string
    email: string
    etablissement?: {
      nom: string
    }
  }
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<EmailSent[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, ouverts: 0, cliques: 0 })

  useEffect(() => {
    loadEmails()
  }, [])

  const loadEmails = async () => {
    setLoading(true)
    try {
      const { data, error, count } = await supabase
        .from('emails_envoyes')
        .select(`
          *,
          contacts (
            prenom,
            nom,
            email,
            etablissements (nom)
          )
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Error:', error)
        setEmails([])
      } else {
        setEmails(data || [])
        
        // Calculer les stats
        const ouverts = (data || []).filter((e: any) => e.ouvert_at).length
        const cliques = (data || []).filter((e: any) => e.clique_at).length
        setStats({ total: count || 0, ouverts, cliques })
      }
    } catch (err) {
      console.error('Error loading emails:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Emails envoyés</h1>
          <p className="text-gray-500 mt-1">Historique et tracking de vos emails</p>
        </div>
        <button 
          onClick={loadEmails}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Mail className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Emails envoyés</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 rounded-lg">
              <Eye className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ouverts</p>
              <p className="text-2xl font-bold text-gray-900">{stats.ouverts}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-orange-100 rounded-lg">
              <MousePointer className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Cliqués</p>
              <p className="text-2xl font-bold text-gray-900">{stats.cliques}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : emails.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun email envoyé</h3>
          <p className="text-gray-500">Les emails envoyés apparaîtront ici avec leur statut de tracking.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Établissement</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sujet</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Statut</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {emails.map((email: any) => (
                <tr key={email.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{email.contact?.prenom} {email.contact?.nom}</p>
                    <p className="text-xs text-gray-500">{email.contact?.email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {email.contact?.etablissements?.nom || '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">
                    {email.sujet || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {email.ouvert_at && <span title="Ouvert"><Eye className="w-4 h-4 text-green-600" /></span>}
                      {email.clique_at && <span title="Cliqué"><MousePointer className="w-4 h-4 text-orange-600" /></span>}
                      {!email.ouvert_at && !email.clique_at && <span className="text-gray-400 text-sm">Envoyé</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-sm">
                    {new Date(email.created_at).toLocaleDateString('fr-FR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
