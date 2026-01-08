'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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
import toast from 'react-hot-toast'

// Types
interface Stats {
  totalProspects: number
  emailsEnvoyes: number
  tauxOuverture: number
  tauxClic: number
  reponses: number
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

interface Activity {
  type: string
  contact: string
  etablissement: string
  time: string
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalProspects: 0,
    emailsEnvoyes: 0,
    tauxOuverture: 0,
    tauxClic: 0,
    reponses: 0,
    rdvPlanifies: 0,
    pocEnCours: 0,
    clients: 0
  })
  const [pipeline, setPipeline] = useState<PipelineData[]>([])
  const [recentActivity, setRecentActivity] = useState<Activity[]>([])
  const [loading, setLoading] = useState(true)
  const [runningCron, setRunningCron] = useState(false)

  // Fetch real data from Supabase
  useEffect(() => {
    fetchStats()
    fetchPipeline()
    fetchRecentActivity()
  }, [])

  const fetchStats = async () => {
    try {
      // Total prospects
      const { count: totalProspects } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })

      // Emails envoyés
      const { count: emailsEnvoyes } = await supabase
        .from('emails_sent')
        .select('*', { count: 'exact', head: true })

      // Emails ouverts
      const { count: emailsOuverts } = await supabase
        .from('emails_sent')
        .select('*', { count: 'exact', head: true })
        .gt('open_count', 0)

      // Emails cliqués
      const { count: emailsCliques } = await supabase
        .from('emails_sent')
        .select('*', { count: 'exact', head: true })
        .gt('click_count', 0)

      // Réponses
      const { count: reponses } = await supabase
        .from('prospection')
        .select('*', { count: 'exact', head: true })
        .eq('a_repondu', true)

      // RDV planifiés
      const { count: rdvPlanifies } = await supabase
        .from('prospection')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'rdv')

      // POC en cours
      const { count: pocEnCours } = await supabase
        .from('prospection')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'poc')

      // Clients
      const { count: clients } = await supabase
        .from('prospection')
        .select('*', { count: 'exact', head: true })
        .eq('statut', 'client')

      const total = emailsEnvoyes || 1
      setStats({
        totalProspects: totalProspects || 0,
        emailsEnvoyes: emailsEnvoyes || 0,
        tauxOuverture: Math.round(((emailsOuverts || 0) / total) * 1000) / 10,
        tauxClic: Math.round(((emailsCliques || 0) / total) * 1000) / 10,
        reponses: reponses || 0,
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
      const statuts = ['a_prospecter', 'sequence_en_cours', 'repondu', 'rdv', 'poc', 'client']
      const labels: Record<string, string> = {
        a_prospecter: 'À prospecter',
        sequence_en_cours: 'Séquence en cours',
        repondu: 'Ont répondu',
        rdv: 'RDV planifié',
        poc: 'POC en cours',
        client: 'Clients'
      }
      const colors: Record<string, string> = {
        a_prospecter: 'bg-gray-500',
        sequence_en_cours: 'bg-blue-500',
        repondu: 'bg-yellow-500',
        rdv: 'bg-purple-500',
        poc: 'bg-orange-500',
        client: 'bg-green-500'
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

  const fetchRecentActivity = async () => {
    try {
      const { data: events } = await supabase
        .from('email_events')
        .select(`
          event_type,
          created_at,
          emails_sent (
            contacts (prenom, nom, etablissements (nom))
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5)

      if (events) {
        setRecentActivity(events.map((e: any) => ({
          type: e.event_type === 'opened' ? 'email_opened' : 
                e.event_type === 'clicked' ? 'link_clicked' : 'email_sent',
          contact: `${e.emails_sent?.contacts?.prenom || ''} ${e.emails_sent?.contacts?.nom || ''}`.trim() || 'Inconnu',
          etablissement: e.emails_sent?.contacts?.etablissements?.nom || 'Inconnu',
          time: formatTimeAgo(new Date(e.created_at))
        })))
      }
    } catch (error) {
      console.error('Error fetching activity:', error)
    }
  }

  const formatTimeAgo = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `Il y a ${minutes} min`
    if (hours < 24) return `Il y a ${hours}h`
    return `Il y a ${days}j`
  }

  // Lancer le CRON manuellement
  const runCronNow = async () => {
    setRunningCron(true)
    toast.loading('Lancement de l\'automatisation...')

    try {
      const response = await fetch('/api/cron/master', {
        headers: { 'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || 'sv_cron_2024_secret_key'}` }
      })
      const result = await response.json()

      toast.dismiss()
      if (result.success) {
        toast.success(`✅ Terminé! ${result.report?.totalEmailsSent || 0} emails envoyés`)
        fetchStats()
        fetchPipeline()
        fetchRecentActivity()
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
      title: 'Total Prospects', 
      value: stats.totalProspects, 
      icon: Users, 
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    { 
      title: 'Emails envoyés', 
      value: stats.emailsEnvoyes, 
      icon: Send, 
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    { 
      title: 'Taux ouverture', 
      value: `${stats.tauxOuverture}%`, 
      icon: Eye, 
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    { 
      title: 'Taux clic', 
      value: `${stats.tauxClic}%`, 
      icon: MousePointer, 
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    { 
      title: 'Réponses', 
      value: stats.reponses, 
      icon: MessageSquare, 
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    { 
      title: 'RDV planifiés', 
      value: stats.rdvPlanifies, 
      icon: Calendar, 
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100'
    },
    { 
      title: 'POC en cours', 
      value: stats.pocEnCours, 
      icon: TrendingUp, 
      color: 'text-pink-600',
      bgColor: 'bg-pink-100'
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Vue d'ensemble de votre prospection</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => { fetchStats(); fetchPipeline(); fetchRecentActivity(); }}
            className="btn btn-secondary"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Actualiser
          </button>
          <button 
            onClick={runCronNow}
            disabled={runningCron}
            className="btn btn-primary"
          >
            {runningCron ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {runningCron ? 'En cours...' : 'Lancer maintenant'}
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <div key={stat.title} className="card card-hover">
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
        <div className="lg:col-span-2 card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Pipeline de prospection</h2>
          <div className="space-y-4">
            {pipeline.map((item) => (
              <div key={item.statut} className="flex items-center gap-4">
                <div className="w-32 text-sm text-gray-600">{item.label}</div>
                <div className="flex-1">
                  <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                    <div 
                      className={`h-full ${item.color} rounded-lg transition-all duration-500 flex items-center justify-end pr-2`}
                      style={{ width: `${Math.max((item.count / stats.totalProspects) * 100, 5)}%` }}
                    >
                      <span className="text-white text-sm font-medium">{item.count}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activité récente</h2>
          <div className="space-y-4">
            {recentActivity.length > 0 ? recentActivity.map((activity, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  activity.type === 'email_opened' ? 'bg-green-100' :
                  activity.type === 'email_sent' ? 'bg-blue-100' :
                  activity.type === 'link_clicked' ? 'bg-orange-100' :
                  'bg-yellow-100'
                }`}>
                  {activity.type === 'email_opened' && <Eye className="w-4 h-4 text-green-600" />}
                  {activity.type === 'email_sent' && <Send className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'link_clicked' && <MousePointer className="w-4 h-4 text-orange-600" />}
                  {activity.type === 'reply' && <MessageSquare className="w-4 h-4 text-yellow-600" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{activity.contact}</p>
                  <p className="text-xs text-gray-500 truncate">{activity.etablissement}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{activity.time}</span>
              </div>
            )) : (
              <p className="text-gray-500 text-sm">Aucune activité récente</p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🤖 Machine Automatique</h2>
        <p className="text-gray-600 mb-4">
          La machine tourne automatiquement tous les jours à 9h (lun-ven). Tu peux aussi la lancer manuellement.
        </p>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-2">Ce que fait la machine :</h3>
          <ol className="text-sm text-gray-600 space-y-1">
            <li>1️⃣ Scrape les nouveaux établissements (EHPAD, IME, ESAT...)</li>
            <li>2️⃣ Trouve les emails des directeurs (Hunter.io)</li>
            <li>3️⃣ Valide les emails (ZeroBounce)</li>
            <li>4️⃣ Envoie la séquence de 4 emails automatiquement</li>
            <li>5️⃣ T'envoie un rapport par email chaque matin</li>
          </ol>
        </div>
        <div className="flex flex-wrap gap-4">
          <button 
            onClick={runCronNow}
            disabled={runningCron}
            className="btn btn-primary"
          >
            {runningCron ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {runningCron ? 'En cours...' : 'Lancer la machine maintenant'}
          </button>
          <a href="/prospects" className="btn btn-secondary">
            <Users className="w-4 h-4 mr-2" />
            Voir les prospects
          </a>
          <a href="/sequences" className="btn btn-secondary">
            <Mail className="w-4 h-4 mr-2" />
            Modifier les emails
          </a>
        </div>
      </div>
    </div>
  )
}
