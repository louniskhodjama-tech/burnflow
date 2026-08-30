# Antibiothérapie en phase aiguë de brûlure thermique — revue de littérature

> Base scientifique du protocole « Antibiothérapie & tétanos » livré par défaut
> dans BurnFlow (`src/lib/rules-defaults.ts`, décision D-015).
> Recherche : PubMed (NCBI), interrogé le 30/08/2026.
> Protocole validé par le Dr Lounis Khodja Mounir Abderrahmane.
> Chaque déploiement reste libre d'éditer ses protocoles (écran Seuils) sous
> la responsabilité de sa propre autorité médicale.

## Question posée

Faut-il une antibiothérapie systémique systématique en phase aiguë
(préhospitalier / avant transfert) de la brûlure thermique — et si oui,
laquelle, pour qui, à quelle dose ?

## Ce que disent les essais et méta-analyses

- **Avni 2010 (BMJ, méta-analyse, 17 essais)** — la prophylaxie systémique
  donnée 4–14 jours réduit la mortalité toutes causes (RR 0,54 ; IC95 %
  0,34–0,87 ; NNT 8) **mais** qualité méthodologique faible et résistance à
  l'antibiotique utilisé presque triplée (rate ratio 2,84) dans les essais
  l'ayant mesurée. doi:10.1136/bmj.c241
- **Cochrane 2013 (Barajas-Nava, 36 ECR, 2 117 patients)** — aucun bénéfice
  démontré de l'antibioprophylaxie ; la sulfadiazine argentique topique est
  associée à *plus* d'infections de plaie. doi:10.1002/14651858.CD002106.pub3
- **J Hosp Infect 2017 (revue systématique gradée, 19 essais)** — prophylaxie
  inefficace pour prévenir l'infection de plaie et le choc toxique (grade
  1C) ; **possiblement utile chez le brûlé grave sous ventilation mécanique**
  (grade 2B) ; périopératoire sans bénéfice pour la plupart.
  doi:10.1016/j.jhin.2017.06.015
- **Tagami 2016 (Clin Infect Dis, base nationale japonaise, score de
  propension)** — chez les brûlés graves **ventilés**, mortalité à 28 j
  36,6 % avec prophylaxie vs 47,0 % sans (−10,3 points ; IC95 % 1,4–19,3) ;
  chez les **non-ventilés, aucun bénéfice** (4,2 % vs 5,1 %).
  doi:10.1093/cid/civ763
- **Pédiatrie** — méta-analyse 2019 : la prophylaxie systémique ne réduit pas
  les complications infectieuses de l'enfant brûlé (PMID 31553768). Étude
  prospective africaine (80 enfants, amoxicilline-clavulanate vs oxacilline
  vs rien) : pas de différence significative ; des soins de plaie rigoureux
  suffisent, antibiotiques sur infection confirmée.
  doi:10.4103/0189-6725.143141
- **Inhalation de fumées** — panel international RAND/UCLA 2023 :
  antibioprophylaxie systémique jugée « inappropriée » (PMID 38012797).
- **Guidelines ISBI 2016/2018** (pensées pour les contextes à ressources
  limitées ; classées meilleures guidelines brûlure par l'évaluation
  AGREE II 2025, doi:10.1016/j.injury.2025.112527) : antibiothérapie sur
  indication, pas de prophylaxie systémique de routine.
  doi:10.1016/j.burns.2016.05.013 ; doi:10.1016/j.burns.2018.09.012

## L'argument écologique régional

Centre de Traumatologie et des Grands Brûlés de Ben Arous (Tunisie),
*Ann Burns Fire Disasters* 2019–2021 : *Acinetobacter baumannii*
multirésistant (PMID 34744536), *Pseudomonas aeruginosa* multirésistant
(PMID 33708020), entérobactéries productrices de carbapénémases dans l'unité
(PMID 32313534), bactériémies nosocomiales à BMR (PMID 34054382), et
corrélation directe entre consommation d'antibiotiques critiques (OMS) et
résistance (PMID 34744540). En Iran, résistance des Gram-négatifs des brûlés
au céfépime : 87–98 % (doi:10.1016/j.jgar.2019.04.017).

La flore des premiers jours est cutanée, à Gram positif (staphylocoque doré,
streptocoque) ; les Gram-négatifs multirésistants sont acquis ensuite à
l'hôpital. Un très large spectre donné à tous dès J0 ne couvre pas mieux la
menace réelle de J0–J3 mais sélectionne précocement les BMR responsables des
septicémies de J7–J15.

## La dose : la pharmacocinétique du brûlé impose des doses fortes

Le brûlé ≥ 20 % SCB développe une **clairance rénale augmentée** (ARC) : les
β-lactamines aux posologies standard sont fréquemment sous-dosées
(doi:10.2174/138920111798808446 ; BLING-II,
doi:10.1016/j.ijantimicag.2016.12.022 ; PMID 36173707, 37688528). Quand un
antibiotique est indiqué chez un brûlé : dose de charge, posologies hautes,
perfusions prolongées si possible.

## Limite assumée

Aucun essai ne couvre l'afflux massif en contexte de catastrophe (retards de
prise en charge, asepsie dégradée, attente prolongée au PMA). Le protocole
retenu étend l'indication d'antibiothérapie précoce à ces situations par
jugement clinique de l'autorité médicale du déploiement.

## Protocole retenu (stratifié)

1. **Brûlure limitée, propre, vue tôt** : pas d'antibiothérapie
   systématique — soins de plaie rigoureux, SAT/VAT.
2. **Antibiothérapie précoce à forte dose si au moins un critère** : prise en
   charge retardée (> 6 h), plaie souillée ou délabrée, asepsie dégradée
   (afflux massif), SCB ≥ 20 %, chirurgie prévue. Molécule :
   amoxicilline-acide clavulanique IV — adulte 1 g × 4/j (jusqu'à
   2 g × 3/j), enfant 100 mg/kg/j en 3–4 injections. Allergie aux
   bêta-lactamines : clindamycine IV 600 mg × 3/j (enfant 40 mg/kg/j).
   Posologies usuelles, à adapter au protocole local.
3. **Brûlé grave ventilé** : large spectre à forte dose d'emblée — seul
   groupe avec bénéfice de mortalité démontré.
4. **Fortes doses** systématiques si SCB ≥ 20 % (ARC). Pipéracilline-
   tazobactam et carbapénèmes réservés à l'hôpital d'accueil, sur
   documentation bactériologique.
5. **Tétanos** : vérification et mise à jour SAT/VAT systématiques.

Produit, dose et heure sont tracés (gestes cochables) et repris dans la
fiche de transfert pour l'hôpital d'accueil.
