'use client'

import { useState } from 'react'
import { Settings, Key, Mail, Database, Bell, Save } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function ParametresPage() {
  const [saving, setSaving] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      toast.success('Paramètres sauvegardés!')
    }, 1000)
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-gray-500 mt-1">Configuration de votre CRM</p>
        </div>
      </div>

      <div className="grid gap-6 max-w-3xl">
        {/* API Keys */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Key className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Clés API</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Hunter.io API Key</label>
              <input 
                type="password" 
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Configuré dans les variables d'environnement Vercel</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ZeroBounce API Key</label>
              <input 
                type="password" 
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Configuré dans les variables d'environnement Vercel</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brevo API Key</label>
              <input 
                type="password" 
                placeholder="••••••••••••••••"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                disabled
              />
              <p className="text-xs text-gray-500 mt-1">Configuré dans les variables d'environnement Vercel</p>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Mail className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Configuration Email</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email expéditeur</label>
              <input 
                type="email" 
                defaultValue="contact@soignantvoice.fr"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom expéditeur</label>
              <input 
                type="text" 
                defaultValue="Loïc - SoignantVoice"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        </div>

        {/* Database Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Base de données</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Provider</span>
              <span className="font-medium">Supabase</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Région</span>
              <span className="font-medium">Hauts-de-France</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600">Source données</span>
              <span className="font-medium">Base FINESS (data.gouv.fr)</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Rapport quotidien</p>
                <p className="text-sm text-gray-500">Recevoir un email récapitulatif chaque matin</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Alertes leads chauds</p>
                <p className="text-sm text-gray-500">Notification quand un prospect répond</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <button 
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Sauvegarde...' : 'Sauvegarder les paramètres'}
        </button>
      </div>
    </div>
  )
}
