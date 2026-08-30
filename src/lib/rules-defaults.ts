import type { ProtocolSection, RulesJson } from "@/db/schema";

/**
 * Conduite à tenir — CONTENU PAR DÉFAUT, À VALIDER PAR L'AUTORITÉ MÉDICALE
 * de chaque déploiement (D-015). Éditable par le régulateur (écran Seuils),
 * chaque modification créant une version tracée de rules_config.
 * Rédigé selon les principes de premiers soins aux brûlés (ISBI/EMSB) ;
 * validé initialement par le Dr Lounis Khodja Mounir Abderrahmane.
 */
export const DEFAULT_PROTOCOLS: ProtocolSection[] = [
  {
    id: "remplissage",
    title: "Remplissage vasculaire",
    classes: [2, 3],
    content:
      "Ringer Lactate en première intention. Volume : suivre le calcul Parkland " +
      "affiché sur la fiche (4 ml/kg/% SCB, moitié sur les 8 premières heures " +
      "comptées depuis la brûlure — pas depuis la prise en charge). Débuter dès " +
      "que possible ; en cas de retard, étaler le rattrapage, ne pas bolus sauf " +
      "collapsus. Cible : diurèse 0,5 ml/kg/h (adulte), 1 ml/kg/h (enfant) — " +
      "sonde urinaire si SCB ≥ 20 %. Éviter le sur-remplissage (œdème, syndrome " +
      "des loges) ; pas de colloïdes en phase initiale. Enfant < 30 kg : ajouter " +
      "les besoins d'entretien (déjà calculés sur la fiche).",
    items: [
      "Voie veineuse posée (zone non brûlée si possible)",
      "Ringer Lactate débuté — heure et débit notés",
      "Sonde urinaire posée (si SCB ≥ 20 %)",
      "Diurèse horaire surveillée",
    ],
  },
  {
    id: "analgesie",
    title: "Analgésie",
    classes: [1, 2, 3],
    content:
      "Douleur évaluée systématiquement (EN/EVA) et traitée d'emblée : une " +
      "brûlure significative est une douleur sévère. Morphine IV titrée " +
      "(0,05–0,1 mg/kg puis titration par paliers) ou kétamine à dose " +
      "analgésique selon disponibilité et habitude, notamment pour les gestes " +
      "et pansements. Paracétamol en complément. Éviter les AINS à la phase " +
      "aiguë (hypovolémie, rein). Réévaluer après chaque geste et avant le " +
      "départ ; surveiller FR et SpO₂ pendant la titration.",
    items: [
      "Douleur évaluée (EN/EVA notée)",
      "Antalgie administrée — produit, dose et heure notés",
      "Douleur réévaluée avant le départ",
    ],
  },
  {
    id: "atb-tetanos",
    title: "Antibiothérapie & tétanos",
    classes: [1, 2, 3],
    content:
      "Antibiothérapie SYSTÉMATIQUE à large spectre et à forte dose, débutée " +
      "dès la prise en charge, conformément au protocole en vigueur en " +
      "Algérie (validé par le Dr Lounis Khodja M. A.). Noter produit, dose et " +
      "heure d'administration — repris dans la fiche de transfert pour " +
      "l'hôpital d'accueil, qui adaptera secondairement aux prélèvements et à " +
      "l'évolution. Ne pas retarder le transfert pour compléter une " +
      "administration. TÉTANOS : vérifier et mettre à jour systématiquement " +
      "le statut vaccinal (SAT/VAT) — la brûlure est une plaie à risque " +
      "tétanigène.",
    items: [
      "Antibiothérapie large spectre débutée — produit, dose et heure notés",
      "Statut antitétanique vérifié",
      "SAT/VAT administré si nécessaire",
    ],
  },
  {
    id: "pansements",
    title: "Pansements & couverture — protocole détaillé",
    classes: [1, 2, 3],
    content:
      "1) REFROIDISSEMENT : eau tempérée (15–25 °C) 15 à 20 min maximum, " +
      "seulement si la brûlure date de moins de 30 min et SCB < 20 % ; JAMAIS " +
      "de glace ; arrêter en cas de frissons. Prudence extrême chez l'enfant " +
      "et les SCB étendues : l'hypothermie tue plus vite que la brûlure. " +
      "2) DÉSHABILLAGE : retirer vêtements non adhérents, bijoux, montres, " +
      "bagues AVANT l'œdème ; découper autour des textiles adhérents, ne pas " +
      "arracher. 3) PHLYCTÈNES : ne pas percer sur le terrain ; ne rien " +
      "appliquer de coloré (éosine, violet de gentiane) qui masque " +
      "l'évaluation à l'accueil ; aucun remède traditionnel (beurre, " +
      "dentifrice…). 4) NETTOYAGE : sérum physiologique ou eau propre, " +
      "doucement ; pas d'antiseptiques agressifs sur grandes surfaces. " +
      "5) COUVERTURE DE TRANSFERT : film plastique alimentaire posé À PLAT " +
      "sur la brûlure (jamais circulaire ni serré) — propre, non adhérent, " +
      "laisse évaluer à l'arrivée ; à défaut, champs ou draps propres et " +
      "secs. Visage : à l'air ou compresses humides non compressives ; ne " +
      "jamais entourer le cou. 6) MAINS/PIEDS : compresses interdigitales, " +
      "envelopper doigt par doigt, position de fonction, surélévation. " +
      "7) BRÛLURE CHIMIQUE : lavage abondant à l'eau courante ≥ 30 min, " +
      "retirer les vêtements contaminés, protéger le soignant, aucune " +
      "neutralisation chimique. 8) BRÛLURE ÉLECTRIQUE : couvrir points " +
      "d'entrée et de sortie, ECG et surveillance du rythme si disponibles. " +
      "9) RÉCHAUFFEMENT ACTIF : couverture de survie PAR-DESSUS la " +
      "couverture de transfert, pièce ou cellule chauffée. 10) LÉSIONS " +
      "CIRCONFÉRENTIELLES (membre, thorax, cou) : surveiller pouls, " +
      "recoloration et ampliation toutes les 15 min et le signaler à " +
      "l'accueil — l'escarrotomie est un geste hospitalier : ne pas retarder " +
      "le transfert. Noter l'heure de pose des pansements.",
    items: [
      "Bijoux et vêtements non adhérents retirés",
      "Refroidissement réalisé (≤ 20 min, pas de glace)",
      "Couverture propre posée à plat (film plastique / champ sec)",
      "Compresses interdigitales (mains/pieds atteints)",
      "Réchauffement actif en place (couverture de survie)",
      "Lésion circonférentielle : surveillance pouls/recoloration q15 min",
    ],
  },
  {
    id: "vigilance-transfert",
    title: "Points de vigilance avant et pendant le transfert",
    classes: [2, 3],
    content:
      "VOIES AÉRIENNES : brûlure de la face ou du cou + espace clos, voix " +
      "rauque, stridor ou suies oropharyngées → anticiper l'intubation AVANT " +
      "le transport (l'œdème s'aggrave en route) ; au moindre doute, demander " +
      "un avis brûlologue. Oxygène systématique si suspicion d'inhalation ou " +
      "d'intoxication au CO. Patient à jeun ; sonde gastrique si SCB étendue " +
      "ou vomissements. Surélever les membres brûlés et la tête (sauf " +
      "suspicion de traumatisme rachidien). Documenter pour l'accueil : heure " +
      "de la brûlure, gestes réalisés (cochés ci-dessous), volumes perfusés, " +
      "dernière antalgie — tout part avec la fiche de transfert.",
    items: [
      "Oxygène administré (si inhalation/CO suspectés)",
      "Patient laissé à jeun",
      "Membres brûlés et tête surélevés",
      "Heure de la brûlure et volumes perfusés notés",
    ],
  },
];

/** Valeurs initiales : identiques au bloc CONFIG du prototype + paramètres de routage du GOAL. */
export const DEFAULT_RULES: RulesJson = {
  reaSCB: 20,
  childBelow: 10,
  elderlyAbove: 50,
  thirdDegreeSign: 5,
  parklandMlKgPct: 4,
  routing: {
    lambda: 1.5,
    saturationThreshold: 0.85,
    cascadeMax: 6,
    timeoutMinutes: 10,
    protectedCenters: true,
    capacityStaleHours: 6,
    adviceReleaseMinutes: 15,
  },
  protocols: DEFAULT_PROTOCOLS,
};
