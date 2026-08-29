# /goal — Plateforme de triage et d'orientation des brûlés en afflux massif

## Contexte

Incendies massifs dans l'Est algérien (Jijel, Béjaïa, Skikda…). Les deux centres nationaux des brûlés sont saturés, des hôpitaux régionaux sont hors service, le régulateur n'a pas de vue unifiée des places. Cette plateforme sert à : (1) trier les brûlés au point médical le plus proche, (2) recenser en temps réel les capacités des hôpitaux, (3) router chaque patient de proche en proche vers un hôpital adapté et disponible, avec équilibrage de charge, (4) donner aux urgentistes un avis de brûlologue à distance. Objectif clinique explicite : **décharger les centres des brûlés** en orientant vers les services de chirurgie et de réanimation tout ce qui peut l'être selon les critères ISBI.

L'outil doit être utilisable en production cette semaine. Priorité absolue : fiabilité et rapidité de mise en service, pas l'élégance architecturale. Un lecteur médical doit comprendre chaque écran sans formation.

Le goal n'est atteint que lorsque **les quatre conditions de la section « Définition de terminé »** sont remplies. Ne t'arrête pas avant. Si tu dois faire un choix non tranché ici, prends-le, consigne-le dans `docs/DECISIONS.md` et continue.

## Stack imposée (ne pas rediscuter)

- **Next.js 15 (App Router) + TypeScript strict**, full-stack : UI et routes API/server actions dans le même projet. Pas de backend séparé.
- **PostgreSQL 16** + **Drizzle ORM** + migrations versionnées.
- **Auth maison, simple** : lien magique par email (token à usage unique, 15 min) **et** code d'accès à 8 caractères que le régulateur peut générer et transmettre oralement. Pas de SMS. Sessions par cookie httpOnly. Aucune dépendance à un service d'auth externe.
- **Email** : SMTP configurable par variables d'environnement (Nodemailer). En dev, Mailpit.
- **Push web** : `web-push` avec clés VAPID, service worker, abonnement par utilisateur/appareil.
- **OSRM** self-hosted en conteneur, profil `car`, extrait Algérie depuis Geofabrik, préparé au build (`osrm-extract`/`osrm-contract`). Table de distances **mise en cache** en base entre tous les couples hôpital→hôpital et point médical→hôpital, recalculée à l'ajout d'un site.
- **LLM** : SDK Anthropic côté serveur uniquement, modèle `claude-sonnet-4-6`, clé en variable d'environnement. Jamais appelé depuis le navigateur. Jamais de donnée nominative envoyée (la plateforme n'en stocke pas).
- **Déploiement** : **Dokploy** sur un VPS Ubuntu neuf, via `docker-compose.yml` à la racine : services `app`, `postgres`, `osrm`, `mailpit` (dev uniquement). Le déploiement doit tenir en une commande documentée.
- **Tests** : Vitest (unitaires, notamment scoring et routage) + Playwright (scénario de bout en bout).
- UI : Tailwind + composants maison minimaux. Mobile-first, cibles tactiles ≥ 44 px, lisible en plein soleil (fort contraste), fonctionne sur navigateurs Android/iOS récents. Français uniquement.

## Rôles — strictement séparés

Chaque utilisateur a **exactement un rôle**. Un rôle ne voit et n'agit que sur son périmètre ; toute route serveur vérifie le rôle **et** l'appartenance (hôpital) avant d'agir. Écrire la matrice ci-dessous sous forme de tests.

| Rôle | Périmètre | Peut | Ne peut pas |
|---|---|---|---|
| **Urgentiste** | Un ou plusieurs *points médicaux* (site de triage) | Créer un patient pseudonymisé, saisir le triage, créer une demande de transfert, demander un avis brûlologue, voir l'état de ses propres demandes | Voir les patients d'autres sites, voir les capacités détaillées des hôpitaux, forcer une destination |
| **Référent hôpital** | Son hôpital uniquement | Mettre à jour la capacité de son hôpital, accepter/refuser une demande de transfert adressée à son hôpital, voir la fiche des patients qu'il a acceptés, marquer l'arrivée | Voir ou agir sur un autre hôpital, créer des patients |
| **Régulateur** | National | Tout voir, forcer/réassigner une destination, annuler une demande, modifier les seuils (charge, timeout, saturation), gérer hôpitaux et utilisateurs, générer des codes d'accès, lire les rapports de situation | Modifier un triage saisi par un urgentiste (il peut commenter), répondre à un avis brûlologue |
| **Brûlologue consultant** | File nationale des demandes d'avis | Voir la file des avis en attente, **prendre** une demande (elle disparaît de la file des autres), répondre, la relâcher, voir la fiche clinique du patient concerné | Voir les capacités, modifier un triage, agir sur les transferts |

