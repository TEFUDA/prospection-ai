'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Mail, Plus, Edit, Trash2, Play, Save, X, RefreshCw, Eye } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
)

interface Template {
  id: string
  nom: string
  sujet: string
  contenu: string
  variables: string[]
}

interface Sequence {
  id: string
  nom: string
  description: string
  active: boolean
  etapes: { jour: number; template_id: string; sujet: string }[]
}

// Templates par défaut pour SoignantVoice
const defaultTemplates: Omit<Template, 'id'>[] = [
  {
    nom: 'Email 1 - Introduction',
    sujet: '🎙️ Simplifiez les transmissions de vos soignants',
    contenu: `<p>Bonjour,</p>

<p>Je suis Loïc, fondateur de <strong>SoignantVoice</strong>.</p>

<p>Je contacte les établissements médico-sociaux des Hauts-de-France car nous avons développé une solution qui <strong>fait gagner 30 minutes par jour</strong> à vos équipes soignantes.</p>

<p><strong>Le problème :</strong> Vos aides-soignants passent trop de temps à rédiger les transmissions, souvent en fin de service, fatigués.</p>

<p><strong>Notre solution :</strong> SoignantVoice permet de <strong>dicter les transmissions à la voix</strong>. L'IA les structure automatiquement et les intègre dans votre DPI.</p>

<p>✅ Gain de temps : 30 min/jour/soignant<br>
✅ Transmissions plus complètes et lisibles<br>
✅ Compatible avec votre logiciel actuel</p>

<p>Seriez-vous disponible pour un échange de 15 minutes cette semaine ?</p>

<p>Bien cordialement,<br>
<strong>Loïc Gros-Flandre</strong><br>
SoignantVoice<br>
📞 06 XX XX XX XX</p>`,
    variables: ['nom_etablissement', 'prenom_contact'],
  },
  {
    nom: 'Email 2 - Relance 1',
    sujet: 'Re: Transmissions soignantes - Retour ?',
    contenu: `<p>Bonjour,</p>

<p>Je me permets de vous relancer suite à mon précédent message concernant SoignantVoice.</p>

<p>Nous aidons déjà plusieurs EHPAD et IME de la région à <strong>réduire de 50% le temps de rédaction</strong> des transmissions.</p>

<p>Un directeur d'EHPAD nous a récemment dit :</p>
<blockquote><em>"Mes équipes ne veulent plus s'en passer. Elles dictent en 2 minutes ce qui prenait 10 minutes à écrire."</em></blockquote>

<p>Je serais ravi de vous montrer une <strong>démo gratuite de 15 minutes</strong>, adaptée à votre organisation.</p>

<p>Quel créneau vous conviendrait ?</p>

<p>Cordialement,<br>
<strong>Loïc</strong></p>`,
    variables: ['nom_etablissement'],
  },
  {
    nom: 'Email 3 - Relance 2 (Valeur)',
    sujet: 'Vos soignants méritent de gagner du temps ⏰',
    contenu: `<p>Bonjour,</p>

<p>Je comprends que vous êtes très occupé(e). Je serai bref.</p>

<p><strong>3 chiffres sur SoignantVoice :</strong></p>
<ul>
<li>📊 <strong>30 min</strong> gagnées par soignant par jour</li>
<li>📊 <strong>95%</strong> de satisfaction des équipes</li>
<li>📊 <strong>2 semaines</strong> pour être opérationnel</li>
</ul>

<p>Nous proposons un <strong>essai gratuit de 30 jours</strong> sans engagement.</p>

<p>Si le sujet vous intéresse, je peux vous envoyer une vidéo de démo de 3 minutes ?</p>

<p>Bonne journée,<br>
<strong>Loïc</strong></p>`,
    variables: [],
  },
  {
    nom: 'Email 4 - Dernier',
    sujet: 'Dernière tentative 🙏',
    contenu: `<p>Bonjour,</p>

<p>C'est mon dernier message, promis !</p>

<p>Si les transmissions soignantes ne sont pas une priorité actuellement, je comprends tout à fait.</p>

<p>Mais si un jour vous cherchez à :</p>
<ul>
<li>✅ Améliorer la qualité des transmissions</li>
<li>✅ Réduire la charge administrative de vos équipes</li>
<li>✅ Moderniser vos outils</li>
</ul>

<p>Pensez à SoignantVoice. Je reste disponible.</p>

<p>Je vous souhaite une excellente continuation,<br>
<strong>Loïc Gros-Flandre</strong><br>
SoignantVoice<br>
www.soignantvoice.fr</p>`,
    variables: [],
  },
]

