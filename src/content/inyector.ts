// src/content/inyector.ts
// Inyector UI Notas – botón + barra lateral con toggle, animación y observador con debounce.

//////////////////////////
// Constantes y Selectores
//////////////////////////
// OJO: usamos el contenedor del micrófono (más estable para anclar).
const MIC_CONTAINER_SEL = '[data-testid="composer-speech-button-container"]';
const ACTIONS_SEL       = '[data-testid="composer-footer-actions"]';

const ID_BOTON   = 'uc-notes-button';
const ID_LATERAL = 'uc-notes-sidebar';
const ID_STYLES  = 'uc-notes-styles';

// Archivos declarados en web_accessible_resources (sin "public/")
const RUTA_BOTON   = 'recursos/boton-notas.html';
const RUTA_LATERAL = 'recursos/barra-lateral.html';

console.log('[Notas] inyector cargado');

//////////////////////////
// Utilidades
//////////////////////////
const runtimeURL = (p: string) => chrome.runtime.getURL(p);

async function cargarHTML(ruta: string): Promise<Element | null> {
  try {
    const html = await fetch(runtimeURL(ruta)).then(r => r.text());
    const wrap = document.createElement('div');
    wrap.innerHTML = (html || '').trim();
    return wrap.firstElementChild;
  } catch (e) {
    console.warn('[Notas] Error cargando', ruta, e);
    return null;
  }
}

function visible(el: Element | null): el is HTMLElement {
  const h = el as HTMLElement | null;
  return !!(h && h.offsetParent !== null);
}

//////////////////////////
// Estado abrir/cerrar
//////////////////////////
function setOpen(open: boolean){
  document.documentElement.classList.toggle('uc-notes-open', open);
}
function toggleOpen(){
  const open = !document.documentElement.classList.contains('uc-notes-open');
  setOpen(open);
}

//////////////////////////
// Estilos base (una sola vez)
//////////////////////////
function ensureBaseStyles(): void {
  if (document.getElementById(ID_STYLES)) return;

  const style = document.createElement('style');
  style.id = ID_STYLES;
  style.textContent = `
    :root { --uc-notes-width: 320px; }

    /* Lateral fijo a la derecha con animación */
    #${ID_LATERAL}{
      position: fixed;
      top: 0;
      right: 0;
      height: 100vh;
      width: var(--uc-notes-width);
      z-index: 2147483000;
      display: flex;
      flex-direction: column;
      pointer-events: auto;
      box-shadow: -8px 0 20px rgba(0,0,0,.08);
      background: transparent;

      transform: translateX(100%);
      transition: transform .22s ease;
      pointer-events: none; /* cerrado */
    }
    #${ID_LATERAL} > * {
      height: 100%;
      max-height: 100%;
      box-sizing: border-box;
    }
    html.uc-notes-open #${ID_LATERAL}{
      transform: translateX(0);
      pointer-events: auto;
    }

    /* Empuja el contenido principal al abrir */
    html.uc-notes-open :is(main, #__next){
      padding-right: var(--uc-notes-width);
      transition: padding-right .22s ease;
    }

    /* Robustez */
    #${ID_LATERAL}, #${ID_LATERAL} * { box-sizing: border-box; }

    /* Responsivo */
    @media (max-width: 1200px){
      :root { --uc-notes-width: 280px; }
    }
    @media (max-width: 1024px){
      html.uc-notes-open :is(main, #__next){ padding-right: 0; }
      html.uc-notes-open #${ID_LATERAL}{ transform: translateX(0); width: 100vw; }
    }
  `;
  document.head.appendChild(style);
}

//////////////////////////
// Dónde anclar los nodos
//////////////////////////

/** Devuelve el grupo derecho (parent del mic) y el nodo del mic. */
function grupoDerechaYMic():
  | { grupo: HTMLElement; mic: HTMLElement }
  | null {
  const mic = document.querySelector(MIC_CONTAINER_SEL) as HTMLElement | null;
  if (!mic) return null;
  const grupo = mic.parentElement as HTMLElement | null;
  if (!grupo) return null;
  return { grupo, mic };
}

/** Fallback por si el grupo no se detecta aún: usamos el contenedor de acciones visible. */
function contenedorAccionesFallback(): HTMLElement | null {
  const visibles = Array.from(document.querySelectorAll(ACTIONS_SEL)) as HTMLElement[];
  return visibles.find(visible) ?? null;
}

function hostLateral(): HTMLElement {
  return (
    (document.querySelector('#__next') as HTMLElement) ||
    (document.querySelector('main') as HTMLElement) ||
    document.body
  );
}

//////////////////////////
// Cableado del botón (toggle)
//////////////////////////
function wireToggleWithButton(){
  const btn = document.getElementById(ID_BOTON);
  if (!btn) return;
  if ((btn as any).__ucWired) return;
  (btn as any).__ucWired = true;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    toggleOpen();
  });

  // Cerrar con ESC
  window.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') setOpen(false);
  });
}

//////////////////////////
// Inyectores
//////////////////////////
async function asegurarBoton(): Promise<void> {
  // 1) Intento ideal: al lado del mic (mismo grupo)
  const gm = grupoDerechaYMic();
  const destinoPrimario = gm?.grupo ?? null;
  const mic = gm?.mic ?? null;

  // 2) Fallback: contenedor de acciones visible (no es perfecto pero evita que falte)
  const destinoFallback = contenedorAccionesFallback();

  const destino = destinoPrimario ?? destinoFallback;
  if (!destino) return;

  const existente = document.getElementById(ID_BOTON) as HTMLElement | null;

  // Si ya existe, reubícalo y coloca su posición relativa al mic si lo tenemos.
  if (existente) {
    if (existente.parentElement !== destino) {
      destino.appendChild(existente);
      console.log('[Notas] Botón movido');
    }
    if (destinoPrimario && mic && existente.previousElementSibling !== mic) {
      // colócalo inmediatamente DESPUÉS del mic (cámbialo a 'beforebegin' si lo quieres a la izquierda)
      mic.insertAdjacentElement('afterend', existente);
    }
    wireToggleWithButton();
    return;
  }

  // Crear el botón
  const nodo = (await cargarHTML(RUTA_BOTON)) as HTMLElement | null;
  if (!nodo) return;
  nodo.id = ID_BOTON;

  // Posicionar
  if (destinoPrimario && mic) {
    mic.insertAdjacentElement('afterend', nodo); // a la DERECHA del mic
  } else {
    // Fallback: al final del contenedor de acciones
    destino.appendChild(nodo);
  }

  console.log('[Notas] Botón montado');
  wireToggleWithButton();
}

async function asegurarLateral(): Promise<void> {
  if (document.getElementById(ID_LATERAL)) return;

  ensureBaseStyles();

  const host = hostLateral();
  const interior = await cargarHTML(RUTA_LATERAL);
  if (!interior) return;

  const wrapper = document.createElement('div');
  wrapper.id = ID_LATERAL;
  wrapper.appendChild(interior);

  host.appendChild(wrapper);
  console.log('[Notas] Lateral montado y posicionado');

  // Abre la primera vez para que el usuario lo vea
  setOpen(true);
}

//////////////////////////
// Observador con debounce
//////////////////////////
function observar(): void {
  const ensureAll = () => { asegurarBoton(); asegurarLateral(); };

  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; ensureAll(); }, 100);
  };

  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });

  // Montaje inicial
  ensureAll();
}

//////////////////////////
// Boot
//////////////////////////
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => observar(), { once: true });
} else {
  observar();
}
