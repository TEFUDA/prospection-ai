'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Settings, RefreshCw, Zap, Mail, Users, CheckCircle, Clock, 
  Play, AlertCircle, Calendar, Brain, Shield, ExternalLink
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface CronStatus {
  name: string
  endpoint: string
  schedule: string
  description: string
  lastRun?: any
}

export default function ParametresPage() {
  const [loading, setLoading] = useState(false)
  const [apiStatus, setApiStatus] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [cronResults, setCronResults] = useState<Record<string, any>>({})
  const [runningCron, setRunningCron] = useState<string | null>(null)

  const crons: CronStatus[] = [
    {
      name: 'Séquences Auto',
      endpoint: '/api/cron/sequences',
      schedule: '9h et 14h (Lun-Ven)',
      description: 'Envoie automatiquement les emails J+0, J+3, J+7, J+14',
    },
    {
      name: 'Enrichissement',
      endpoint: '/api/cron/enrich',
      schedule: '6h (tous les jours)',
      description: 'Crée contacts, trouve emails (Hunter), génère ice breakers',
    },
    {
      name: 'Validation Emails',
      endpoint: '/api/cron/validate',
      schedule: '7h (tous les jours)',
      description: 'Valide les emails trouvés via ZeroBounce',
    },
  ]

  useEffect(() => {
    loadStats()
    loadApiStatus()
  }, [])

  const loadStats = async () => {
    try {
      const { count: totalEtabs } = await supabase.from('etablissements').select('*', { count: 'exact', head: true })
      const { count: totalContacts } = await supabase.from('contacts').select('*', { count: 'exact', head: true })
      const { count: emailsValides } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).eq('email_status', 'valide')
      const { count: withIcebreaker } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).not('icebreaker', 'is', null)
      const { count: sequenceActive } = await supabase.from('contacts').select('*', { count: 'exact', head: true }).not('sequence_started_at', 'is', null).is('sequence_completed_at', null)
      const { count: emailsSent } = await supabase.from('emails_envoyes').select('*', { count: 'exact', head: true })

      setStats({
        etablissements: totalEtabs || 0,
        contacts: totalContacts || 0,
        emails_valides: emailsValides || 0,
        icebreakers: withIcebreaker || 0,
        sequences_actives: sequenceActive || 0,
        emails_envoyes: emailsSent || 0,
      })
    } catch (err) {
      console.error('Error loading stats:', err)
    }
  }

  const loadApiStatus = async () => {
    try {
      // Vérifier enrichissement API
      const enrichResponse = await fetch('/api/contacts/enrich')
      const enrichData = await enrichResponse.json()

      // Vérifier ice breaker API
      const iceResponse = await fetch('/api/contacts/icebreaker')
      const iceData = await iceResponse.json()

      setApiStatus({
        hunter: enrichData.hunter,
        zerobounce: enrichData.zerobounce,
        anthropic: iceData.apis?.anthropic,
        serper: iceData.apis?.serper,
      })
    } catch (err) {
      console.error('Error loading API status:', err)
    }
  }

  const runCron = async (endpoint: string, name: string) => {
    setRunningCron(endpoint)
    try {
      const response = await fetch(endpoint)
      const data = await response.json()
      
      setCronResults(prev => ({ ...prev, [endpoint]: data }))
      
      if (data.success) {
        toast.success(`${name} exécuté avec succès!`)
      } else {
        toast.error(`Erreur: ${data.error}`)
      }
      
      loadStats()
    } catch (err: any) {
      toast.error('Erreur: ' + err.message)
    } finally {
      setRunningCron(null)
    }
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paramètres & Automatisation</h1>
          <p className="text-gray-500 mt-1">Configuration des CRONs et monitoring</p>
        </div>
        <button onClick={() => { loadStats(); loadApiStatus() }} className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-6 gap-4 mb-8">
        {[
          { label: 'Établissements', value: stats?.etablissements, icon: Users, color: 'blue' },
          { label: 'Contacts', value: stats?.contacts, icon: Users, color: 'purple' },
          { label: 'Emails validés', value: stats?.emails_valides, icon: CheckCircle, color: 'green' },
          { label: 'Ice breakers', value: stats?.icebreakers, icon: Brain, color: 'pink' },
          { label: 'Séquences actives', value: stats?.sequences_actives, icon: Clock, color: 'orange' },
          { label: 'Emails envoyés', value: stats?.emails_envoyes, icon: Mail, color: 'indigo' },
        ].map((stat, idx) => (
          <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 bg-${stat.color}-100 rounded-lg`}>
                <stat.icon className={`w-5 h-5 text-${stat.color}-600`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{stat.value ?? '-'}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* API Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Statut des APIs
        </h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { name: 'Hunter.io', key: 'hunter', desc: 'Recherche emails', credits: apiStatus?.hunter?.credits },
            { name: 'ZeroBounce', key: 'zerobounce', desc: 'Validation emails', credits: apiStatus?.zerobounce?.credits },
            { name: 'Anthropic', key: 'anthropic', desc: 'Ice breakers IA', credits: null },
            { name: 'Serper', key: 'serper', desc: 'Recherche Google', credits: null },
          ].map((api) => (
            <div key={api.key} className={`p-4 rounded-lg border-2 ${apiStatus?.[api.key]?.available || apiStatus?.[api.key] ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{api.name}</span>
                {apiStatus?.[api.key]?.available || apiStatus?.[api.key] ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <p className="text-sm text-gray-500">{api.desc}</p>
              {api.credits !== null && api.credits !== undefined && (
                <p className="text-sm font-medium text-green-600 mt-1">{api.credits} crédits</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* CRONs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Jobs Automatiques (CRONs)
        </h2>
        <div className="space-y-4">
          {crons.map((cron) => (
            <div key={cron.endpoint} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-medium text-gray-900">{cron.name}</h3>
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
                      {cron.schedule}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{cron.description}</p>
                </div>
                <button
                  onClick={() => runCron(cron.endpoint, cron.name)}
                  disabled={runningCron === cron.endpoint}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                >
                  {runningCron === cron.endpoint ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                  Exécuter
                </button>
              </div>
              
              {/* Résultat du dernier run */}
              {cronResults[cron.endpoint] && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-2">Dernier résultat:</p>
                  <pre className="text-xs text-gray-600 overflow-x-auto">
                    {JSON.stringify(cronResults[cron.endpoint], null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pipeline Visualisation */}
      <div className="bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">🚀 Pipeline de Prospection Automatique</h2>
        <div className="flex items-center justify-between text-center">
          <div className="flex-1">
            <div className="w-16 h-16 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">1</div>
            <p className="font-medium text-sm">Établissements</p>
            <p className="text-xs text-gray-500">FINESS importés</p>
            <p className="text-lg font-bold text-blue-600">{stats?.etablissements || 0}</p>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          <div className="flex-1">
            <div className="w-16 h-16 bg-purple-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">2</div>
            <p className="font-medium text-sm">Contacts</p>
            <p className="text-xs text-gray-500">Créés auto</p>
            <p className="text-lg font-bold text-purple-600">{stats?.contacts || 0}</p>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          <div className="flex-1">
            <div className="w-16 h-16 bg-yellow-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">3</div>
            <p className="font-medium text-sm">Emails trouvés</p>
            <p className="text-xs text-gray-500">Hunter.io</p>
            <p className="text-lg font-bold text-yellow-600">-</p>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          <div className="flex-1">
            <div className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">4</div>
            <p className="font-medium text-sm">Emails validés</p>
            <p className="text-xs text-gray-500">ZeroBounce</p>
            <p className="text-lg font-bold text-green-600">{stats?.emails_valides || 0}</p>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          <div className="flex-1">
            <div className="w-16 h-16 bg-pink-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">5</div>
            <p className="font-medium text-sm">Ice Breakers</p>
            <p className="text-xs text-gray-500">Claude IA</p>
            <p className="text-lg font-bold text-pink-600">{stats?.icebreakers || 0}</p>
          </div>
          <div className="text-2xl text-gray-300">→</div>
          <div className="flex-1">
            <div className="w-16 h-16 bg-indigo-500 text-white rounded-full flex items-center justify-center mx-auto mb-2 text-xl font-bold">6</div>
            <p className="font-medium text-sm">Séquences</p>
            <p className="text-xs text-gray-500">4 emails auto</p>
            <p className="text-lg font-bold text-indigo-600">{stats?.sequences_actives || 0}</p>
          </div>
        </div>
      </div>

      {/* Configuration requise */}
      <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-gray-500" />
          Variables d'environnement requises
        </h2>
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm text-green-400 overflow-x-auto">
          <pre>{`# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# Brevo (envoi emails)
BREVO_API_KEY=xkeysib-xxx
BREVO_SENDER_EMAIL=contact@soignantvoice.fr
BREVO_SENDER_NAME=Loïc - SoignantVoice

# Hunter.io (recherche emails)
HUNTER_API_KEY=xxx

# ZeroBounce (validation emails)
ZEROBOUNCE_API_KEY=xxx

# Anthropic Claude (ice breakers)
ANTHROPIC_API_KEY=sk-ant-xxx

# Serper (recherche Google)
SERPER_API_KEY=xxx

# Sécurité CRON (optionnel en prod)
CRON_SECRET=votre-secret-unique`}</pre>
        </div>
      </div>
    </div>
  )
}
