-- =====================================================
-- SCHEMA COMPLET CRM SOIGNANTVOICE
-- À exécuter dans Supabase SQL Editor
-- =====================================================

-- Table des établissements (EHPAD, IME, etc.)
CREATE TABLE IF NOT EXISTS etablissements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finess VARCHAR(20) UNIQUE,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50),
    adresse TEXT,
    code_postal VARCHAR(10),
    ville VARCHAR(100),
    departement VARCHAR(100),
    region VARCHAR(100),
    telephone VARCHAR(20),
    email VARCHAR(255),
    site_web VARCHAR(255),
    capacite INTEGER,
    statut VARCHAR(50) DEFAULT 'actif',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des contacts (directeurs, IDEC, etc.)
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE CASCADE,
    prenom VARCHAR(100),
    nom VARCHAR(100),
    poste VARCHAR(100),
    email VARCHAR(255),
    telephone VARCHAR(20),
    linkedin VARCHAR(255),
    email_status VARCHAR(20) DEFAULT 'a_trouver',
    email_validated_at TIMESTAMP WITH TIME ZONE,
    email_validation_result VARCHAR(50),
    source VARCHAR(50) DEFAULT 'manuel',
    -- Colonnes Ice Breaker
    icebreaker TEXT,
    icebreaker_context TEXT,
    icebreaker_generated_at TIMESTAMP WITH TIME ZONE,
    -- Colonnes Séquence
    sequence_started_at TIMESTAMP WITH TIME ZONE,
    sequence_step INTEGER DEFAULT 0,
    sequence_completed_at TIMESTAMP WITH TIME ZONE,
    last_email_at TIMESTAMP WITH TIME ZONE,
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de suivi de prospection
CREATE TABLE IF NOT EXISTS prospection (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    statut VARCHAR(50) DEFAULT 'a_prospecter',
    etape_actuelle INTEGER DEFAULT 0,
    derniere_action TIMESTAMP WITH TIME ZONE,
    prochaine_action TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des templates d'emails
CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    sujet VARCHAR(255) NOT NULL,
    contenu TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',
    actif BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des séquences d'emails
CREATE TABLE IF NOT EXISTS sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT true,
    etapes JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des emails envoyés
CREATE TABLE IF NOT EXISTS emails_envoyes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    template_id UUID REFERENCES email_templates(id) ON DELETE SET NULL,
    brevo_message_id VARCHAR(255),
    sujet VARCHAR(255),
    statut VARCHAR(50) DEFAULT 'envoye',
    sequence_step INTEGER,
    is_first_email BOOLEAN DEFAULT false,
    has_icebreaker BOOLEAN DEFAULT false,
    ouvert_at TIMESTAMP WITH TIME ZONE,
    clique_at TIMESTAMP WITH TIME ZONE,
    bounce_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des RDV
CREATE TABLE IF NOT EXISTS rdv (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    date_rdv TIMESTAMP WITH TIME ZONE NOT NULL,
    type VARCHAR(50) DEFAULT 'demo',
    statut VARCHAR(50) DEFAULT 'planifie',
    notes TEXT,
    lien_visio VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEX POUR PERFORMANCES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_contacts_etablissement ON contacts(etablissement_id);
CREATE INDEX IF NOT EXISTS idx_contacts_email_status ON contacts(email_status);
CREATE INDEX IF NOT EXISTS idx_contacts_sequence_step ON contacts(sequence_step);
CREATE INDEX IF NOT EXISTS idx_contacts_sequence_started ON contacts(sequence_started_at);
CREATE INDEX IF NOT EXISTS idx_prospection_contact ON prospection(contact_id);
CREATE INDEX IF NOT EXISTS idx_prospection_statut ON prospection(statut);
CREATE INDEX IF NOT EXISTS idx_emails_contact ON emails_envoyes(contact_id);
CREATE INDEX IF NOT EXISTS idx_emails_created ON emails_envoyes(created_at);
CREATE INDEX IF NOT EXISTS idx_etablissements_type ON etablissements(type);
CREATE INDEX IF NOT EXISTS idx_etablissements_departement ON etablissements(departement);

-- =====================================================
-- ROW LEVEL SECURITY (optionnel)
-- =====================================================
-- ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE prospection ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- TRIGGERS POUR UPDATED_AT
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_etablissements_updated_at ON etablissements;
CREATE TRIGGER update_etablissements_updated_at BEFORE UPDATE ON etablissements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prospection_updated_at ON prospection;
CREATE TRIGGER update_prospection_updated_at BEFORE UPDATE ON prospection
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