export default function SequencesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    setLoading(true)
    try {
      // Charger les templates
      const { data: templatesData } = await supabase
        .from('email_templates')
        .select('*')
        .order('created_at')

      if (templatesData && templatesData.length > 0) {
        setTemplates(templatesData)
      } else {
        // Créer les templates par défaut
        await createDefaultTemplates()
      }

      // Charger les séquences
      const { data: sequencesData } = await supabase
        .from('sequences')
        .select('*')
        .order('created_at')

      setSequences(sequencesData || [])
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const createDefaultTemplates = async () => {
    const createdTemplates: Template[] = []
    
    for (const template of defaultTemplates) {
      const { data, error } = await supabase
        .from('email_templates')
        .insert({
          nom: template.nom,
          sujet: template.sujet,
          contenu: template.contenu,
          variables: template.variables,
        })
        .select()
        .single()

      if (data) {
        createdTemplates.push(data)
      }
    }

    setTemplates(createdTemplates)
    toast.success('Templates par défaut créés!')
  }

  const saveTemplate = async () => {
    if (!editingTemplate) return

    try {
      if (editingTemplate.id) {
        // Update
        const { error } = await supabase
          .from('email_templates')
          .update({
            nom: editingTemplate.nom,
            sujet: editingTemplate.sujet,
            contenu: editingTemplate.contenu,
          })
          .eq('id', editingTemplate.id)

        if (error) throw error
        toast.success('Template mis à jour!')
      } else {
        // Insert
        const { error } = await supabase
          .from('email_templates')
          .insert({
            nom: editingTemplate.nom,
            sujet: editingTemplate.sujet,
            contenu: editingTemplate.contenu,
            variables: [],
          })

        if (error) throw error
        toast.success('Template créé!')
      }

      setShowTemplateModal(false)
      setEditingTemplate(null)
      loadData()
    } catch (err: any) {
      toast.error('Erreur: ' + err.message)
    }
  }

  const deleteTemplate = async (id: string) => {
    if (!confirm('Supprimer ce template ?')) return

    try {
      const { error } = await supabase
        .from('email_templates')
        .delete()
        .eq('id', id)

      if (error) throw error
      toast.success('Template supprimé')
      loadData()
    } catch (err: any) {
      toast.error('Erreur: ' + err.message)
    }
  }

  return (
    <div className="p-8">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Séquences & Templates</h1>
          <p className="text-gray-500 mt-1">Gérez vos emails de prospection</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={loadData}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
          <button
            onClick={() => {
              setEditingTemplate({ id: '', nom: '', sujet: '', contenu: '', variables: [] })
              setShowTemplateModal(true)
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nouveau template
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <>
          {/* Templates */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">📧 Templates d'emails</h2>
            <div className="grid gap-4">
              {templates.map((template, index) => (
                <div key={template.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                          Email {index + 1}
                        </span>
                        <h3 className="font-semibold text-gray-900">{template.nom}</h3>
                      </div>
                      <p className="text-gray-600 mb-2">
                        <strong>Sujet:</strong> {template.sujet}
                      </p>
                      <div className="text-sm text-gray-500 line-clamp-2" 
                        dangerouslySetInnerHTML={{ __html: template.contenu.substring(0, 200) + '...' }} 
                      />
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => setPreviewTemplate(template)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="Aperçu"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTemplate(template)
                          setShowTemplateModal(true)
                        }}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg"
                        title="Modifier"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteTemplate(template.id)}
                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {templates.length === 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                  <Mail className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun template</h3>
                  <p className="text-gray-500 mb-6">Créez vos premiers templates d'emails</p>
                  <button
                    onClick={createDefaultTemplates}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Créer les templates par défaut
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Info Séquence */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 border border-purple-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🚀 Séquence de prospection</h2>
            <p className="text-gray-600 mb-4">
              La séquence standard envoie automatiquement 4 emails espacés dans le temps :
            </p>
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">J+0</div>
                <div className="text-sm text-gray-600">Introduction</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">J+3</div>
                <div className="text-sm text-gray-600">Relance 1</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">J+7</div>
                <div className="text-sm text-gray-600">Relance 2</div>
              </div>
              <div className="bg-white rounded-lg p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">J+14</div>
                <div className="text-sm text-gray-600">Dernier email</div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Modal Edition Template */}
      {showTemplateModal && editingTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTemplate.id ? 'Modifier le template' : 'Nouveau template'}
              </h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du template</label>
                <input
                  type="text"
                  value={editingTemplate.nom}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, nom: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Email 1 - Introduction"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sujet de l'email</label>
                <input
                  type="text"
                  value={editingTemplate.sujet}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, sujet: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Simplifiez vos transmissions soignantes"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contenu (HTML)</label>
                <textarea
                  value={editingTemplate.contenu}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, contenu: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 h-64 font-mono text-sm"
                  placeholder="<p>Bonjour,</p>..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveTemplate}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Enregistrer
                </button>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Preview */}
      {previewTemplate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">{previewTemplate.nom}</h2>
                <p className="text-gray-500 text-sm">Aperçu de l'email</p>
              </div>
              <button onClick={() => setPreviewTemplate(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4 p-3 bg-gray-100 rounded-lg">
                <strong>Sujet:</strong> {previewTemplate.sujet}
              </div>
              <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: previewTemplate.contenu }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