Un compte `admin` technique (flag sur un régulateur) gère la configuration système. Pas de cinquième rôle.

## Modèle de données (Drizzle)

Pseudonymisation stricte : **aucun nom, prénom, téléphone patient, photo**. L'identifiant patient est l'ID bracelet saisi sur le terrain.

- `sites` — points médicaux de triage et hôpitaux dans une même table, `kind: 'triage_point' | 'hospital' | 'burn_center'`, nom, wilaya, lat/lng, téléphone du service, `active`.
- `users`, `sessions`, `magic_links`, `access_codes`, `memberships` (user ↔ site, un seul rôle par user).
- `capacity_snapshots` — par hôpital, horodaté, saisi par le référent : `icu_beds_free`, `ward_beds_free`, `or_available` (bool), `burn_surgeon_present` (bool), `supplies_ok` (bool), `note`. La capacité courante = dernier snapshot ; **périmée si > 6 h**.
- `patients` — `bracelet_id` (unique par site), site de triage, âge, poids estimé, mécanisme, heure estimée de la brûlure, drapeaux (inhalation, espace clos, trauma, comorbidité), créé par.
- `assessments` — versionné par patient : `regions` (JSON : zone → fraction, profondeur, circonférentielle), `scb_total`, `scb_deep`, `scb_third`, `signs` (liste), `orientation_class` (1 chirurgie / 2 réa / 3 centre), `rules_version`, `parkland` (JSON).
- `transfer_requests` — patient, classe demandée, type de lit (`ward | icu | burn_center`), `cascade` (liste ordonnée d'hôpitaux avec score), `current_index`, `status: pending | accepted | declined | expired | forced | cancelled | arrived`, `accepted_by_site_id`, timestamps, `timeout_minutes`.
- `transfer_events` — journal immuable de chaque étape (envoi, refus + motif, expiration, bascule, forçage, arrivée).
- `advice_requests` — patient, question de l'urgentiste, `status: open | claimed | answered | released`, `claimed_by`, `claimed_at`, réponse, `answered_at`.
- `push_subscriptions`, `notifications` (ce qui a été envoyé, à qui, par quel canal, lu ou non).
- `rules_config` — versionnée : seuils cliniques (voir ci-dessous) et paramètres de routage. Chaque assessment et chaque cascade référence la version utilisée.
- `distance_cache` — `from_site_id`, `to_site_id`, `minutes`, `km`, calculé via OSRM.
- `audit_log` — toute action de mutation, avec user, rôle, entité, avant/après.

## Scoring clinique — porter `docs/triage-brulures-v3.html`

Le fichier `docs/triage-brulures-v3.html` (fourni dans le dépôt avant lancement) contient le prototype validé de la grille de triage : carte corporelle face/dos, bulle par zone (fraction + profondeur), table Lund-Browder par tranche d'âge, calcul de SCB (1er degré exclu), Parkland, signes de gravité et classe d'orientation. **Porter cette logique à l'identique** dans un module TypeScript pur `lib/burn-scoring.ts` sans dépendance UI, couvert par des tests unitaires (au moins : adulte 25 % sans signe → réa ; enfant 8 ans 12 % → réa ; adulte 30 % + inhalation → centre ; adulte 12 % sans signe → chirurgie ; 1er degré seul → 0 % SCB). Le composant React de la carte corporelle reprend le SVG et l'interaction du prototype.

Les seuils vivent dans `rules_config`, éditables par le régulateur, avec valeurs initiales identiques au bloc `CONFIG` du prototype. Toute modification crée une nouvelle version.

Classes d'orientation :
- SCB < 20 % et aucun signe → **1 · Service de chirurgie**
- SCB ≥ 20 % sans signe, ou SCB < 20 % avec signe → **2 · Réanimation** (mention « avis brûlologue conseillé » dans le second cas)
- SCB ≥ 20 % avec signe → **3 · Centre des brûlés**

Un patient de classe 1 peut être adressé à un hôpital `hospital` ; classe 2 à un hôpital avec `icu_beds_free > 0` ; classe 3 à un `burn_center`, ou, si aucun n'a de place, à une réa (le régulateur est alerté).

## Routage de proche en proche avec équilibrage

Module pur `lib/routing.ts`, testé unitairement.

1. Candidats = hôpitaux actifs, capacité non périmée, compatibles avec le type de lit demandé, lit libre > 0.
2. Occupation estimée = 1 − (lits libres du type demandé / max(lits libres déclarés récents, 1)) — à défaut d'une capacité totale déclarée, utiliser `declared_total` optionnel dans le snapshot ; documenter l'approximation.
3. Score = `minutes_trajet × (1 + λ × occupation²)`, λ = 1.5 par défaut (paramètre `rules_config`). Plus le score est bas, mieux c'est.
4. **Saturation** : un hôpital à occupation ≥ 0.85 est déplacé en fin de cascade, sauf s'il est le seul candidat.
5. **Mode centre protégé** (actif par défaut) : les `burn_center` n'entrent dans la cascade que pour la classe 3, ou en dernier recours pour la classe 2 si aucune réa n'est disponible.
6. La cascade (max 6 hôpitaux) est figée à la création de la demande et visible par le régulateur. La demande est envoyée au 1er ; le référent a `timeout_minutes` (10 par défaut) pour accepter ou refuser (motif obligatoire). Sans réponse → `expired` pour cet hôpital, bascule automatique au suivant, notification. Cascade épuisée → alerte régulateur, statut `pending` maintenu en tête de sa file.
7. Une acceptation **réserve** le lit : décrémente la capacité courante de l'hôpital jusqu'à l'arrivée ou l'annulation. Deux demandes ne peuvent pas obtenir le même dernier lit (transaction avec verrou).
8. Le régulateur peut **forcer** une destination à tout moment (statut `forced`, motif obligatoire).

Un job périodique (toutes les minutes, dans le conteneur `app`, via `node-cron` ou équivalent, idempotent) gère les expirations et les bascules.

## Avis brûlologue — file « premier qui prend »

- L'urgentiste crée une demande d'avis depuis la fiche patient : question libre + la fiche clinique jointe automatiquement.
- Tous les brûlologues connectés reçoivent une notification push + email. La file affiche les demandes `open`, les plus anciennes en premier, avec classe et SCB.
- **Prendre** une demande la passe en `claimed` pour ce brûlologue seul (verrou en base ; si deux cliquent en même temps, un seul gagne, l'autre voit « déjà prise »). Non répondue après 15 min → retour automatique à `open` avec notification.
- Réponse en texte libre, horodatée, visible par l'urgentiste immédiatement (push). Le brûlologue peut relâcher sans répondre.
- Le brûlologue ne voit que : fiche clinique pseudonymisée, question, historique des avis de ce patient.

## Agent IA — premier jalon

Un module serveur `lib/agent/` avec un `LLMClient` unique. Trois capacités, toutes **suggestives, jamais décisionnelles**, journalisées :

1. **Contrôle de cohérence à la validation du triage** : le serveur envoie l'assessment structuré et reçoit une liste d'incohérences ou de champs manquants critiques (ex. inhalation non renseignée avec espace clos + face ; poids incompatible avec l'âge ; SCB élevée sans réanimation débutée). Affichées à l'urgentiste, qui confirme ou corrige. Si l'API échoue, la validation passe sans blocage (fail-open, avec mention).
2. **Fiche de transfert rédigée** : à partir des données structurées, un résumé clinique de 10 lignes max, en français médical, sans invention. Généré à la création de la demande de transfert, joint à la demande, exportable en PDF.
3. **Synthèse pour avis brûlologue** : même principe, avec la question de l'urgentiste en tête.

Le rapport de situation toutes les 6 h et les relances sont **déterministes** au premier jalon (chiffres calculés en SQL, envoi par email au régulateur ; relance push/email au référent dont la capacité a > 6 h). L'habillage narratif par LLM est un nice-to-have à ne faire que si tout le reste est terminé.

Prompts dans `lib/agent/prompts/*.md`, versionnés. Températures basses. Sorties JSON validées par Zod.

## Écrans (mobile-first)

- `/login` — email → lien magique, ou saisie d'un code d'accès.
- **Urgentiste** : liste de mes patients du site · nouveau patient · triage (carte corporelle) · fiche patient avec classe, Parkland, boutons « Demander un transfert » et « Demander un avis » · suivi de la demande (cascade en cours, hôpital qui a accepté, téléphone du service).
- **Référent hôpital** : capacité de mon hôpital (formulaire de 6 champs, gros boutons ±, horodatage visible, bouton « Confirmer inchangé ») · demandes reçues avec compte à rebours, accepter / refuser (motif) · patients attendus, « Marquer arrivé ».
- **Régulateur** : tableau de bord (patients en attente par classe, hôpitaux avec occupation et fraîcheur, carte Leaflet/OpenStreetMap) · détail d'une demande avec cascade et forçage · gestion sites/utilisateurs/codes · seuils · rapports.
- **Brûlologue** : file des avis · avis pris par moi · réponse.
- Notification push cliquable qui ouvre directement l'écran concerné.

## Données hôpitaux

Fournir `data/sites.template.csv` (colonnes documentées) et un script `pnpm seed:sites data/sites.csv`. Produire `data/sites.east-draft.csv` : brouillon des hôpitaux publics des wilayas de Jijel, Béjaïa, Skikda, Sétif, Constantine, Mila, Annaba, Guelma, El Tarf, Tizi Ouzou, Bouira, plus les centres des brûlés de Douéra (Alger) et d'Oran, avec type et coordonnées approximatives. **Marquer chaque ligne `to_verify=true`** ; le régulateur valide dans l'interface avant activation. Ne jamais activer un site non vérifié.

## Domaine, DNS et déploiement — à réaliser par toi, pas seulement à documenter

- Domaine de l'application : **https://brules.iqmed.io**. Emails envoyés depuis `noreply@iqmed.io`.
- Le DNS de `iqmed.io` est géré chez **Hostinger**. Le connecteur MCP officiel Hostinger est configuré dans Claude Code (outils Domains & DNS). Utilise-le pour créer l'enregistrement `A brules.iqmed.io → VPS_IP` (et `AAAA` si le VPS a une IPv6), puis pour les enregistrements SPF/DKIM du SMTP. Avant toute écriture DNS, affiche l'enregistrement exact et demande confirmation ; ne touche à aucun autre enregistrement de `iqmed.io`. Si le connecteur n'est pas disponible dans la session, affiche l'enregistrement à créer et attends.
- Le VPS est accessible en SSH (`VPS_IP`, `VPS_SSH_USER`, clé dans `~/.ssh`). Dokploy y est installé ou à installer (script officiel). Configure via l'API ou l'interface Dokploy : projet, service compose depuis ce dépôt, variables d'environnement, domaine `brules.iqmed.io` avec certificat Let's Encrypt, volumes persistants pour Postgres et OSRM.
- Vérifie de bout en bout : résolution DNS, HTTPS valide, `/api/health` répond, OSRM répond, un lien magique arrive réellement dans une boîte mail.
- Pour le SMTP : si `SMTP_HOST` est vide, propose une configuration avec le fournisseur de mail déjà utilisé pour `iqmed.io` (ou Resend/Brevo en secours), et documente les enregistrements SPF/DKIM à ajouter pour que les emails ne partent pas en spam. Ne mets pas en production sans SPF.
- Ne jamais afficher ni committer un secret. Lire les jetons uniquement depuis `.env.local`.

## Sécurité et conformité minimales

- Pas de donnée nominative patient, pas de photo. Le rappeler dans l'UI (placeholder de l'ID bracelet).
- HTTPS obligatoire (Dokploy/Traefik), cookies `Secure`, rate-limit sur login et codes.
- `audit_log` sur toute mutation ; export CSV pour le régulateur.
- Sauvegarde Postgres quotidienne par `pg_dump` dans un volume, documentée.

## Livrables

- Dépôt propre : `README.md` (installation, déploiement Dokploy pas à pas, variables d'environnement, chargement OSRM), `docs/DECISIONS.md`, `docs/ROLES.md` (matrice ci-dessus + tests correspondants), `docs/RUNBOOK.md` (que faire si OSRM tombe, si l'email ne part pas, comment forcer un transfert à la main, comment ajouter un hôpital en urgence).
- `docker-compose.yml` + `Dockerfile` multi-stage, `.env.example` complet.
- Scripts : `seed:sites`, `seed:demo` (données de démonstration : 6 hôpitaux, 1 centre, 3 points de triage, 1 utilisateur par rôle), `distances:rebuild`.

## Définition de terminé — les quatre conditions

1. **Tests verts** : `pnpm test` (unitaires scoring + routage + matrice des rôles) et `pnpm test:e2e` passent en CI locale.
2. **Déployé** : l'application tourne sur le VPS via Dokploy, accessible sur https://brules.iqmed.io avec certificat valide, OSRM répond, un email de lien magique est reçu réellement, une notification push est reçue sur un téléphone Android.
3. **Données importées** : `sites.east-draft.csv` importé, au moins les deux centres des brûlés et 5 hôpitaux marqués vérifiés par le régulateur via l'interface.
4. **Scénario de bout en bout joué et documenté** (`docs/E2E-REPORT.md`, avec captures) : un urgentiste crée un patient, saisit un triage donnant la classe 2, demande un transfert ; le 1er hôpital de la cascade refuse ; le 2e ne répond pas et expire ; le 3e accepte ; le lit est réservé ; l'urgentiste voit la destination ; un brûlologue prend une demande d'avis et répond ; le référent marque le patient arrivé ; le régulateur voit tout dans le journal.

## Méthode de travail

- Commence par un plan écrit dans `docs/PLAN.md` avec jalons, puis exécute jalon par jalon en committant à chaque étape fonctionnelle.
- Ordre : schéma + auth + rôles → scoring + carte corporelle → capacités référent → routage + demandes → avis brûlologue → notifications → agent → dashboard régulateur → déploiement → E2E.
- Après chaque jalon, relance les tests. Si un choix bloque plus de 30 minutes, prends la solution la plus simple qui satisfait le comportement décrit et consigne-la.
- Ne pas ajouter de fonctionnalité non décrite ici. Ne pas remplacer un composant de la stack imposée.
