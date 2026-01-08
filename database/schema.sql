-- =====================================================
-- SCHEMA SUPABASE - CRM Prospection SoignantVoice
-- =====================================================

-- Table des établissements
CREATE TABLE IF NOT EXISTS etablissements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finess VARCHAR(20),
  nom VARCHAR(255) NOT NULL,
  type VARCHAR(50),
  ville VARCHAR(100),
  code_postal VARCHAR(10),
  departement VARCHAR(50),
  region VARCHAR(50) DEFAULT 'Hauts-de-France',
  telephone VARCHAR(20),
  site_web VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etablissements_finess ON etablissements(finess);
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_ville ON etablissements(nom, ville);
CREATE INDEX IF NOT EXISTS idx_etablissements_type ON etablissements(type);
CREATE INDEX IF NOT EXISTS idx_etablissements_departement ON etablissements(departement);

-- Table des contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID REFERENCES etablissements(id) ON DELETE CASCADE,
  nom VARCHAR(100),
  prenom VARCHAR(100),
  poste VARCHAR(100) DEFAULT 'Directeur',
  email VARCHAR(255),
  email_status VARCHAR(50) DEFAULT 'a_trouver',
  telephone VARCHAR(20),
  linkedin_url VARCHAR(255),
  source VARCHAR(50) DEFAULT 'finess_import',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_etablissement ON contacts(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_email_status ON contacts(email_status);

-- Table de prospection
CREATE TABLE IF NOT EXISTS prospection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  statut VARCHAR(50) DEFAULT 'a_prospecter',
  sequence_id UUID,
  etape_actuelle INTEGER DEFAULT 0,
  derniere_action TIMESTAMP WITH TIME ZONE,
  prochaine_action TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prospection_contact ON prospection(contact_id);
CREATE INDEX IF NOT EXISTS idx_prospection_statut ON prospection(statut);

-- Table des séquences d'emails
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  etapes JSONB,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des templates d'emails
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  sujet VARCHAR(255) NOT NULL,
  contenu TEXT NOT NULL,
  variables JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des emails envoyés (tracking Brevo)
CREATE TABLE IF NOT EXISTS emails_envoyes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  brevo_message_id VARCHAR(255),
  sujet VARCHAR(255),
  statut VARCHAR(50) DEFAULT 'envoye',
  ouvert_at TIMESTAMP WITH TIME ZONE,
  clique_at TIMESTAMP WITH TIME ZONE,
  lien_clique VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails_envoyes(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_brevo_id ON emails_envoyes(brevo_message_id);
CREATE INDEX IF NOT EXISTS idx_emails_statut ON emails_envoyes(statut);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
DROP TRIGGER IF EXISTS update_etablissements_updated_at ON etablissements;
CREATE TRIGGER update_etablissements_updated_at
  BEFORE UPDATE ON etablissements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prospection_updated_at ON prospection;
CREATE TRIGGER update_prospection_updated_at
  BEFORE UPDATE ON prospection
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- MIGRATIONS : Ajouter colonnes si elles n'existent pas
-- =====================================================

-- Ajouter colonne sujet à emails_envoyes
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emails_envoyes' AND column_name = 'sujet'
  ) THEN
    ALTER TABLE emails_envoyes ADD COLUMN sujet VARCHAR(255);
  END IF;
END $$;

-- Ajouter colonne lien_clique à emails_envoyes
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'emails_envoyes' AND column_name = 'lien_clique'
  ) THEN
    ALTER TABLE emails_envoyes ADD COLUMN lien_clique VARCHAR(500);
  END IF;
END $$;

-- =====================================================
-- DONNÉES INITIALES : Séquence par défaut
-- =====================================================
INSERT INTO sequences (nom, description, etapes, active)
VALUES (
  'Séquence Standard EHPAD',
  'Séquence de 4 emails pour prospection EHPAD',
  '[
    {"jour": 0, "sujet": "SoignantVoice - Simplifiez vos transmissions", "type": "intro"},
    {"jour": 3, "sujet": "Retour sur SoignantVoice ?", "type": "relance1"},
    {"jour": 7, "sujet": "Dernière chance - Démo gratuite", "type": "relance2"},
    {"jour": 14, "sujet": "On peut vous aider ?", "type": "dernier"}
  ]'::jsonb,
  true
) ON CONFLICT DO NOTHING;

-- =====================================================
-- MIGRATION : Colonnes pour enrichissement contacts
-- =====================================================

-- Ajouter colonne source si elle n'existe pas
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'contacts' AND column_name = 'source'
  ) THEN
    ALTER TABLE contacts ADD COLUMN source VARCHAR(50) DEFAULT 'manuel';
  END IF;
END $$;

-- Index sur le statut email
CREATE INDEX IF NOT EXISTS idx_contacts_email_status ON contacts(email_status);

-- Contrainte unique email par établissement
-- (un même email ne peut pas être sur plusieurs contacts du même établissement)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_email_per_etablissement'
  ) THEN
    -- On ne peut pas ajouter la contrainte si des doublons existent
    -- ALTER TABLE contacts ADD CONSTRAINT unique_email_per_etablissement UNIQUE(etablissement_id, email);
    NULL;
  END IF;
END $$;

-- =====================================================
-- MIGRATION : Colonnes Ice Breaker
-- =====================================================

-- Ajouter colonnes ice breaker
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'icebreaker') THEN
    ALTER TABLE contacts ADD COLUMN icebreaker TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'icebreaker_context') THEN
    ALTER TABLE contacts ADD COLUMN icebreaker_context TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'icebreaker_generated_at') THEN
    ALTER TABLE contacts ADD COLUMN icebreaker_generated_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;
