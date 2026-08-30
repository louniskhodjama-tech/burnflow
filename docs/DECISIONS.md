# DECISIONS — choix non tranchés par le GOAL, consignés ici

## D-001 — Déploiement différé (décision utilisateur, 2026-08-30)
Le VPS n'existe pas encore. Tout se construit et se vérifie en local (Docker : postgres, mailpit,
osrm). Le jalon M11 (Dokploy, DNS Hostinger, SPF/DKIM, HTTPS) sera exécuté quand l'utilisateur
fournira `VPS_IP` et les accès. Rien d'autre n'est bloqué par ce report.

## D-002 — Codes d'accès : usage unique, validité 24 h *(remplacé par D-013)*
Le GOAL impose « code à 8 caractères transmis oralement » sans préciser durée ni réutilisation.
Choix : usage unique, expiration 24 h, alphabet sans ambiguïté orale (A-Z sans I/O, 2-9).
Le régulateur peut en générer autant que nécessaire. Stockage haché (SHA-256), jamais en clair.

## D-003 — Sessions : 30 jours, cookie httpOnly SameSite=Lax
Durée choisie pour un usage de crise (éviter les reconnexions sur le terrain). Token aléatoire
32 octets, haché en base. `Secure` activé quand HTTPS.

## D-004 — Distances : OSRM d'abord, estimation haversine en secours
`distance_cache` est rempli via OSRM (profil car). Si OSRM est indisponible (dev sans extrait
Geofabrik, panne), on calcule une estimation : distance haversine × 1,35 (facteur routier),
vitesse moyenne 70 km/h, marquée `source='estimate'` en base et visible comme « estimé » dans
l'UI régulateur. Recalcul automatique en `source='osrm'` dès qu'OSRM répond (`distances:rebuild`).
Justification : l'outil doit fonctionner cette semaine même si la préparation OSRM (extraction +
contraction de l'extrait Algérie) n'est pas terminée.

## D-005 — Occupation estimée sans capacité totale déclarée
Conformément au GOAL §Routage 2 : le snapshot porte un champ optionnel `declared_total_icu` /
`declared_total_ward`. S'il est renseigné, occupation = 1 − libres/total. Sinon, approximation :
total supposé = max(lits libres déclarés sur les dernières 24 h, lits libres courants, 1) ;
occupation = 1 − libres/max(...). Approximation documentée dans l'UI (« occupation estimée »).

## D-006 — Rate-limit en mémoire (mono-instance)
Le déploiement cible est un seul conteneur `app`. Fenêtre glissante en mémoire :
10 tentatives / 15 min par IP et par identifiant sur `/login` (email et code). Pas de Redis.

## D-007 — Projet déplacé hors OneDrive (2026-08-30)
Constaté en dev sous OneDrive (Windows) : « Fichiers à la demande » déshydrate
des fichiers fraîchement écrits de `.next` (`readlink EINVAL`) et le moteur de
synchronisation les verrouille pendant l'upload (`EBUSY`), cassant le serveur
Next de façon aléatoire — l'épinglage `attrib +P` n'a pas suffi. Décision :
le dépôt de travail vit désormais dans **`C:\dev	riage-brules`** (hors
synchronisation). L'ancien emplacement contient un panneau `PROJET-DEPLACE.md`.
Historique git, base Docker (volume nommé) et conteneurs conservés. Pour la
sauvegarde cloud du code : un remote git, pas un dossier synchronisé.
Sans impact en production (Docker/Linux).

## D-011 — `output: standalone` uniquement dans l'image Docker
La copie des fichiers tracés du build standalone crée des symlinks, interdits
sous Windows sans mode développeur (EPERM). `next.config.ts` n'active
`standalone` que si `BUILD_STANDALONE=1` (positionné dans le Dockerfile).
`pnpm build` local reste possible sans privilèges.

## D-008 — Postgres dev exposé sur le port hôte 5433
Pour éviter tout conflit avec un Postgres local existant. Dans Docker, le service reste `postgres:5432`.

## D-009 — Périmètre brûlologue « fiche clinique »
Le brûlologue voit la fiche clinique pseudonymisée du patient concerné par la demande d'avis
(drapeaux, assessments, classe, Parkland) et l'historique des avis de ce patient — pas la cascade
de transfert ni les capacités (matrice des rôles).

## D-010 — PDF de la fiche de transfert
Généré côté serveur sans dépendance lourde : rendu HTML → impression navigateur (`window.print`)
sur une route dédiée `print`, plus export texte. Si un vrai PDF binaire devient nécessaire,
`@react-pdf/renderer` sera ajouté (non requis par le GOAL, qui demande « exportable en PDF »).

## D-012 — Authentification par codes d'accès uniquement (décision utilisateur, 2026-08-30)
Le lien magique par email est retiré (page /login, action serveur et route
/auth/verify supprimées ; la table `magic_links` reste en base, inutilisée,
pour éviter une migration destructive). Cela remplace l'exigence initiale du
GOAL « lien magique ET code ».

Le code est **personnel et nominatif** : chaque code est généré POUR un compte
précis (`access_codes.user_id`), la session ouverte est celle de ce compte, et
toutes les actions sont tracées à son nom dans `audit_log`. Rendu visible :
le nom du connecté est affiché en permanence dans l'en-tête, le régulateur
voit la dernière connexion de chaque compte, et l'écran de génération rappelle
que le code ne doit être transmis qu'à son destinataire.

