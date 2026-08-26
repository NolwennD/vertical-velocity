/**
 * Le contrat que tout adaptateur de parsing doit remplir. Il ne mentionne ni
 * GeoJSON ni XML : le reste de l'application ignore d'où viennent les points.
 */

export type TrackPoint = {
  lat: number;
  lon: number;
  /** Altitude brute, en mètres. */
  ele: number;
  time: Date;
};

/**
 * Une trace exploitable : au moins deux points. Le type interdit d'exprimer les
 * cas qui n'ont pas de sens — trace vide, trace d'un seul point — pour qu'aucune
 * fonction d'analyse n'ait à les traiter. La garantie est établie une seule fois,
 * par le parsing, et se propage ensuite à tout le pipeline.
 *
 * Reste un tableau : `map`, `for...of` et `.length` fonctionnent, et une `Track`
 * se passe à toute fonction attendant `readonly TrackPoint[]`.
 */
export type Track = readonly [TrackPoint, TrackPoint, ...TrackPoint[]];

export type GpxErrorCode = "invalid-xml" | "no-track-points" | "no-elevation" | "no-time";

/**
 * Défaillance de parsing exprimée dans le vocabulaire du domaine. Le `code` est
 * ce que l'interface traduit ; le message n'est jamais montré tel quel, et rien
 * de la librairie sous-jacente ne transparaît.
 */
export class GpxError extends Error {
  constructor(readonly code: GpxErrorCode) {
    super(code);
    this.name = "GpxError";
  }
}

export type GpxParser = (xml: string) => Track;
