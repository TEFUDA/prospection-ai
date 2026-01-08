-- =====================================================
-- SCHEMA SUPABASE - CRM Prospection SoignantVoice
-- =====================================================

-- Table des établissements
CREATE TABLE IF NOT EXISTS etablissements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finess VARCHAR(20),  -- Numéro FINESS (optionnel)
  nom VARCHAR(255) NOT NULL,
  type VARCHAR(50),  -- EHPAD, IME, ESAT, SESSAD, FAM, MAS, etc.
  ville VARCHAR(100),
  code_postal VARCHAR(10),
  departement VARCHAR(50),
  region VARCHAR(50) DEFAULT 'Hauts-de-France',
  telephone VARCHAR(20),
  site_web VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index pour éviter les doublons
CREATE INDEX IF NOT EXISTS idx_etablissements_finess ON etablissements(finess);
CREATE INDEX IF NOT EXISTS idx_etablissements_nom_ville ON etablissements(nom, ville);

-- Table des contacts
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  etablissement_id UUID REFERENCES etablissements(id) ON DELETE CASCADE,
  nom VARCHAR(100),
  prenom VARCHAR(100),
  poste VARCHAR(100),  -- Directeur, IDEC, Cadre de santé, etc.
  email VARCHAR(255),
  email_status VARCHAR(50) DEFAULT 'a_trouver',  -- a_trouver, trouve, valide, invalide
  telephone VARCHAR(20),
  linkedin_url VARCHAR(255),
  source VARCHAR(50),  -- hunter, linkedin, manuel, finess_import
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de prospection
CREATE TABLE IF NOT EXISTS prospection (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  statut VARCHAR(50) DEFAULT 'a_prospecter',  -- a_prospecter, en_cours, interesse, pas_interesse, rdv_pris, client
  sequence_id UUID,
  etape_actuelle INTEGER DEFAULT 0,
  derniere_action TIMESTAMP WITH TIME ZONE,
  prochaine_action TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des séquences d'emails
CREATE TABLE IF NOT EXISTS sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  description TEXT,
  etapes JSONB,  -- [{ "jour": 0, "template_id": "xxx" }, ...]
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des templates d'emails
CREATE TABLE IF NOT EXISTS email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  sujet VARCHAR(255) NOT NULL,
  contenu TEXT NOT NULL,
  variables JSONB,  -- ["prenom_contact", "nom_etablissement", ...]
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des emails envoyés (tracking)
CREATE TABLE IF NOT EXISTS emails_envoyes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  template_id UUID REFERENCES email_templates(id),
  brevo_message_id VARCHAR(255),
  statut VARCHAR(50) DEFAULT 'envoye',  -- envoye, ouvert, clique, repondu, bounce
  ouvert_at TIMESTAMP WITH TIME ZONE,
  clique_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers pour updated_at
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
-- MIGRATION : Ajouter colonne finess si elle n'existe pas
-- =====================================================
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'etablissements' AND column_name = 'finess'
  ) THEN
    ALTER TABLE etablissements ADD COLUMN finess VARCHAR(20);
    CREATE INDEX idx_etablissements_finess ON etablissements(finess);
  END IF;
END $$;
