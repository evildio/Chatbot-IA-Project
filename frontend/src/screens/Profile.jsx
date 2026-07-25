import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useVista } from '../lib/vista';
import { ofertasGuardadas } from '../lib/ofertasGuardadas';
import Icon from '../components/Icon';
import SkillIcon from '../components/SkillIcon';
import JobCard from '../components/JobCard';
import AvisosTelegram from '../components/AvisosTelegram';

export default function Profile() {
  const { perfil, refrescar, salir } = useAuth();
  const { pedirIA, setContextoPantalla, guardadas, setOfertaActiva } = useVista();
  // Se releen de disco cuando cambia el Set del contexto: asi la lista reacciona
  // a guardar o quitar desde el modal sin recargar la pantalla.
  const marcadas = useMemo(() => ofertasGuardadas(), [guardadas]);
  const inputArchivo = useRef(null);

  const [estado, setEstado] = useState(null); // { tipo: 'ok'|'error', texto }
  const [ocupado, setOcupado] = useState(false);
  const [nuevaSkill, setNuevaSkill] = useState('');

  const skills = perfil?.skills ?? [];

  // El chat conoce tu perfil mientras estas aqui (skills + estado del CV), asi
  // tambien responde bien a lo que escribas a mano. Se limpia al salir.
  useEffect(() => {
    const cv = perfil?.tieneCv ? `tiene un CV de ${perfil.cvLongitud} caracteres` : 'aun no ha subido su CV';
    const marcadasTxt = marcadas.length
      ? ` Tiene ${marcadas.length} ofertas guardadas: ${marcadas
          .slice(0, 6)
          .map((j) => `${j.title} en ${j.company}`)
          .join('; ')}.`
      : '';
    setContextoPantalla(
      `El usuario esta en "Tu perfil". Sus habilidades: ${skills.join(', ') || '(ninguna)'}. ${cv}.${marcadasTxt}`,
    );
    return () => setContextoPantalla(null);
    // skills se deriva de perfil; con perfil basta para reaccionar a los cambios.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfil, marcadas, setContextoPantalla]);

  // Estado del CV en texto, para reutilizar en los mensajes a la IA.
  const cvTexto = perfil?.tieneCv
    ? `Tengo un CV de ${perfil.cvLongitud} caracteres`
    : 'Todavia no he subido mi CV';
  const skillsTexto = skills.join(', ') || '(ninguna todavia)';

  const subir = async (file) => {
    if (!file) return;
    setEstado(null);
    setOcupado(true);
    try {
      const r = await api.subirCv(file);
      await refrescar();
      setEstado({
        tipo: 'ok',
        texto: `CV actualizado. Detectamos ${r.skillsDetectadas.length} habilidades.`,
      });
    } catch (err) {
      setEstado({ tipo: 'error', texto: err.message });
    } finally {
      setOcupado(false);
    }
  };

  const quitar = async (skill) => {
    const quedan = skills.filter((s) => s !== skill);
    if (!quedan.length) {
      setEstado({ tipo: 'error', texto: 'Necesitas al menos una habilidad.' });
      return;
    }
    setOcupado(true);
    try {
      await api.guardarSkills(quedan);
      await refrescar();
    } catch (err) {
      setEstado({ tipo: 'error', texto: err.message });
    } finally {
      setOcupado(false);
    }
  };

  const agregar = async (e) => {
    e.preventDefault();
    const s = nuevaSkill.trim().toLowerCase();
    if (!s) return;
    if (skills.includes(s)) {
      setEstado({ tipo: 'error', texto: `Ya tienes "${s}".` });
      setNuevaSkill('');
      return;
    }
    setEstado(null);
    setOcupado(true);
    try {
      await api.guardarSkills([...skills, s]);
      await refrescar();
      setNuevaSkill('');
    } catch (err) {
      setEstado({ tipo: 'error', texto: err.message });
    } finally {
      setOcupado(false);
    }
  };

  // Consultas al asistente (mensajes autocontenidos con tus datos). La respuesta
  // sale en el panel del chat.
  const analizarPerfil = () =>
    pedirIA(
      `Analiza mi perfil profesional para el mercado tech (Ecuador y remoto). Mis habilidades: ${skillsTexto}. ${cvTexto}. Dime mis fortalezas, mis puntos debiles y 2-3 cosas concretas que deberia mejorar.`,
    );
  const sugerirSkills = () =>
    pedirIA(
      `Segun mi perfil (habilidades: ${skillsTexto}) y la demanda actual del sector tech, que habilidades me convendria aprender o añadir? Priorizalas y explica brevemente por que cada una.`,
    );
  const consejosCv = () =>
    pedirIA(
      `${cvTexto}. Mis habilidades: ${skillsTexto}. Dame consejos concretos para mejorar mi CV: que destacar, que reforzar y errores comunes a evitar.`,
    );
  const compararGuardadas = () =>
    pedirIA(
      `Estas son las ofertas que tengo guardadas: ${marcadas
        .map((j) => `"${j.title}" en ${j.company}${j.location ? ` (${j.location})` : ''}`)
        .join('; ')}. Mis habilidades: ${skillsTexto}. Comparalas: cual me conviene mas y por que, y que me falta para cada una.`,
    );

  return (
    <>
      <header className="saludo">
        <h1>Tu perfil</h1>
        <p className="saludo__sub">
          Esto es lo que el motor de busqueda sabe de ti. Cambialo y mejora tus
          recomendaciones al instante.
        </p>
      </header>

      {/* Dos columnas: Habilidades (que es lo que mas ocupa) a la izquierda, y el
          resto apilado a la derecha. */}
      <div className="perfil">
      <section className="panel perfil__skills">
        <header className="seccion__cab">
          <span className="seccion__icono seccion__icono--cursos"><Icon name="chispa" size={20} /></span>
          <div className="seccion__txt">
            <h2 className="seccion__titulo">Habilidades</h2>
            <p className="seccion__sub">
              {perfil?.skills?.length
                ? 'Pulsa una habilidad para quitarla.'
                : 'Aun no tienes habilidades. Sube tu CV.'}
            </p>
          </div>
        </header>

        <ul className="chips chips--grandes">
          {skills.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="chip chip--btn chip--on"
                onClick={() => quitar(s)}
                disabled={ocupado}
                aria-label={`Quitar ${s}`}
              >
                {/* Logo real de la tecnologia (Devicon via CDN, ver SkillIcon). */}
                <SkillIcon skill={s} size={20} />
                {s}
                <Icon name="cerrar" size={14} />
              </button>
            </li>
          ))}
        </ul>

        <form className="perfil__skilladd" onSubmit={agregar}>
          <input
            className="perfil__skillinput"
            value={nuevaSkill}
            onChange={(e) => setNuevaSkill(e.target.value)}
            placeholder="Añadir una habilidad… (ej. kubernetes)"
            aria-label="Añadir habilidad"
            autoComplete="off"
            disabled={ocupado}
          />
          <button type="submit" className="btn btn--glass" disabled={ocupado || !nuevaSkill.trim()}>
            <Icon name="chispa2" size={18} /> Añadir
          </button>
        </form>

        <div className="perfil__ia">
          <button type="button" className="perfil__iabtn" onClick={sugerirSkills}>
            <Icon name="asistente" size={16} /> Sugerir habilidades
          </button>
          <button type="button" className="perfil__iabtn" onClick={analizarPerfil}>
            <Icon name="asistente" size={16} /> Analizar mi perfil
          </button>
        </div>
      </section>

      <div className="perfil__col">
      <section className="panel">
        <header className="seccion__cab">
          <span className="seccion__icono"><Icon name="maletin" size={20} /></span>
          <div className="seccion__txt">
            <h2 className="seccion__titulo">Curriculum</h2>
            <p className="seccion__sub">
              {perfil?.tieneCv
                ? `Tenemos tu CV (${perfil.cvLongitud} caracteres de texto). Sube uno nuevo para reemplazarlo.`
                : 'No tenemos tu CV.'}
            </p>
          </div>
        </header>

        <button
          type="button"
          className="btn btn--glass"
          onClick={() => inputArchivo.current?.click()}
          disabled={ocupado}
        >
          <Icon name="subir" size={18} />
          {ocupado ? 'Procesando…' : perfil?.tieneCv ? 'Reemplazar CV' : 'Subir CV'}
        </button>

        <input
          ref={inputArchivo}
          type="file"
          accept="application/pdf"
          className="sr-only"
          onChange={(e) => subir(e.target.files?.[0])}
        />

        <div className="perfil__ia">
          <button type="button" className="perfil__iabtn" onClick={consejosCv}>
            <Icon name="asistente" size={16} /> Consejos para mi CV
          </button>
        </div>

        {estado && (
          <p className={estado.tipo === 'ok' ? 'exito' : 'alerta'} role="status">
            <Icon name={estado.tipo === 'ok' ? 'ok' : 'aviso'} size={16} />
            {estado.texto}
          </p>
        )}
      </section>

      <AvisosTelegram />

      <section className="panel">
        <header className="seccion__cab">
          <span className="seccion__icono"><Icon name="usuario" size={20} /></span>
          <div className="seccion__txt">
            <h2 className="seccion__titulo">Sesion</h2>
            <p className="seccion__sub">
              {perfil?.email ? (
                <>
                  Sesion iniciada como <strong>{perfil.email}</strong>.
                </>
              ) : (
                'Sesion iniciada.'
              )}
            </p>
          </div>
        </header>

        <button type="button" className="btn btn--salir" onClick={salir}>
          <Icon name="salir" size={18} />
          Cerrar sesion
        </button>
      </section>
      </div>
      </div>

      {/* Ofertas guardadas: mismo sitio que "Tus ideas guardadas" del portafolio
          — lo que marcas vive en la pantalla de tus cosas. A ancho completo,
          debajo de las dos columnas, porque son tarjetas y necesitan aire. */}
      <section className="panel guardadas">
        <header className="seccion__cab">
          <span className="seccion__icono"><Icon name="marcador" size={20} /></span>
          <div className="seccion__txt">
            <h2 className="seccion__titulo">Ofertas guardadas</h2>
            <p className="seccion__sub">
              {marcadas.length
                ? `${marcadas.length} ${marcadas.length === 1 ? 'oferta guardada' : 'ofertas guardadas'}. Se quedan en este equipo.`
                : 'Las ofertas que marques con el marcador apareceran aqui.'}
            </p>
          </div>
        </header>

        {marcadas.length ? (
          <>
            <div className="guardadas__grid">
              {marcadas.map((j) => (
                <JobCard key={j.id} job={j} onOpen={setOfertaActiva} />
              ))}
            </div>
            {marcadas.length > 1 && (
              <div className="perfil__ia">
                <button type="button" className="perfil__iabtn" onClick={compararGuardadas}>
                  <Icon name="asistente" size={16} /> Comparar mis ofertas guardadas
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="guardadas__vacio">
            <Icon name="marcador" size={22} />
            <div>
              <strong>Todavia no has guardado ninguna oferta.</strong>
              <p>Abre una oferta y pulsa "Guardar oferta" para tenerla a mano.</p>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
