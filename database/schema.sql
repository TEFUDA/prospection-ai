-- =====================================================
-- SOIGNANTVOICE CRM - STRUCTURE DATABASE SUPABASE
-- =====================================================
-- 
-- INSTRUCTIONS:
-- 1. Va sur https://supabase.com et crée un compte gratuit
-- 2. Crée un nouveau projet (note le mot de passe!)
-- 3. Va dans "SQL Editor" (menu gauche)
-- 4. Copie-colle TOUT ce fichier
-- 5. Clique "Run"
-- 
-- =====================================================

-- Table des établissements
CREATE TABLE etablissements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nom VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- EHPAD, IME, ESAT, SESSAD, etc.
    ville VARCHAR(100),
    code_postal VARCHAR(10),
    departement VARCHAR(50),
    region VARCHAR(100) DEFAULT 'Hauts-de-France',
    telephone VARCHAR(20),
    email_generique VARCHAR(255),
    site_web VARCHAR(255),
    nb_places INTEGER,
    groupe VARCHAR(100), -- Korian, LNA Santé, etc.
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des contacts
CREATE TABLE contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    etablissement_id UUID REFERENCES etablissements(id) ON DELETE CASCADE,
    civilite VARCHAR(10), -- M., Mme
    prenom VARCHAR(100),
    nom VARCHAR(100),
    poste VARCHAR(100), -- Directeur, IDEC, Cadre de santé, etc.
    email VARCHAR(255),
    email_status VARCHAR(20) DEFAULT 'a_trouver', -- a_trouver, a_verifier, valid, invalid
    telephone_direct VARCHAR(20),
    linkedin_url VARCHAR(255),
    source VARCHAR(50) DEFAULT 'manuel', -- finess, linkedin, hunter, manuel
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table de prospection (état de chaque contact)
CREATE TABLE prospection (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    statut VARCHAR(30) DEFAULT 'a_prospecter', -- a_prospecter, sequence_en_cours, repondu, rdv, poc, client, refus
    sequence_id UUID REFERENCES sequences(id),
    sequence_step INTEGER DEFAULT 0,
    date_premier_contact TIMESTAMP WITH TIME ZONE,
    date_dernier_contact TIMESTAMP WITH TIME ZONE,
    date_prochain_contact TIMESTAMP WITH TIME ZONE,
    nb_emails_envoyes INTEGER DEFAULT 0,
    nb_ouvertures INTEGER DEFAULT 0,
    nb_clics INTEGER DEFAULT 0,
    a_repondu BOOLEAN DEFAULT FALSE,
    reponse_type VARCHAR(30), -- positif, negatif, info, rdv
    date_rdv TIMESTAMP WITH TIME ZONE,
    date_debut_poc DATE,
    date_fin_poc DATE,
    montant_devis DECIMAL(10,2),
    notes TEXT,
    score_interet INTEGER GENERATED ALWAYS AS (
        (nb_ouvertures * 10) + 
        (nb_clics * 25) + 
        (CASE WHEN a_repondu THEN 50 ELSE 0 END) +
        (CASE WHEN date_rdv IS NOT NULL THEN 100 ELSE 0 END)
    ) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des séquences email
CREATE TABLE sequences (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    description TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des étapes de séquence
CREATE TABLE sequence_steps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sequence_id UUID REFERENCES sequences(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    delay_days INTEGER NOT NULL, -- Jours après le step précédent
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des emails envoyés
CREATE TABLE emails_sent (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    prospection_id UUID REFERENCES prospection(id) ON DELETE CASCADE,
    sequence_step_id UUID REFERENCES sequence_steps(id),
    brevo_message_id VARCHAR(255),
    subject VARCHAR(255),
    to_email VARCHAR(255),
    status VARCHAR(30) DEFAULT 'sent', -- sent, delivered, opened, clicked, bounced, spam
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    opened_at TIMESTAMP WITH TIME ZONE,
    clicked_at TIMESTAMP WITH TIME ZONE,
    open_count INTEGER DEFAULT 0,
    click_count INTEGER DEFAULT 0
);

-- Table des events (webhook Brevo)
CREATE TABLE email_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email_sent_id UUID REFERENCES emails_sent(id) ON DELETE CASCADE,
    event_type VARCHAR(30), -- opened, clicked, bounced, spam, unsubscribed
    event_data JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    link_clicked VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table des leads (depuis landing page)
CREATE TABLE leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    prenom VARCHAR(100),
    nom VARCHAR(100),
    email VARCHAR(255) NOT NULL,
    telephone VARCHAR(20),
    etablissement VARCHAR(255),
    type_etablissement VARCHAR(50),
    message TEXT,
    source VARCHAR(50) DEFAULT 'landing_page',
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    statut VARCHAR(30) DEFAULT 'nouveau', -- nouveau, contacte, rdv, poc, client
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEX POUR PERFORMANCES
-- =====================================================

CREATE INDEX idx_contacts_etablissement ON contacts(etablissement_id);
CREATE INDEX idx_contacts_email ON contacts(email);
CREATE INDEX idx_contacts_email_status ON contacts(email_status);
CREATE INDEX idx_prospection_contact ON prospection(contact_id);
CREATE INDEX idx_prospection_statut ON prospection(statut);
CREATE INDEX idx_prospection_date_prochain ON prospection(date_prochain_contact);
CREATE INDEX idx_emails_sent_contact ON emails_sent(contact_id);
CREATE INDEX idx_emails_sent_brevo_id ON emails_sent(brevo_message_id);
CREATE INDEX idx_email_events_email_sent ON email_events(email_sent_id);

-- =====================================================
-- INSERTION SÉQUENCE PAR DÉFAUT
-- =====================================================

INSERT INTO sequences (id, nom, description) VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Séquence Standard', 'Séquence de 4 emails pour prospection EHPAD/ESMS');

INSERT INTO sequence_steps (sequence_id, step_number, delay_days, subject, body_html, body_text) VALUES
(
    '00000000-0000-0000-0000-000000000001',
    1,
    0,
    '{{prenom}}, 2h/jour économisées sur les transmissions ?',
    '<p>Bonjour {{prenom}},</p>
<p>Je me permets de vous contacter car je pense que SoignantVoice pourrait vraiment aider les équipes de <strong>{{etablissement}}</strong>.</p>
<p><strong>Le constat est simple :</strong><br>Vos équipes passent 5 à 8 minutes par transmission écrite. Sur une journée, ça représente des heures perdues — et de la fatigue accumulée.</p>
<p><strong>La solution :</strong><br>En 30 secondes de dictée vocale, notre IA génère une transmission professionnelle, avec le vocabulaire métier adapté, prête à copier dans le DUI.</p>
<p>👉 <strong>Résultat :</strong> 4 minutes économisées par transmission = 10h/jour pour un établissement de 20 professionnels.</p>
<p>Je vous propose de voir ça en 2 minutes :<br>🎬 <a href="https://soignantvoice.fr/demo?utm_source=email&utm_campaign=sequence1">Voir la démo</a></p>
<p>Si ça vous parle, on peut en discuter 15 minutes à votre convenance.</p>
<p>Bonne journée,</p>
<p><strong>Loïc Gros-Flandre</strong><br>Créateur de SoignantVoice<br>📞 06 XX XX XX XX</p>
<p style="color: #666; font-size: 0.9em;">PS : Ma femme est aide-soignante. C''est en la voyant rentrer épuisée à cause des transmissions que j''ai créé cette solution.</p>',
    'Bonjour {{prenom}},

Je me permets de vous contacter car je pense que SoignantVoice pourrait vraiment aider les équipes de {{etablissement}}.

Le constat est simple : Vos équipes passent 5 à 8 minutes par transmission écrite.

La solution : En 30 secondes de dictée vocale, notre IA génère une transmission professionnelle.

Voir la démo : https://soignantvoice.fr/demo

Loïc Gros-Flandre'
),
(
    '00000000-0000-0000-0000-000000000001',
    2,
    3,
    'Re: Les transmissions, un sujet chez vous ?',
    '<p>Bonjour {{prenom}},</p>
<p>Je reviens vers vous suite à mon précédent message.</p>
<p><strong>Ce que disent les premiers utilisateurs :</strong></p>
<blockquote>"J''ai oublié mon téléphone une fois — je suis revenue le chercher. Je ne peux plus m''en passer."<br>— Aide-soignante, EHPAD Hauts-de-France</blockquote>
<p><strong>Concrètement, SoignantVoice c''est :</strong></p>
<ul>
<li>✅ 30 secondes de dictée → transmission professionnelle</li>
<li>✅ Vocabulaire médico-social intégré</li>
<li>✅ Compatible avec tous les DUI</li>
<li>✅ Hébergement HDS, conforme RGPD</li>
</ul>
<p>👉 <a href="https://soignantvoice.fr/demo?utm_source=email&utm_campaign=sequence2">Voir la démo (2 min)</a></p>
<p>Un créneau de 15 minutes cette semaine pour en parler ?</p>
<p>Cordialement,<br>Loïc</p>',
    'Bonjour {{prenom}},

Je reviens vers vous suite à mon précédent message.

Ce que disent les premiers utilisateurs : "Je ne peux plus m''en passer."

Voir la démo : https://soignantvoice.fr/demo

Loïc'
),
(
    '00000000-0000-0000-0000-000000000001',
    3,
    7,
    'Essai gratuit 1 mois pour {{etablissement}} ?',
    '<p>Bonjour {{prenom}},</p>
<p>Je tente une dernière fois ma chance !</p>
<p>Je cherche <strong>3 établissements pilotes</strong> dans les Hauts-de-France pour tester SoignantVoice pendant 1 mois, <strong>gratuitement</strong>.</p>
<p><strong>Ce que vous gagnez :</strong></p>
<ul>
<li>Vos équipes testent en conditions réelles</li>
<li>Vous mesurez le temps gagné</li>
<li>Aucun engagement, aucune carte bancaire</li>
</ul>
<p>👉 <strong>Intéressé(e) ?</strong> Répondez simplement "OK" à cet email, je m''occupe du reste.</p>
<p>À très vite j''espère,</p>
<p>Loïc<br>06 XX XX XX XX</p>',
    'Bonjour {{prenom}},

Je cherche 3 établissements pilotes pour tester SoignantVoice pendant 1 mois, gratuitement.

Intéressé(e) ? Répondez simplement "OK" à cet email.

Loïc'
),
(
    '00000000-0000-0000-0000-000000000001',
    4,
    14,
    '📊 Le vrai coût des transmissions en {{type}}',
    '<p>Bonjour {{prenom}},</p>
<p>Je ne vais pas vous relancer éternellement, promis !</p>
<p>Mais avant de vous laisser tranquille, voici un calcul :</p>
<p><strong>Le coût caché des transmissions :</strong></p>
<ul>
<li>20 professionnels × 8 transmissions/jour × 6 min = <strong>16 heures/jour</strong></li>
<li>Coût horaire moyen : 25€</li>
<li>Coût annuel : <strong>~100 000€</strong></li>
</ul>
<p>Avec SoignantVoice, on divise ce temps par 10.</p>
<p>Si un jour le sujet devient prioritaire, vous savez où me trouver :</p>
<p>📧 loic@soignantvoice.fr<br>📞 06 XX XX XX XX<br>🌐 <a href="https://soignantvoice.fr">soignantvoice.fr</a></p>
<p>Belle continuation à vous et vos équipes,</p>
<p>Loïc</p>',
    'Bonjour {{prenom}},

Le coût caché des transmissions : ~100 000€/an pour un établissement.
Avec SoignantVoice, on divise ce temps par 10.

Contact : loic@soignantvoice.fr

Loïc'
);

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue des prospects à contacter aujourd'hui
CREATE OR REPLACE VIEW v_prospects_a_contacter AS
SELECT 
    c.id as contact_id,
    c.prenom,
    c.nom,
    c.email,
    c.poste,
    e.nom as etablissement,
    e.type as type_etablissement,
    e.ville,
    p.statut,
    p.sequence_step,
    p.nb_emails_envoyes,
    p.score_interet
FROM contacts c
JOIN etablissements e ON c.etablissement_id = e.id
JOIN prospection p ON p.contact_id = c.id
WHERE p.statut = 'a_prospecter'
AND c.email_status = 'valid'
ORDER BY p.score_interet DESC;

-- Vue du pipeline
CREATE OR REPLACE VIEW v_pipeline AS
SELECT 
    p.statut,
    COUNT(*) as nb_prospects,
    AVG(p.score_interet) as score_moyen
FROM prospection p
GROUP BY p.statut
ORDER BY 
    CASE p.statut 
        WHEN 'a_prospecter' THEN 1
        WHEN 'sequence_en_cours' THEN 2
        WHEN 'repondu' THEN 3
        WHEN 'rdv' THEN 4
        WHEN 'poc' THEN 5
        WHEN 'client' THEN 6
        WHEN 'refus' THEN 7
    END;

-- Vue des stats emails
CREATE OR REPLACE VIEW v_stats_emails AS
SELECT 
    COUNT(*) as total_envoyes,
    COUNT(*) FILTER (WHERE status = 'opened' OR open_count > 0) as total_ouverts,
    COUNT(*) FILTER (WHERE status = 'clicked' OR click_count > 0) as total_clics,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'opened' OR open_count > 0) / NULLIF(COUNT(*), 0), 1) as taux_ouverture,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'clicked' OR click_count > 0) / NULLIF(COUNT(*), 0), 1) as taux_clic
FROM emails_sent
WHERE sent_at > NOW() - INTERVAL '30 days';

-- =====================================================
-- FONCTION POUR METTRE À JOUR updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_etablissements_updated_at
    BEFORE UPDATE ON etablissements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_prospection_updated_at
    BEFORE UPDATE ON prospection
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY (optionnel mais recommandé)
-- =====================================================

-- Active RLS sur toutes les tables
ALTER TABLE etablissements ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prospection ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Policies pour permettre l'accès (à ajuster selon tes besoins)
CREATE POLICY "Allow all for authenticated users" ON etablissements FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON contacts FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON prospection FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON sequences FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON sequence_steps FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON emails_sent FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON email_events FOR ALL USING (true);
CREATE POLICY "Allow all for authenticated users" ON leads FOR ALL USING (true);

-- =====================================================
-- DONE ! 🚀
-- =====================================================
-- Ta base est prête !
-- Maintenant récupère ton URL et ta clé anon dans :
-- Settings → API → Project URL et anon/public key
