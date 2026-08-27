/**
 * Les seuils de l'algorithme. Chaque fonction d'analyse les reçoit en paramètre
 * à valeur par défaut, ce qui permet aux tests d'en faire varier un sans toucher
 * à l'état du module.
 */
export type Thresholds = {
  /** Largeur du filtre médian sur l'altitude, en points. Efface un pic isolé. */
  medianWindowPoints: number;
  /** Fenêtre de la moyenne glissante, en mètres. En mètres et non en points :
   *  la fréquence d'enregistrement varie d'un appareil à l'autre. */
  smoothingWindowM: number;
  /** Rayon en deçà duquel la position est jugée inchangée, en mètres.
   *  Proche de la précision d'un GPS à ciel ouvert. */
  stopRadiusM: number;
  /** Durée minimale d'immobilité constituant un arrêt, en secondes.
   *  Avec stopRadiusM, définit une vitesse implicite de 1,1 km/h : en deçà,
   *  on est réputé immobile. Vingt secondes et non dix, car un marcheur en forte
   *  pente franchit six mètres en vingt secondes mais pas toujours en dix. */
  stopMinDurationS: number;
  /** Au-delà de cet écart entre deux points, l'intervalle est une coupure
   *  d'enregistrement : ni mouvement, ni arrêt. En secondes. */
  recordingGapS: number;
  /** Perte d'altitude tolérée dans un creux fusionné, en mètres. */
  mergeMaxDropM: number;
  /** Longueur tolérée d'un creux fusionné, en mètres. */
  mergeMaxDistanceM: number;
  /** Dénivelé minimum pour retenir une montée, en mètres. */
  minClimbGainM: number;
  /** Pente moyenne minimum pour retenir une montée, en fraction. */
  minClimbGrade: number;
};

export const DEFAULTS: Thresholds = {
  medianWindowPoints: 5,
  smoothingWindowM: 30,
  stopRadiusM: 6,
  stopMinDurationS: 20,
  recordingGapS: 60,
  mergeMaxDropM: 10,
  mergeMaxDistanceM: 200,
  minClimbGainM: 20,
  minClimbGrade: 0.02,
};
