import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { alternarGuardada, idsGuardadas } from './ofertasGuardadas';

/**
 * Contexto de "lo que el usuario esta viendo ahora mismo". Lo consume el
 * Asistente para responder sobre lo que hay en pantalla sin que el usuario tenga
 * que repetirlo. Piezas:
 *
 *   - ofertaActiva: la oferta abierta en el modal. Se comparte entre quien la
 *     abre (tarjetas de la home o del chat), el unico JobModal (montado en el
 *     Shell, para no duplicarlo) y el Asistente (que manda su id al chat).
 *
 *   - contextoPantalla: un resumen breve, en texto, de lo que muestra la
 *     pantalla actual (p. ej. las brechas y cursos de "Crecer"). Cada pantalla
 *     lo declara al montarse y lo limpia al salir; el Asistente lo adjunta al
 *     chat como DATOS.
 *
 *   - peticionIA / pedirIA / consumirIA: canal para que una pantalla EMPUJE un
 *     mensaje al chat (p. ej. el boton "Pedir orientacion a la IA" del worksheet).
 *     La pantalla llama pedirIA(texto); el Asistente lo envia y llama consumirIA.
 */
const VistaContext = createContext(null);

export function VistaProvider({ children }) {
  const [ofertaActiva, setOfertaActiva] = useState(null);
  const [contextoPantalla, setContextoPantalla] = useState(null);
  const [peticionIA, setPeticionIA] = useState(null); // { texto, id }
  // Ofertas guardadas. Vive AQUI y no en cada componente: se guarda desde el
  // modal pero el indicador esta en las tarjetas, que son otro componente; si
  // cada uno leyera localStorage por su cuenta, no se enterarian entre ellos.
  const [guardadas, setGuardadas] = useState(() => idsGuardadas());
  // Ofertas que el Asistente encontro. No se pintan en el chat (ahi salen
  // apretadas en una columna estrecha): se mandan a la pantalla de Buscar, que
  // es la que tiene sitio y filtros.
  const [ofertasSugeridas, setOfertasSugeridas] = useState(null);

  const pedirIA = useCallback((texto) => setPeticionIA({ texto, id: Date.now() }), []);
  const consumirIA = useCallback(() => setPeticionIA(null), []);
  // Recibe la OFERTA entera, no su id: se guarda una copia para poder listarla
  // luego (ver lib/ofertasGuardadas).
  const alternarOfertaGuardada = useCallback(
    (oferta) => setGuardadas(new Set(alternarGuardada(oferta))),
    [],
  );

  const valor = useMemo(
    () => ({
      ofertaActiva,
      setOfertaActiva,
      contextoPantalla,
      setContextoPantalla,
      peticionIA,
      pedirIA,
      consumirIA,
      guardadas,
      alternarOfertaGuardada,
      ofertasSugeridas,
      setOfertasSugeridas,
    }),
    [
      ofertaActiva,
      contextoPantalla,
      peticionIA,
      pedirIA,
      consumirIA,
      guardadas,
      alternarOfertaGuardada,
      ofertasSugeridas,
    ],
  );
  return <VistaContext.Provider value={valor}>{children}</VistaContext.Provider>;
}

export const useVista = () => useContext(VistaContext);