Anti-verrouillage (les codes étant la seule porte) : `pnpm gen:code <email> [n]`
génère des codes depuis le serveur (documenté au RUNBOOK) ; `pnpm seed:demo`
en régénère pour les comptes de démonstration. Les emails restent utilisés
pour les NOTIFICATIONS (pas pour l'auth).

## D-013 — Codes personnels durables : réutilisables, validité choisie, prolongeables, révocables (décision utilisateur, 2026-08-30)
Remplace l'usage unique/24 h de D-002 : l'utilisateur veut pouvoir « prolonger
l'utilisation du code au-delà de 24 h ». Le code devient l'identifiant
personnel durable de son détenteur :
- **validité choisie** à la génération : 24 h, 3 j, 7 j ou 30 j (défaut 7 j
  pour `seed:demo` et `gen:code`) ;
- **réutilisable** pendant sa validité (plusieurs appareils, reconnexions) —
  `used_at` (première utilisation), `last_used_at` et `use_count` sont tracés ;
- **prolongeable** (`access_code.extend` audité) et **révocable** immédiatement
  (`access_code.revoke` audité) par le régulateur, qui voit les codes actifs
  de chaque compte (création, échéance, nombre de connexions, dernière) ;
- contrepartie sécurité de l'abandon de l'usage unique : révocation en un
  clic, visibilité des utilisations, chaque connexion auditée nominativement,
  rate-limit inchangé. Migration `0001_codes-durables`.

## D-015 — Conduite à tenir : protocoles éditables + gestes traçables (2026-08-30)
À la demande du Dr Lounis Khodja : sections « Conduite à tenir » (remplissage,
analgésie, antibiothérapie & tétanos, pansements détaillés, vigilance
transfert) affichées à l'urgentiste selon la classe du patient, reprises dans
la fiche de transfert et visibles de l'hôpital d'accueil.
- Le CONTENU vit dans `rules_config.protocols` (versionné, éditable par le
  régulateur dans l'écran Seuils). Textes par défaut validés le 2026-08-30
  par le Dr Lounis Khodja M. A. Pour l'antibiothérapie, après une position
  initiale « systématique large spectre », une revue de littérature (PubMed,
  30/08/2026 — synthèse et références dans `docs/CLINIQUE-ATB.md`) a conduit
  à adopter un protocole STRATIFIÉ : pas d'ATB si brûlure limitée propre vue
  tôt ; amoxicilline-clavulanate IV forte dose sur critères (retard > 6 h,
  souillure, afflux massif, SCB ≥ 20 %, chirurgie) ; large spectre d'emblée
  chez le brûlé grave ventilé (seul groupe avec bénéfice de mortalité
  démontré — Tagami, Clin Infect Dis 2016) ; fortes doses systématiques
  (clairance rénale augmentée) ; très larges spectres réservés à l'hôpital
  d'accueil. Autres invariants conservés : SAT/VAT systématique, jamais de
  glace, film plastique à plat, réchauffement actif. Chaque déploiement
  reste libre d'éditer ses protocoles.
- Chaque section porte des « gestes cochables » ; chaque coche est un
  enregistrement nominatif horodaté (table `care_actions`, migration 0002),
  audité, repris dans la fiche de transfert imprimable et dans le détail de
  la demande côté référent (« Gestes réalisés sur le terrain »).
- Droits : seul l'urgentiste du site coche/décoche ; référent (après
  acceptation) et régulateur lisent.

## D-016 — Écrans d'erreur français + résilience aux incidents passagers (2026-08-30)
Constat en production (PivoCloud) : instabilité intermittente de la
plateforme — ~1 requête sur 10 reste sans réponse ~21 s, toutes routes
confondues (y compris /login sans base) ; lorsqu'un rendu serveur est touché
(timeout de connexion base à 10 s), Next affichait sa page anglaise
« Application error » + digest. Base de données saine (migrations OK, aucun
verrou, aucune requête longue). Réponse : `error.tsx` et `global-error.tsx`
en français avec bouton « Réessayer » — en situation de crise, l'utilisateur
réessaie d'un geste, aucune donnée n'est perdue (écritures
transactionnelles). Si l'instabilité persiste : Restart/Redeploy du
conteneur, vérifier le nombre d'instances, logs runtime, support PivoCloud.

## D-017 — Disponibilité avant tout : le processus ne meurt plus sur un incident async (2026-08-30)
Cause racine des « Application error » répétés en production : trois chemins
où une micro-coupure vers la base tuait le processus Node entier —
(1) `void boot()` : un échec des migrations au boot (base injoignable 10 s)
devenait une promesse rejetée non gérée → crash → boucle de redémarrage ;
(2) crons (`* * * * *`) non blindés : un rejet de `minuteTick()` tuait le
serveur — avec ~1 requête sur 10 en échec côté plateforme, crash toutes les
~10 min ; (3) pool pg sans écouteur `error` : une connexion au repos coupée
émettait un événement non écouté → crash. Corrections : migrations avec 5
tentatives puis démarrage quand même (schéma déjà à jour au cas nominal),
crons enveloppés (échec journalisé, jamais fatal), `pool.on("error")`,
`keepAlive` + `idleTimeoutMillis` 30 s, et filets `unhandledRejection` /
`uncaughtException` qui journalisent sans éteindre. Sur un outil de crise,
la disponibilité prime sur le fail-fast.
