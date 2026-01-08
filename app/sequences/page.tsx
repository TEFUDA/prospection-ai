'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Mail, Plus, Edit, Trash2, Play, Pause, RefreshCw } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Sequence {
  id: string
  nom: string
  description: string
  active: boolean
  etapes: any[]
  created_at: string
}

export default function SequencesPage() {
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadSequences()
  }, [])

  const loadSequences = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('sequences')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error:', error)
      } else {
        setSequences(data || [])
      }
    } catch (err) {
      console.error('Error loading sequences:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Séquences d'emails</h1>
          <p className="text-gray-500 mt-1">Gérez vos séquences de prospection automatisées</p>
        </div>
        <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nouvelle séquence
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : sequences.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune séquence</h3>
          <p className="text-gray-500 mb-6">Créez votre première séquence d'emails pour démarrer la prospection automatisée.</p>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            Créer une séquence
          </button>
        </div>
      ) : (
        <div className="grid gap-6">
          {sequences.map((seq) => (
            <div key={seq.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{seq.nom}</h3>
                  <p className="text-gray-500 text-sm">{seq.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm ${seq.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {seq.active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="p-2 text-gray-400 hover:text-blue-600">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex gap-4 text-sm text-gray-500">
                <span>{seq.etapes?.length || 0} étapes</span>
                <span>•</span>
                <span>Créée le {new Date(seq.created_at).toLocaleDateString('fr-FR')}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
