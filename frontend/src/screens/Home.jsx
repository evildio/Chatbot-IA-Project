import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { useVista } from '../lib/vista';
import JobCard from '../components/JobCard';
import Icon from '../components/Icon';
import Refrescar from '../components/Refrescar';

export default function Home() {
  const [recomendadas, setRecomendadas] = useState(null);
  const [exterior, setExterior] = useState(null);
  const [locales, setLocales] = useState(null);
  const [sinPerfil, setSinPerfil] = useState(false);
  const [version, recargar] = useState(0);
  // Filas EXTRA de ofertas en la primera pagina. En pantallas altas la fila
  // principal deja mucho hueco; se rellena con las filas que quepan (ver efecto).
  const [filasExtra, setFilasExtra] = useState(0);
  // Tarjetas que entran en UNA fila. En escritorio son 4 (destacada + 3); al
  // estrechar se apilan, asi que la primera pagina muestra solo las que caben.
  const [porFila, setPorFila] = useState(4);
  // La oferta abierta vive en el contexto compartido: asi el Asistente sabe
  // cual estas viendo. El modal se monta una sola vez en el Shell.
  const { setOfertaActiva, setContextoPantalla } = useVista();

  useEffect(() => {
    const calcular = () => {
      // Se mide el SCROLLER real (.lienzo), no la ventana: la app vive dentro de
      // un marco mas pequeño, y medir con innerHeight metia una fila que no cabia
      // y hacia que la pagina 1 se solapara con "Mas ofertas".
      const lienzo = document.querySelector('.lienzo');
      let disponible = window.innerHeight;
      let ancho = window.innerWidth;
      if (lienzo) {
        const cs = getComputedStyle(lienzo);
        disponible =
          lienzo.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        ancho = lienzo.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      }

      const CHROME = 150; // cabecera de la seccion + nota "haz scroll"
      const FILA = 430; // alto real de una fila de tarjetas (imagen + cuerpo)
      const filasQueCaben = Math.floor((disponible - CHROME) / FILA);

      if (window.innerWidth < 861) {
        // Aqui la fila es auto-fit (minmax 240px): caben 1 o 2 por fila. La
        // primera pagina muestra SOLO una fila; si mostrara las 4 de escritorio
        // se apilarian, no cabrian en la pantalla y el snap se las saltaba sin
        // dejarlas leer. El resto pasa a "Mas ofertas".
        setFilasExtra(0);
        setPorFila(Math.max(1, Math.min(2, Math.floor(ancho / 240))));
        return;
      }

      // En escritorio la fila es fija: destacada + 3.
      setPorFila(4);
      // Como MUCHO una fila extra (2 filas en total): mas romperia el snap. Y
      // solo si las 2 caben ENTERAS, para que no asome una tercera.
      setFilasExtra(filasQueCaben >= 2 ? 1 : 0);
    };

    // Tras el primer pintado: antes, .lienzo aun no esta en el DOM.
    const id = requestAnimationFrame(calcular);
    window.addEventListener('resize', calcular);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', calcular);
    };
  }, []);

  useEffect(() => {
    let vivo = true;

    api
      .recomendadas(12)
      .then((r) => vivo && setRecomendadas(r.jobs))
      .catch((err) => {
        if (!vivo) return;
        // 409 = el perfil aun no tiene embedding. No es un error: es un usuario
        // que no ha terminado el onboarding.
        if (err instanceof ApiError && err.status === 409) setSinPerfil(true);
        setRecomendadas([]);
      });

    api.ofertas({ scope: 'foreign', limit: 12 }).then((r) => vivo && setExterior(r.jobs));
    api.ofertas({ scope: 'local', limit: 12 }).then((r) => vivo && setLocales(r.jobs));

    return () => {
      vivo = false;
    };
  }, [version]);

  const cargando = recomendadas === null;
  const destacada = recomendadas?.[0];
  // Solo las que caben en la fila (ver `porFila`): lo que no cabe se ve en
  // "Mas ofertas" en vez de quedar fuera de pantalla.
  const chicas = recomendadas?.slice(1, porFila) ?? [];

  // El Asistente sabe que ofertas tienes delante: asi "cual me conviene mas?" o
  // "hablame de la primera" tienen sentido sin que se las describas.
  useEffect(() => {
    if (!recomendadas?.length) return undefined;
    setContextoPantalla(
      `El usuario esta en "Ofertas nuevas" (su home), viendo ${recomendadas.length} ofertas recomendadas para su perfil. Las de arriba son: ${recomendadas
        .slice(0, 4)
        .map((j) => `${j.title} en ${j.company}${j.score != null ? ` (${Math.round(j.score * 100)}% afin)` : ''}`)
        .join('; ')}.`,
    );
    return () => setContextoPantalla(null);
  }, [recomendadas, setContextoPantalla]);

  // "Mas ofertas": el resto de recomendadas + exterior + locales, sin repetir.
  // Asi la home conserva el valor de exterior/local que el mock no muestra.
  const vistos = new Set(recomendadas?.slice(0, porFila).map((j) => j.id));
  const mas = [];
  for (const j of [...(recomendadas?.slice(porFila) ?? []), ...(exterior ?? []), ...(locales ?? [])]) {
    if (j && !vistos.has(j.id)) {
      vistos.add(j.id);
      mas.push(j);
    }
  }

  // Las que suben a la primera pagina para rellenar el hueco, y las que quedan
  // para "Mas ofertas".
  const extras = mas.slice(0, filasExtra * 4);
  const masRestante = mas.slice(filasExtra * 4);

  return (
    <>
      {/* Pagina 1: "Ofertas nuevas" — una fila de 4 (destacada + 3). El contenido
          va dentro de .ofertas-blink: un wrapper "sticky" que se queda fijo en la
          columna mientras la seccion scrollea, y se funde (blink) con la scroll
          timeline de la seccion. Ver .ofertas-pagina--blink en ui.css. */}
      <section className="ofertas-pagina ofertas-pagina--blink">
       <div className="ofertas-blink">
        <header className="ofertas__cab">
          <div>
            <h1>Ofertas nuevas</h1>
            <p className="saludo__sub">
              {cargando
                ? 'Buscando lo mejor para ti…'
                : recomendadas.length
                ? `${recomendadas.length} oportunidades encontradas para ti`
                : 'Aun no hay recomendaciones para ti'}
            </p>
            <Refrescar onFin={() => recargar((n) => n + 1)} />
          </div>
        </header>

        {sinPerfil && (
          <div className="aviso-panel">
            <Icon name="aviso" size={20} />
            <div>
              <strong>Aun no sabemos que buscas.</strong>
              <p>Sube tu CV o dinos tus habilidades para recibir recomendaciones.</p>
            </div>
            <Link to="/onboarding" className="btn btn--primario">
              Completar perfil
            </Link>
          </div>
        )}

        {cargando ? (
          <div className="ofertas__fila">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card card--esqueleto" aria-hidden="true" />
            ))}
          </div>
        ) : recomendadas.length ? (
          <div className="ofertas__fila">
            <JobCard job={destacada} onOpen={setOfertaActiva} destacada />
            {chicas.map((j) => (
              <JobCard key={j.id} job={j} onOpen={setOfertaActiva} />
            ))}
          </div>
        ) : (
          <p className="vacio">Todavia no hay recomendaciones. Completa tu perfil.</p>
        )}

        {/* Filas extra: rellenan el hueco vertical en pantallas altas. */}
        {!cargando && extras.length > 0 && (
          <div className="ofertas__fila ofertas__fila--extra">
            {extras.map((j) => (
              <JobCard key={j.id} job={j} onOpen={setOfertaActiva} />
            ))}
          </div>
        )}

        {masRestante.length > 0 && (
          <p className="ofertas__scroll" aria-hidden="true">
            <Icon name="derecha" size={18} className="ofertas__scroll-flecha" />
            Haz scroll para ver mas ofertas
          </p>
        )}
       </div>
      </section>

      {/* Pagina 2: "Mas ofertas" — rejilla de 4 columnas. */}
      {masRestante.length > 0 && (
        <section className="ofertas-pagina ofertas__mas">
          <div>
            <h2 className="carrusel__title">Mas ofertas</h2>
            <p className="saludo__sub">Sigue explorando oportunidades para ti</p>
          </div>
          <div className="ofertas__rejilla">
            {masRestante.slice(0, 12).map((j) => (
              <JobCard key={j.id} job={j} onOpen={setOfertaActiva} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
