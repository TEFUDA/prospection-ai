# 🎤 SoignantVoice CRM

Application de prospection complète pour SoignantVoice.

## 🚀 DÉPLOIEMENT EN 15 MINUTES

### Étape 1 : Créer le projet Supabase (5 min)

1. Va sur https://supabase.com et crée un compte
2. Clique "New Project"
3. Nomme-le `soignantvoice-crm`
4. Choisis un mot de passe fort (note-le !)
5. Région : Frankfurt (proche de la France)
6. Attends que le projet soit créé (~2 min)

### Étape 2 : Créer les tables (2 min)

1. Dans Supabase, va dans **SQL Editor** (menu gauche)
2. Clique "New query"
3. Copie-colle TOUT le contenu du fichier `database/schema.sql`
4. Clique **Run**
5. Tu devrais voir "Success"

### Étape 3 : Récupérer les clés Supabase (1 min)

1. Va dans **Settings** → **API**
2. Copie :
   - `Project URL` → c'est ton `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → c'est ton `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → c'est ton `SUPABASE_SERVICE_ROLE_KEY`

### Étape 4 : Configurer les variables d'environnement (2 min)

1. Copie `.env.example` en `.env.local`
2. Remplis les valeurs :

```env
# BREVO
BREVO_API_KEY=xkeysib-xxx...  (tu l'as déjà)
BREVO_SENDER_EMAIL=loic@soignantvoice.fr
BREVO_SENDER_NAME=Loïc - SoignantVoice

# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# APP
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=genere_un_string_aleatoire_ici
```

### Étape 5 : Lancer en local (2 min)

```bash
# Installer les dépendances
npm install

# Lancer le serveur de développement
npm run dev
```

Ouvre http://localhost:3000 → 🎉 Ton CRM est live !

### Étape 6 : Déployer sur Vercel (3 min)

1. Va sur https://vercel.com
2. Connecte ton compte GitHub
3. Clique "Import Project"
4. Sélectionne ton repo
5. Dans "Environment Variables", ajoute toutes les variables de `.env.local`
6. Clique "Deploy"
7. Attends ~1 min → Ton app est en ligne !

### Étape 7 : Configurer le webhook Brevo (2 min)

1. Va dans Brevo → **Settings** → **Webhooks**
2. Clique "Add a new webhook"
3. URL : `https://ton-app.vercel.app/api/webhook/brevo`
4. Events : Coche tout (opened, clicked, bounced, etc.)
5. Save

### Étape 8 : Configurer le CRON (1 min)

Pour envoyer les séquences automatiquement :

**Option A : Vercel Cron (recommandé)**

Ajoute dans `vercel.json` :
```json
{
  "crons": [{
    "path": "/api/cron/send-sequences",
    "schedule": "0 9 * * 1-5"
  }]
}
```
(Tous les jours à 9h du lundi au vendredi)

**Option B : cron-job.org (gratuit)**

1. Va sur https://cron-job.org
2. Crée un compte
3. Ajoute un nouveau cron :
   - URL : `https://ton-app.vercel.app/api/cron/send-sequences`
   - Schedule : Toutes les heures (ou comme tu veux)
   - Headers : `Authorization: Bearer TON_CRON_SECRET`

---

## 📁 STRUCTURE DU PROJET

```
soignantvoice-app/
├── app/
│   ├── layout.tsx          # Layout principal avec sidebar
│   ├── page.tsx            # Dashboard
│   ├── globals.css         # Styles globaux
│   ├── prospects/
│   │   └── page.tsx        # Liste des prospects
│   ├── sequences/
│   │   └── page.tsx        # Gestion des séquences
│   ├── api/
│   │   ├── emails/
│   │   │   └── send/route.ts    # Envoyer des emails
│   │   ├── webhook/
│   │   │   └── brevo/route.ts   # Recevoir events Brevo
│   │   └── cron/
│   │       └── send-sequences/route.ts  # CRON auto
├── components/
│   └── Sidebar.tsx         # Navigation
├── lib/
│   ├── brevo.ts           # API Brevo
│   └── supabase.ts        # Client Supabase
├── database/
│   └── schema.sql         # Structure DB
└── .env.example           # Variables d'environnement
```

---

## 🔧 COMMANDES UTILES

```bash
# Développement
npm run dev

# Build production
npm run build

# Lancer en production
npm start

# Linter
npm run lint
```

---

## 📊 FONCTIONNALITÉS

- ✅ Dashboard avec stats en temps réel
- ✅ Gestion des prospects (CRUD)
- ✅ Import CSV
- ✅ Séquences email automatiques (4 emails)
- ✅ Tracking ouvertures & clics
- ✅ Score d'intérêt automatique
- ✅ Pipeline visuel Kanban
- ✅ Intégration Brevo
- ✅ Webhooks pour tracking
- ✅ CRON pour envois auto

---

## 💡 TIPS

### Importer tes prospects existants

1. Exporte ton Airtable en CSV
2. Va dans Prospects → Importer CSV
3. Upload le fichier

### Modifier les emails de séquence

1. Va dans Supabase → Table Editor → sequence_steps
2. Modifie le contenu HTML/texte
3. Les variables disponibles : `{{prenom}}`, `{{nom}}`, `{{etablissement}}`, `{{type}}`, `{{poste}}`

### Voir les logs

- Vercel : Dashboard → Logs
- Supabase : Dashboard → Logs

---

## 🆘 PROBLÈMES COURANTS

**Les emails n'arrivent pas ?**
- Vérifie que ton domaine est bien configuré dans Brevo (SPF, DKIM)
- Vérifie les logs dans Brevo → Transactional

**Erreur Supabase ?**
- Vérifie que les clés API sont correctes
- Vérifie que le schema SQL a bien été exécuté

**Le CRON ne fonctionne pas ?**
- Vérifie que le CRON_SECRET est le même partout
- Vérifie les logs du cron

---

## 🚀 PROCHAINES ÉTAPES

1. Importer tes 100 premiers prospects
2. Lancer ta première séquence
3. Surveiller les stats
4. Répondre aux hot leads !

**LET'S GO ! 🔥**
