import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useVista } from '../lib/vista';
import Icon from './Icon';
import RichText from './RichText';
import { formatearSalario } from '../lib/format';

/**
 * Modal glass con fondo desenfocado (DESIGN.md).
 *
 * Accesibilidad (el skill de UI/UX lo marca como CRITICO, y es facil de olvidar):
 *   - role="dialog" + aria-modal para que el lector de pantalla lo aisle.
 *   - Escape cierra, y el clic en el fondo tambien.
 *   - El foco entra al modal al abrirse y VUELVE al disparador al cerrarse.
 *   - Se bloquea el scroll del fondo mientras esta abierto.
 */
export default function JobModal({ job, onClose }) {
  const cajaRef = useRef(null);
  const anterior = useRef(null);
  const { guardadas, alternarOfertaGuardada } = useVista();

  // Analisis de encaje. Se guarda por oferta para no re-pedirlo si vuelves a
  // abrir la misma, y se limpia al cambiar de oferta (ver el efecto de abajo).
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorIA, setErrorIA] = useState(null);

  useEffect(() => {
    setAnalisis(null);
    setErrorIA(null);
  }, [job?.id]);

  /**
   * Compara tu perfil con esta oferta.
   *
   * Se manda el `jobId`, NO el texto de la oferta: el backend la resuelve contra
   * su propia base y la inyecta delimitada junto a tu perfil (chat.prompt.js).
   * Esa es la defensa anti-inyeccion del proyecto — las ofertas las escribe un
   * tercero, asi que su texto nunca viaja como parte del mensaje del usuario.
   */
  const analizar = async () => {
    setAnalizando(true);
    setErrorIA(null);
    try {
      const r = await api.chat(
        'Compara mi perfil con la oferta que tengo abierta. Dime en que encajo, que me falta y si merece la pena que postule. Se honesto y breve.',
        undefined,
        job.id,
      );
      setAnalisis(r.respuesta);
    } catch (err) {
      setErrorIA(err.message);
    } finally {
      setAnalizando(false);
    }
  };

  useEffect(() => {
    if (!job) return undefined;

    anterior.current = document.activeElement;
    cajaRef.current?.focus();

    const scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = scrollPrevio;
      // Devolver el foco a donde estaba: si no, el teclado se pierde al cerrar.
      anterior.current?.focus?.();
    };
  }, [job, onClose]);

  if (!job) return null;

  const salario = formatearSalario(job);

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal__caja"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-titulo"
        tabIndex={-1}
        ref={cajaRef}
      >
        <button type="button" className="modal__cerrar iconbtn" onClick={onClose} aria-label="Cerrar">
          <Icon name="cerrar" />
        </button>

        <span className={`chip chip--${job.isForeign ? 'exterior' : 'local'}`}>
          <Icon name={job.isForeign ? 'globo' : 'brujula'} size={14} />
          {job.isForeign ? 'Exterior' : 'Ecuador'}
        </span>

        <h2 id="modal-titulo" className="modal__titulo">
          {job.title}
        </h2>
        <p className="modal__empresa">
          {job.company}
          {job.location ? ` · ${job.location}` : ''}
        </p>

        <div className="modal__datos">
          <div>
            <span className="modal__etq">Salario</span>
            {salario ? (
              <p>
                {salario.texto}
                {salario.estimado && <span className="card__estimado">estimado</span>}
              </p>
            ) : (
              <p className="card__sinsalario">No publicado</p>
            )}
          </div>
          <div>
            <span className="modal__etq">Fuente</span>
            <p>{job.source}</p>
          </div>
          {job.score != null && (
            <div>
              <span className="modal__etq">Afinidad</span>
              <p>{Math.round(job.score * 100)}%</p>
            </div>
          )}
        </div>

        {job.skills?.length > 0 && (
          <>
            <span className="modal__etq">Habilidades</span>
            <ul className="chips">
              {job.skills.map((s) => (
                <li key={s} className="chip">
                  {s}
                </li>
              ))}
            </ul>
          </>
        )}

        {job.description && (
          <>
            <span className="modal__etq">Descripcion</span>
            <p className="modal__desc">{job.description}</p>
          </>
        )}

        {/* Encaje con tu perfil: lo resuelve la IA con los datos que ya tiene el
            backend (tu perfil + esta oferta), sin que tengas que contarle nada. */}
        <div className="modal__acciones">
          <button
            type="button"
            className="perfil__iabtn"
            onClick={analizar}
            disabled={analizando}
          >
            <Icon name="asistente" size={16} />
            {analizando ? 'Comparando…' : analisis ? 'Volver a analizar' : '¿Encajo en esta oferta?'}
          </button>

          <button
            type="button"
            className="perfil__iabtn modal__guardar"
            onClick={() => alternarOfertaGuardada(job)}
            aria-pressed={guardadas.has(job.id)}
          >
            <Icon name="marcador" size={16} />
            {guardadas.has(job.id) ? 'Guardada' : 'Guardar oferta'}
          </button>
        </div>

        {errorIA && (
          <p className="alerta" role="alert">
            <Icon name="aviso" size={16} /> {errorIA}
          </p>
        )}

        {analisis && (
          <div className="modal__analisis">
            <RichText texto={analisis} />
          </div>
        )}

        {/* rel="noopener": sin esto, la pestana destino puede manipular la nuestra. */}
        <a
          className="btn btn--primario modal__cta"
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ver oferta y postular
        </a>
      </div>
    </div>
  );
}
