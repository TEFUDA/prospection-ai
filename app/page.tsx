'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Users, 
  Mail, 
  MousePointer, 
  Calendar,
  TrendingUp,
  Send,
  Eye,
  MessageSquare,
  RefreshCw,
  Play,
  Zap
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Stats {
  totalProspects: number
  totalContacts: number
  emailsAtrouver: number
  emailsTrouves: number
  emailsValides: number
  rdvPlanifies: number
  pocEnCours: number
  clients: number
}

interface PipelineData {
  statut: string
  count: number
  label: string
  color: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    totalContacts: 0,
    emailsAtrouver: 0,
    emailsTrouves: 0,
    emailsValides: 0,
    rdvPlanifies: 0,
    pocEnCours: 0,
    clients: 0
  })
  const [pipeline, setPipeline] = useState<PipelineData[]>([])
  const [loading, setLoading] = useState(true)
  const [runningCron, setRunningCron] = useState(false)

  useEffect(() => {
    fetchStats()
    fetchPipeline()
  }, [])

  const fetchStats = async () => {
    try {
      // Total établissements
      const { count: totalProspects } = await supabase
        .from('etablissements')
        .select('*', { count: 'exact', head: true })

      // Total contacts
      const { count: totalContacts } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      // Emails à trouver
      const { count: emailsAtrouver } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('email_status', 'a_trouver')

      // Emails trouvés
      const { count: emailsTrouves } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('email_status', 'trouve')

      // Emails validés
      const { count: emailsValides } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .eq('email_status', 'valide')

      // RDV planifiés
      const { count: rdvPlanifies } = await supabase
        .from('prospection')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'rdv_pris')

      // POC en cours
      const { count: pocEnCours } = await supabase
        .from('prospection')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'interesse')

      // Clients
      const { count: clients } = await supabase
        .from('prospection')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'client')

      setStats({
        totalProspects: totalProspects || 0,
        totalContacts: totalContacts || 0,
        emailsAtrouver: emailsAtrouver || 0,
        emailsTrouves: emailsTrouves || 0,
        emailsValides: emailsValides || 0,
        rdvPlanifies: rdvPlanifies || 0,
        pocEnCours: pocEnCours || 0,
        clients: clients || 0
      })
    } catch (error) {
      console.error('Error fetching stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchPipeline = async () => {
    try {
      const statuts = ['a_prospecter', 'en_cours', 'interesse', 'rdv_pris', 'client', 'pas_interesse']
      const labels: Record<string, string> = {
        a_prospecter: 'À prospecter',
        en_cours: 'Séquence en cours',
        interesse: 'Intéressé',
        rdv_pris: 'RDV planifié',
        client: 'Clients',
        pas_interesse: 'Pas intéressé'
      }
      const colors: Record<string, string> = {
        a_prospecter: 'bg-gray-500',
        en_cours: 'bg-blue-500',
        interesse: 'bg-yellow-500',
        rdv_pris: 'bg-purple-500',
        client: 'bg-green-500',
        pas_interesse: 'bg-red-500'
      }

      const pipelineData: PipelineData[] = []

      for (const statut of statuts) {
        const { count } = await supabase
          .from('prospection')
          .select('*', { count: 'exact', head: true })
          .eq('statut', statut)

        pipelineData.push({
          statut,
          count: count || 0,
          label: labels[statut],
          color: colors[statut]
        })
      }

      setPipeline(pipelineData)
    } catch (error) {
      console.error('Error fetching pipeline:', error)
    }
  }

  const runCronNow = async () => {
    setRunningCron(true)
    toast.loading('Import en cours...')

    try {
      const response = await fetch('/api/cron/scrape-etablissements')
      const result = await response.json()

      toast.dismiss()
      if (result.success) {
        toast.success(`✅ ${result.results?.newEstablishments || 0} nouveaux établissements importés!`)
        fetchStats()
        fetchPipeline()
      } else {
        toast.error(`Erreur: ${result.error}`)
      }
    } catch (error: any) {
      toast.dismiss()
      toast.error(`Erreur: ${error.message}`)
    } finally {
      setRunningCron(false)
    }
  }

  const statCards = [
    { 
      title: 'Total Établissements', 
      value: stats.totalProspects, 
      icon: Users, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    { 
      title: 'Contacts créés', 
      value: stats.totalContacts, 
      icon: Users, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    { 
      title: 'Emails à trouver', 
      value: stats.emailsAtrouver, 
      icon: Mail, 
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    },
    { 
      title: 'Emails trouvés', 
      value: stats.emailsTrouves, 
      icon: Mail, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    { 
      title: 'Emails validés', 
      value: stats.emailsValides, 
      icon: Mail, 
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    { 
      title: 'RDV planifiés', 
      value: stats.rdvPlanifies, 
      icon: Calendar, 
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    { 
      title: 'Intéressés', 
      value: stats.pocEnCours, 
      icon: TrendingUp, 
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    { 
      title: 'Clients', 
      value: stats.clients, 
      icon: Users, 
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100'
    },
  ]

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <RefreshCw className="w-12 h-12 animate-spin text-purple-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Vue d'ensemble de votre prospection</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { fetchStats(); fetchPipeline(); }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <button 
            onClick={runCronNow}
            disabled={runningCron}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 disabled:opacity-50"
          >
            {runningCron ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
            {runningCron ? 'En cours...' : 'Importer plus'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline de prospection</h2>
          <div className="space-y-4">
            {pipeline.map((item) => (
              <div key={item.statut} className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600">{item.label}</div>
                <div className="flex-1">
                  <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max((item.count / (stats.totalContacts || 1)) * 100, item.count > 0 ? 8 : 0)}%` }}
                    >
                      <span className="text-white text-sm font-medium">{item.count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions rapides */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
          <div className="space-y-3">
            <a href="/prospects" className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Voir les prospects</p>
                  <p className="text-xs text-gray-500">{stats.totalProspects} établissements</p>
                </div>
              </div>
            </a>
            <button 
              onClick={runCronNow}
              disabled={runningCron}
              className="w-full p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <Play className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-gray-900">Importer établissements</p>
                  <p className="text-xs text-gray-500">100 par exécution</p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Info sur le fonctionnement */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🤖 Comment ça marche</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl mb-2">1️⃣</div>
            <h3 className="font-medium text-gray-900">Import FINESS</h3>
            <p className="text-sm text-gray-500">1495 établissements des Hauts-de-France (EHPAD, IME, ESAT...)</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl mb-2">2️⃣</div>
            <h3 className="font-medium text-gray-900">Enrichissement</h3>
            <p className="text-sm text-gray-500">Hunter.io trouve les emails des directeurs</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl mb-2">3️⃣</div>
            <h3 className="font-medium text-gray-900">Validation</h3>
            <p className="text-sm text-gray-500">ZeroBounce valide les emails</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-2xl mb-2">4️⃣</div>
            <h3 className="font-medium text-gray-900">Prospection</h3>
            <p className="text-sm text-gray-500">Séquence d'emails automatique via Brevo</p>
          </div>
        </div>
      </div>
    </div>
  )
}
