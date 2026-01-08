'use client'

import { useState, useEffect } from 'react'
import { 
  Users, 
  Mail, 
  MousePointer, 
  Calendar,
  TrendingUp,
  Send,
  Eye,
  MessageSquare
} from 'lucide-react'

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

// Données mockées (à remplacer par Supabase)
const mockStats: Stats = {
  totalProspects: 127,
  emailsEnvoyes: 89,
  tauxOuverture: 34.5,
  tauxClic: 8.2,
  reponses: 7,
  rdvPlanifies: 3,
  pocEnCours: 2,
  clients: 0
}

const mockPipeline: PipelineData[] = [
  { statut: 'a_prospecter', count: 78, label: 'À prospecter', color: 'bg-gray-500' },
  { statut: 'sequence_en_cours', count: 34, label: 'Séquence en cours', color: 'bg-blue-500' },
  { statut: 'repondu', count: 7, label: 'Ont répondu', color: 'bg-yellow-500' },
  { statut: 'rdv', count: 3, label: 'RDV planifié', color: 'bg-purple-500' },
  { statut: 'poc', count: 2, label: 'POC en cours', color: 'bg-orange-500' },
  { statut: 'client', count: 0, label: 'Clients', color: 'bg-green-500' },
]

const recentActivity = [
  { type: 'email_opened', contact: 'Marie Dupont', etablissement: 'EHPAD Amiens', time: 'Il y a 5 min' },
  { type: 'email_sent', contact: 'Jean Martin', etablissement: 'IME Dury', time: 'Il y a 15 min' },
  { type: 'link_clicked', contact: 'Sophie Durand', etablissement: 'ESAT Abbeville', time: 'Il y a 32 min' },
  { type: 'reply', contact: 'Pierre Leroy', etablissement: 'EHPAD Péronne', time: 'Il y a 1h' },
]

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>(mockStats)
  const [pipeline, setPipeline] = useState<PipelineData[]>(mockPipeline)
  const [loading, setLoading] = useState(false)

  // TODO: Fetch real data from Supabase
  useEffect(() => {
    // fetchStats()
  }, [])

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

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Vue d'ensemble de votre prospection</p>
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
            {recentActivity.map((activity, index) => (
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
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Actions rapides</h2>
        <div className="flex flex-wrap gap-4">
          <a href="/prospects?action=import" className="btn btn-primary">
            <Users className="w-4 h-4 mr-2" />
            Importer des prospects
          </a>
          <a href="/sequences?action=send" className="btn btn-secondary">
            <Send className="w-4 h-4 mr-2" />
            Lancer une séquence
          </a>
          <a href="/prospects?filter=hot" className="btn btn-secondary">
            <TrendingUp className="w-4 h-4 mr-2" />
            Voir les hot leads
          </a>
        </div>
      </div>
    </div>
  )
}
