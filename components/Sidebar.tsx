'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  Users, 
  Mail, 
  Send,
  Calendar,
  Settings,
  TrendingUp,
  Mic
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Prospects', href: '/prospects', icon: Users },
  { name: 'Séquences', href: '/sequences', icon: Mail },
  { name: 'Emails envoyés', href: '/emails', icon: Send },
  { name: 'Leads', href: '/leads', icon: TrendingUp },
  { name: 'RDV', href: '/rdv', icon: Calendar },
  { name: 'Paramètres', href: '/settings', icon: Settings },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <div className="flex flex-col w-64 bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center h-16 px-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-gray-900">SoignantVoice</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-purple-50 text-purple-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-purple-700' : 'text-gray-400'}`} />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-4 border-t border-gray-200">
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-lg p-4 text-white">
          <p className="text-sm font-medium">🎯 Objectif</p>
          <p className="text-2xl font-bold">100 clients</p>
          <div className="mt-2 bg-white/20 rounded-full h-2">
            <div className="bg-white rounded-full h-2" style={{ width: '5%' }} />
          </div>
          <p className="text-xs mt-1 text-white/80">5 / 100 (5%)</p>
        </div>
      </div>
    </div>
  )
}
