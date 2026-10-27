  function iniciarVivo() {
    if (!/^https?:$/.test(location.protocol) || typeof EventSource !== 'function') return;
    const caja = $('#en-vivo');
    const filas = $('#en-vivo-filas');
    const anuncio = $('#anuncio-vivo');
    const ANUNCIADOS = new Set(['usuario', 'fin', 'espera', 'falla', 'choque']);
    const estadoTxt = $('#en-vivo-estado');
    const recargar = $('#en-vivo-recargar');
    const cajaUso = $('#en-vivo-uso');
    const modoColor = $('#modo-color');
    const COLOR = { leer: '#38bdf8', buscar: '#f59e0b', editar: '#f97316', crear: '#22c55e', ejecutar: '#94a3b8', agente: '#a78bfa', web: '#60a5fa', consulta: '#e879f9', otro: '#94a3b8' };
    const NOMBRE = { leer: 'lee', buscar: 'busca', editar: 'edita', crear: 'crea', ejecutar: 'ejecuta', agente: 'lanza', web: 'abre', consulta: 'consulta', otro: 'usa' };
    const OPCIONES_CEREBRO = new Set(lista(DATOS.opcionesConsulta));
    const LOBULO_CONSULTA = 'temporal';
    const HERRAMIENTA = {
      computer: ['mira', 'la pantalla'], navigate: ['abre', 'una página'], javascript_tool: ['prueba', 'en la página'],
      read_page: ['lee', 'la página'], get_page_text: ['lee', 'la página'], find: ['busca', 'en la página'],
      form_input: ['completa', 'un formulario'], read_console_messages: ['lee', 'la consola'], read_network_requests: ['mira', 'la red'],
      tabs_context: ['mira', 'las pestañas'], tabs_context_mcp: ['mira', 'las pestañas'], tabs_create: ['abre', 'una pestaña'],
      tabs_create_mcp: ['abre', 'una pestaña'], tabs_close: ['cierra', 'una pestaña'], tabs_close_mcp: ['cierra', 'una pestaña'],
      tabs_select: ['cambia', 'de pestaña'], resize_window: ['ajusta', 'la ventana'], browser_batch: ['usa', 'el navegador'],
      preview_start: ['abre', 'una vista previa'], preview_stop: ['cierra', 'una vista previa'], preview_logs: ['lee', 'los registros'],
      gif_creator: ['graba', 'la pantalla'], upload_image: ['sube', 'una imagen'], file_upload: ['sube', 'un archivo'],
      read_terminal: ['lee', 'la terminal'], show_widget: ['dibuja', 'un gráfico'],
      Task: ['lanza', 'un agente'], Agent: ['lanza', 'un agente'], Workflow: ['lanza', 'varios agentes'],
      Skill: ['usa', 'una skill'], TodoWrite: ['anota', 'sus tareas'], WebFetch: ['abre', 'una página web'],
      AskUserQuestion: ['te pregunta', 'algo'], ExitPlanMode: ['propone', 'un plan'], SendMessage: ['manda', 'un mensaje'],
      StructuredOutput: ['entrega', 'el resultado'], Monitor: ['vigila', 'un proceso'], Artifact: ['publica', 'una página'],
      SendUserFile: ['te manda', 'un archivo'], mark_chapter: ['marca', 'un capítulo'], spawn_task: ['sugiere', 'una tarea']
    };
    const nombreHerramienta = ev => {
      const base = String(ev.h || '').split('__').pop();
      return presenta.anonimo && !HERRAMIENTA[base] ? '' : base;
    };
    const verboDe = ev => {
      if (EVENTO[ev.e] || (ev.k !== 'otro' && ev.k !== 'agente' && ev.k !== 'web')) return null;
      const base = nombreHerramienta(ev);
      return HERRAMIENTA[base] || (ev.k === 'agente' ? ['lanza', 'un agente'] : ev.k === 'web' ? ['abre', 'una página web'] : ['usa', base.replace(/_/g, ' ') || 'una herramienta']);
    };
    const COMANDO = { commit: 'commit', compila: 'compila', prueba: 'prueba', git: 'git', base: 'base', cerebro: 'cerebro', lee: 'lee', busca: 'busca', lista: 'lista', python: 'python', node: 'node', red: 'red', archivos: 'archivos', sistema: 'sistema', script: 'script', otro: 'ejecuta' };
    const COLOR_COMANDO = { commit: '#22c55e', compila: '#fb923c', prueba: '#2dd4bf', git: '#a3e635', base: '#fb7185', lee: '#38bdf8', busca: '#f59e0b', lista: '#7dd3fc', python: '#fde047', node: '#34d399', red: '#60a5fa', archivos: '#c4b5fd', sistema: '#d6d3d1', script: '#f472b6' };
    const RAFAGA_COMANDOS = 60;
    const SIN_RAFAGA = new Set(['commit', 'compila', 'prueba']);
    const segundosDe = ev => Number.isFinite(ev.d) ? ev.d / 1000 : ev._dur;
    const duracionTexto = s => s >= 90 ? Math.round(s / 60) + ' min' : Math.round(s) + ' s';
    const GOLPE = { leer: 0.65, editar: 1.1, crear: 1.1 };
    const EVENTO = {
      usuario: [USUARIO || 'Usuario', 'var(--texto)', 'escribió un mensaje'],
      fin: ['listo', '#22c55e', 'terminó de responder'],
      espera: ['espera', '#eab308', 'espera tu OK'],
      compacta: ['comprime', '#a78bfa', 'comprime su memoria'],
      inicio: ['abre', '#38bdf8', 'chat abierto'],
      cierre: ['cierra', '#94a3b8', 'chat cerrado'],
      'sub-fin': ['agente', '#a78bfa', 'un agente terminó'],
      falla: ['falló', '#ef4444', 'una herramienta falló'],
      aviso: ['pista', '#38bdf8', 'Neuromapa le pasó qué leer primero'],
      recuerda: ['recuerda', '#38bdf8', 'al editar un archivo, Neuromapa le recordó la nota que suele ir con él'],
      guarda: ['guardar', '#38bdf8', 'Neuromapa le recordó anotar en la memoria lo decidido'],
      choque: ['choque', '#ef4444', 'dos chats o agentes editaron el mismo archivo con menos de ' + MINUTOS_CHOQUE + ' min entre uno y otro']
    };
    const ESTADO_TXT = { trabajando: 'trabajando', esperando: 'espera tu OK', compactando: 'comprimiendo su memoria', listo: 'listo', cerrado: 'cerrado' };
    const colorEvento = ev => (EVENTO[ev.e] && EVENTO[ev.e][1]) || (ev.k === 'ejecutar' && COLOR_COMANDO[ev.b]) || COLOR[ev.k] || COLOR.otro;
    const nombreEvento = ev => {
      if (ev.e === 'usuario') return publico('persona', null, EVENTO.usuario[0]) || 'mensaje';
      if (EVENTO[ev.e]) return EVENTO[ev.e][0];
      if (ev.k === 'ejecutar' && ev.b) return COMANDO[ev.b] || 'ejecuta';
      const v = verboDe(ev);
      return v ? v[0] : NOMBRE[ev.k] || ev.k || 'usa';
    };
    const QUE_HACE = { leer: 'lee una nota o un archivo', buscar: 'busca texto en archivos', editar: 'edita un archivo', crear: 'crea un archivo', ejecutar: 'corre un comando', agente: 'lanza un agente', web: 'abre una página web', consulta: 'le pregunta a Neuromapa (--sobre, --parecidas…); los rayos salen del lóbulo de la memoria hacia las notas que le recomendó', otro: 'usa otra herramienta (mira, anota, completa…)' };
    const QUE_COMANDO = { commit: 'hace un commit', compila: 'compila', prueba: 'corre una prueba', git: 'usa git', base: 'consulta una base de datos', cerebro: 'regenera el cerebro', lee: 'lee archivos por consola', busca: 'busca texto o archivos por consola', lista: 'lista carpetas', python: 'corre Python', node: 'corre Node o npm', red: 'se conecta a la red', archivos: 'copia, mueve o borra archivos', sistema: 'mira o cambia algo del sistema', script: 'corre un script' };
    const MOTIVO_PISTA = {
      p: ['por tus palabras', COLOR.consulta, 'rayo de la pista: eligió la nota porque el pedido coincide con un tramo de ella', 'por palabras'],
      i: ['la nombra un índice', '#4ade80', 'rayo de la pista: la eligió porque la nombra un índice, como el MEMORY.md', 'por índice'],
      a: ['aprendida', '#fbbf24', 'rayo de la pista: la eligió porque se suele leer junto con la primera (lo aprendió del uso)', 'aprendida']
    };
    const ACLARA_LEYENDA = { lee: ' (consola)', busca: ' (consola)', inicio: ' (chat)', cierre: ' (chat)' };
    vivo.leyenda = () => Object.keys(COLOR).map(k => [NOMBRE[k], COLOR[k], QUE_HACE[k] || ''])
      .concat(Object.keys(COLOR_COMANDO).map(k => [COMANDO[k] + (ACLARA_LEYENDA[k] || ''), COLOR_COMANDO[k], QUE_COMANDO[k] || '']))
      .concat(Object.keys(EVENTO).map(k => k === 'usuario' ? [nombreEvento({ e: k }), EVENTO[k][1], EVENTO[k][2]] : [EVENTO[k][0] + (ACLARA_LEYENDA[k] || ''), EVENTO[k][1], EVENTO[k][2]]))
      .concat(Object.values(MOTIVO_PISTA).map(m => ['pista: ' + m[0], m[1], m[2]]));
    const archivos = new Map();
    let archivosT = 0;
    const cajaProg = $('#en-vivo-prog');
    const ESCALA = ['#6b7280', '#3b82f6', '#22d3ee', '#facc15', '#f97316', '#ef4444'];
    const RANGOS = ['nunca', '1-2', '3-5', '6-12', '13-30', '31 o más'];
    const nivel = c => c <= 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 12 ? 3 : c <= 30 ? 4 : 5;
    const PESO_BUSCAR = 0.5;
    const TIPOS_FIJOS = new Set(['handoff', 'indice', 'instrucciones', 'feedback']);
    const clave = r => {
      let x = normRuta(r);
      const par = ALIAS_RUTAS.find(([desde]) => x.startsWith(desde));
      if (par) x = par[1] + x.slice(par[0].length);
      return x.replace(/\/\.claude\/worktrees\/[^/]+/, '');
    };
    const PALETA_AGENTES = ['#fde047', '#4ade80', '#38bdf8', '#f472b6', '#c084fc', '#fb7185', '#2dd4bf', '#fdba74'];
    const colorAgente = s => PALETA_AGENTES[hashTexto('agente' + s) % PALETA_AGENTES.length];
    const porRuta = new Map();
    nodos.forEach(n => porRuta.set(clave(n.ruta), n));
    const rutasLeidas = ev => !ev.f && (ev.k === 'leer' || ev.k === 'buscar') && Array.isArray(ev.fs)
      ? ev.fs.filter(r => typeof r === 'string' && r).slice(0, 5) : [];
    const porConsola = ev => (ev.h === 'Bash' || ev.h === 'PowerShell') && rutasLeidas(ev).length > 0;
    const recomendadas = ev => (ev.k === 'consulta' || ev.e === 'aviso' || ev.e === 'recuerda') && Array.isArray(ev.fs)
      ? ev.fs.filter(r => typeof r === 'string' && /\.md$/i.test(r)).slice(0, 5) : [];
    function notasRecomendadas(ev) {
      if (ev._recomendadas) return ev._recomendadas;
      const lista = [];
      recomendadas(ev).forEach(r => {
        const n = porRuta.get(clave(r));
        if (n && !lista.includes(n)) lista.push(n);
      });
      ev._recomendadas = lista;
      return lista;
    }
    function pistaDe(ev) {
      if (ev._pista) return ev._pista;
      const fs = Array.isArray(ev.fs) ? ev.fs : [];
      const fp = ev.e === 'aviso' && Array.isArray(ev.fp) && ev.fp.length === fs.length ? ev.fp : [];
      const lista = [];
      fs.forEach((r, i) => {
        if (typeof r !== 'string' || !/\.md$/i.test(r) || lista.length >= 5) return;
        const n = porRuta.get(clave(r));
        if (!n || lista.some(x => x.n === n)) return;
        const m = Array.isArray(fp[i]) && MOTIVO_PISTA[fp[i][0]] ? fp[i] : null;
        lista.push({ n, motivo: m ? m[0] : '', linea: m ? m[1] : 0, fin: m ? m[2] : 0, origen: m && m[3] ? porRuta.get(clave(m[3])) || null : null });
      });
      ev._pista = lista;
      return lista;
    }
    function seccionDe(n, linea) {
      const renglones = String(n.texto || '').split('\n');
      for (let i = Math.min(renglones.length, linea - (n.desfase || 0)) - 1; i >= 0; i--) {
        const m = /^#{1,6}\s+(.+?)[\s#]*$/.exec(renglones[i]);
        if (m) return m[1].replace(/[*_`]/g, '').trim().slice(0, 60);
      }
      return '';
    }
    function razonPista(x, conTramo) {
      const m = MOTIVO_PISTA[x.motivo];
      if (!m) return '';
      let texto = x.motivo === 'i' && x.origen ? 'la nombra ' + tituloVisto(x.origen)
        : x.motivo === 'a' && x.origen ? 'se suele leer junto con ' + tituloVisto(x.origen) : m[0];
      if (conTramo && x.linea > 0) {
        const seccion = presenta.anonimo ? '' : seccionDe(x.n, x.linea);
        texto += ' (renglones ' + x.linea + (x.fin > x.linea ? '-' + x.fin : '') + (seccion ? ', «' + seccion + '»' : '') + ')';
      }
      return texto;
    }
    function resumenPista(ev) {
      const cuenta = {};
      pistaDe(ev).forEach(x => { if (x.motivo) cuenta[x.motivo] = (cuenta[x.motivo] || 0) + 1; });
      return Object.keys(MOTIVO_PISTA).filter(k => cuenta[k]).map(k => cuenta[k] + ' ' + MOTIVO_PISTA[k][3]).join(' · ');
    }
    const ultimaPista = new Map();
    function recordarPista(ev) {
      if (ev.e !== 'aviso' || ev.demo) return;
      pistaDe(ev).forEach(x => { if (x.motivo) ultimaPista.set(x.n, { t: ev.t, x }); });
    }
    vivo.porQuePista = n => {
      const u = ultimaPista.get(n);
      return u ? 'La pista la eligió ' + hace(u.t) + ': ' + razonPista(u.x, true) + '.' : '';
    };
    const opcionConsulta = ev => OPCIONES_CEREBRO.has(ev.p) ? '--' + ev.p : '';
    const textoConsulta = ev => {
      const cuantas = recomendadas(ev).length;
      return ['a Neuromapa', opcionConsulta(ev)].filter(Boolean).join(' · ') + (cuantas ? ' → ' + cuantas + (cuantas === 1 ? ' nota' : ' notas') : '');
    };
    function notasDe(ev) {
      if (ev._notas) return ev._notas;
      const lista = [];
      (ev.f ? [ev.f] : rutasLeidas(ev)).forEach(r => {
        const n = porRuta.get(clave(r));
        if (n && !lista.includes(n)) lista.push(n);
      });
      ev._notas = lista;
      return lista;
    }
    const notaDe = ev => notasDe(ev)[0] || null;
    const archivoCorto = r => publico('archivo', r, String(r).replace(/\\/g, '/').split('/').filter(Boolean).pop() || String(r));
    const tituloVisto = (n, max) => publico('nota', n, max ? tituloCorto(n, max) : n.titulo);
    const yMas = cuantas => cuantas > 0 ? ' y ' + cuantas + ' más' : '';
    const tramoLeido = ev => {
      const r = ev.r;
      if (!Array.isArray(r) || r.length !== 3 || !r.every(x => Number.isFinite(x)) || r[1] <= 0 || r[1] >= r[2]) return '';
      return r[1] === 1 ? 'línea ' + r[0] + ' de ' + r[2] : 'líneas ' + r[0] + '-' + (r[0] + r[1] - 1) + ' de ' + r[2];
    };
    const PREFERIDO = { instrucciones: 0, indice: 1, user: 2 };
    const porCarpeta = new Map();
    nodos.forEach(n => {
      const dir = clave(n.ruta).replace(/\/[^/]*$/, '');
      const otro = porCarpeta.get(dir);
      const peso = x => (PREFERIDO[x.tipo] === undefined ? 9 : PREFERIDO[x.tipo]) * 1000 - (x.salientes.length + x.entrantes.length);
      if (!otro || peso(n) < peso(otro)) porCarpeta.set(dir, n);
    });
    function anclaDe(ruta) {
      let dir = clave(ruta).replace(/\/+$/, '');
      while (dir.includes('/')) {
        const n = porCarpeta.get(dir);
        if (n && n._visible) return n;
        dir = dir.replace(/\/[^/]*$/, '');
      }
      return null;
    }
    const anclaEvento = ev => (ev.f && anclaDe(ev.f)) || (rutasLeidas(ev).length && anclaDe(rutasLeidas(ev)[0])) || (ev.c && anclaDe(ev.c)) || vivo.previo;
    const nombreCorto = ev => {
      if (ev.k === 'consulta' && !ev.f) return textoConsulta(ev);
      if (ev.f) {
        const n = notaDe(ev);
        return n ? publico('nota', n, archivoCorto(ev.f)) : archivoCorto(ev.f);
      }
      const fs = rutasLeidas(ev);
      if (fs.length) return archivoCorto(fs[0]) + yMas(fs.length - 1);
      const v = verboDe(ev);
      const p = publico('texto', ev, ev.p);
      if (v) return [v[1], p].filter(Boolean).join(' · ') || v[0];
      return p || nombreHerramienta(ev) || 'una herramienta';
    };
    const nombreFalla = ev => {
      const base = nombreHerramienta(ev) || 'una herramienta';
      const n = notaDe(ev);
      const fs = rutasLeidas(ev);
      const cual = n ? tituloVisto(n) + yMas(ev.f ? 0 : notasDe(ev).length - 1) : ev.f || fs.length || ev.k === 'consulta' ? nombreCorto(ev) : ev.k === 'ejecutar' && ev.b && ev.b !== 'otro' ? COMANDO[ev.b] : '';
      return cual ? base + ' · ' + cual : base;
    };
    const frase = ev => {
      if (ev.e === 'falla') return 'falló ' + recortar(nombreFalla(ev), 24);
      if (ev.k === 'consulta') return ['consulta a Neuromapa', opcionConsulta(ev)].filter(Boolean).join(' ');
      if (ev.f) return nombreEvento(ev) + ' ' + recortar(nombreCorto(ev), 24);
      const fs = rutasLeidas(ev);
      if (fs.length) return nombreEvento(ev) + ' ' + recortar(archivoCorto(fs[0]), 24) + yMas(fs.length - 1);
      const v = verboDe(ev);
      return v ? (v[0] + ' ' + v[1]).trim() : nombreEvento(ev);
    };
    let detallesAbiertos = false;

    function brillo(x, y, R, color, alfa) {
      if (!/^#[0-9a-f]{6}$/i.test(color) || alfa <= 0) return;
      pctx.globalAlpha = Math.min(1, alfa) * (anim.oscuro ? 1 : 0.6);
      pctx.drawImage(sprite(color, 'brillo'), x - R, y - R, 2 * R, 2 * R);
    }
    const anchoEtiqueta = texto => { pctx.font = FUENTE; return pctx.measureText(texto).width + 14; };
    const bajoPanel = (x0, y0, x1, y1) => {
      const t = vivo.tapaPanel;
      return !!t && x0 < t[2] && x1 > t[0] && y0 < t[3] && y1 > t[1];
    };
    function etiqueta(x, y, texto, color, alfa, izquierda) {
      const w = anchoEtiqueta(texto);
      let bx = izquierda ? x - w : x;
      if (bajoPanel(bx, y - 11, bx + w, y + 11)) bx = vivo.tapaPanel[2] + 8;
      bx = Math.max(4, Math.min(bx, ancho - 4 - w));
      if (alfa > 0.2) vivo.tapas.push([bx, y - 11, bx + w, y + 11]);
      pctx.globalAlpha = alfa;
      pctx.fillStyle = anim.oscuro ? 'rgba(10, 12, 18, 0.82)' : 'rgba(255, 255, 255, 0.94)';
      pctx.beginPath();
      redondeado(bx, y - 11, w, 22, 7, pctx);
      pctx.fill();
      pctx.strokeStyle = color;
      pctx.lineWidth = 1.2;
      pctx.stroke();
      pctx.fillStyle = anim.oscuro ? '#f8fafc' : '#111827';
      pctx.textBaseline = 'middle';
      pctx.textAlign = 'left';
      pctx.fillText(texto, bx + 7, y + 0.5);
    }
    DIBUJO_EFECTO.olvido = (e, p) => {
      const n = e.n;
      if (!n._en || n._cabeza) return;
      dibujarCabeza(pctx, n, n._sx, n._sy, n._sr, e.color, e.alfa * (1 - seno(p)));
    };
    DIBUJO_EFECTO.aro = (e, p, eL) => {
      const n = e.n;
      if (!n._en) return;
      const q = sale3(p);
      if (!e.guion) {
        if (p < 0.5) brillo(n._sx, n._sy, n._sr * 2.8 + 22, e.color, 1 - p * 2);
        pctx.globalAlpha = 0.6 * (1 - q);
        pctx.fillStyle = e.color;
        pctx.beginPath();
        trazarForma(n, n._sx, n._sy, n._sr + 1.5, pctx);
        pctx.fill();
      }
      pctx.globalAlpha = (e.guion ? 0.85 : 1) * (1 - q);
      pctx.strokeStyle = e.color;
      pctx.lineWidth = e.guion ? 2.2 - q : 4 - 2.8 * q;
      pctx.setLineDash(e.guion ? [5, 4] : []);
      pctx.beginPath();
      trazarForma(n, n._sx, n._sy, n._sr + 3 + 46 * eL * q, pctx);
      pctx.stroke();
      if (!e.guion) {
        const q2 = sale3(Math.min(1, p * 1.7));
        pctx.globalAlpha = 0.75 * (1 - q2);
        pctx.lineWidth = 1.6;
        pctx.beginPath();
        trazarForma(n, n._sx, n._sy, n._sr + 3 + 24 * eL * q2, pctx);
        pctx.stroke();
      }
      pctx.setLineDash([]);
    };
    DIBUJO_EFECTO.rastro = (e, p) => {
      const a = e.desde;
      const b = e.hacia;
      const q = p < 0.12 ? sale3(p / 0.12) : 1;
      const [cx, cy] = controlCurva(a, b);
      const x = puntoCurva(a._sx, cx, b._sx, q);
      const y = puntoCurva(a._sy, cy, b._sy, q);
      const al = 1 - sale3(Math.max(0, (p - 0.12) / 0.88));
      pctx.strokeStyle = e.color;
      pctx.lineCap = 'round';
      pctx.globalAlpha = 0.25 * al;
      pctx.lineWidth = 9;
      pctx.beginPath();
      trazarCurvaHasta(pctx, a._sx, a._sy, cx, cy, b._sx, b._sy, q);
      pctx.stroke();
      pctx.globalAlpha = 0.95 * al;
      pctx.lineWidth = 2.8;
      pctx.stroke();
      pctx.lineCap = 'butt';
      if (p < 0.14) {
        brillo(x, y, 20, e.color, 1);
        pctx.globalAlpha = 1;
        pctx.fillStyle = e.color;
        pctx.beginPath();
        pctx.arc(x, y, 4.2, 0, TAU);
        pctx.fill();
      }
    };
    const cajaSatelite = (ang, orden, texto) => {
      const d = 34 + 26 * orden;
      const x = Math.cos(ang) * d;
      const y = Math.sin(ang) * d;
      const w = anchoEtiqueta(texto);
      return x < 0 ? [x - 16 - w, y - 11, x + 6, y + 11] : [x - 6, y - 11, x + 16 + w, y + 11];
    };
    function anguloSatelite(ancla, nombre, texto, orden) {
      const otros = anim.efectos.filter(e => e.tipo === 'satelite' && e.n === ancla).map(e => cajaSatelite(e.ang, e.orden, e.texto));
      const base = (hashTexto(nombre) % 628) / 100;
      for (let i = 0; i < 12; i++) {
        const ang = base + i * 2.39996;
        if (!choca(cajaSatelite(ang, orden, texto), otros)) return ang;
      }
      return base;
    }
    DIBUJO_EFECTO.satelite = (e, p, eL) => {
      const n = e.n;
      if (!n._en) return;
      const entra = Math.min(1, p / 0.06);
      const al = entra * (p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1);
      const d = n._sr + (34 + 26 * e.orden) * eL * (0.5 + 0.5 * sale3(entra));
      let cx = Math.cos(e.ang);
      const cy = Math.sin(e.ang);
      let x = n._sx + cx * d;
      const y = n._sy + cy * d;
      const w = anchoEtiqueta(e.texto);
      const estorba = lado => {
        const px = n._sx + lado * d;
        const x0 = lado < 0 ? px - 10 - w : px - 6;
        const x1 = lado < 0 ? px + 6 : px + 10 + w;
        return bajoPanel(x0, y - 11, x1, y + 11) || x0 < 4 || x1 > ancho - 4 || choca([x0, y - 11, x1, y + 11], vivo.tapas);
      };
      if (estorba(cx) && !estorba(-cx)) {
        cx = -cx;
        x = n._sx + cx * d;
      }
      pctx.globalAlpha = 0.85 * al;
      pctx.strokeStyle = e.color;
      pctx.lineWidth = 1.6;
      pctx.setLineDash([3, 3]);
      pctx.beginPath();
      pctx.moveTo(n._sx + cx * n._sr, n._sy + cy * n._sr);
      pctx.lineTo(x, y);
      pctx.stroke();
      pctx.setLineDash([]);
      brillo(x, y, 16, e.color, al);
      pctx.globalAlpha = al;
      pctx.fillStyle = e.color;
      pctx.beginPath();
      pctx.arc(x, y, 5, 0, TAU);
      pctx.fill();
      etiqueta(cx < 0 ? x - 10 : x + 10, y, e.texto, e.color, al, cx < 0);
    };
    DIBUJO_EFECTO.cartelSueno = (e, p) => {
      const n = e.n;
      if (!n._en) return;
      const al = 0.8 * Math.min(1, p / 0.08, (1 - p) / 0.2);
      if (al <= 0.01) return;
      const izquierda = n._sx > ancho * 0.62;
      etiqueta(izquierda ? n._sx - n._sr - 14 : n._sx + n._sr + 14, n._sy - n._sr - 18, e.texto, e.color, al, izquierda);
    };

    const RAYO = { dur: 950, pega: 0.36, cola: 0.55, tramos: 12 };
    const trazoRayo = new Float32Array((RAYO.tramos + 1) * 2);
    function blancoRayo(e) {
      if (e.n && e.n._en) return [e.n._sx, e.n._sy];
      if (!e.lob) return null;
      const q = proyectar(e.lob.wx, e.lob.wy, 0);
      const t = transformacion;
      return [q.x * t.k + t.x, q.y * t.k + t.y];
    }
    DIBUJO_EFECTO.rayo = (e, p, eL) => {
      const b = blancoRayo(e);
      if (!b) return;
      const bx = b[0];
      const by = b[1];
      if (e.x0 === undefined) {
        const lado = [[bx, 0], [ancho - bx, 1], [by, 2], [alto - by, 3]].sort((u, v) => u[0] - v[0])[0][1];
        const corre = (0.22 + 0.2 * Math.random()) * Math.min(ancho, alto) * e.giro;
        e.x0 = lado === 0 ? -60 : lado === 1 ? ancho + 60 : bx + corre;
        e.y0 = lado === 2 ? -60 : lado === 3 ? alto + 60 : by + corre;
        e.luz = anim.oscuro ? aclarar(e.color, 0.35) : e.color;
        e.c0 = aRgba(e.color, 0);
        e.c1 = aRgba(e.luz, 1);
      }
      const dx = bx - e.x0;
      const dy = by - e.y0;
      const largo = Math.hypot(dx, dy) || 1;
      const qx = (e.x0 + bx) / 2 - dy * 0.14 * e.giro;
      const qy = (e.y0 + by) / 2 + dx * 0.14 * e.giro;
      const u = Math.min(1, p / e.pega);
      const cabezaEn = u * u;
      const colaEn = p < e.pega ? Math.max(0, cabezaEn - RAYO.cola) : Math.min(1, 1 - RAYO.cola + RAYO.cola * sale3(Math.min(1, (p - e.pega) / 0.22)));
      const hx = puntoCurva(e.x0, qx, bx, cabezaEn);
      const hy = puntoCurva(e.y0, qy, by, cabezaEn);
      if (cabezaEn - colaEn > 0.004) {
        const N = RAYO.tramos;
        for (let i = 0; i <= N; i++) {
          const s = colaEn + (cabezaEn - colaEn) * i / N;
          trazoRayo[i * 2] = puntoCurva(e.x0, qx, bx, s);
          trazoRayo[i * 2 + 1] = puntoCurva(e.y0, qy, by, s);
        }
        const g = pctx.createLinearGradient(trazoRayo[0], trazoRayo[1], hx, hy);
        g.addColorStop(0, e.c0);
        g.addColorStop(1, e.c1);
        const linea = temblor => {
          pctx.beginPath();
          pctx.moveTo(trazoRayo[0], trazoRayo[1]);
          for (let i = 1; i <= N; i++) {
            let x = trazoRayo[i * 2];
            let y = trazoRayo[i * 2 + 1];
            if (temblor && i < N) {
              const k = (Math.random() * 2 - 1) * temblor * Math.sin(Math.PI * i / N);
              x -= dy / largo * k;
              y += dx / largo * k;
            }
            pctx.lineTo(x, y);
          }
        };
        pctx.lineCap = 'round';
        pctx.lineJoin = 'round';
        pctx.strokeStyle = g;
        linea(0);
        pctx.globalAlpha = anim.oscuro ? 0.22 : 0.14;
        pctx.lineWidth = 22 * eL;
        pctx.stroke();
        pctx.globalAlpha = anim.oscuro ? 0.45 : 0.3;
        pctx.lineWidth = 8 * eL;
        pctx.stroke();
        pctx.globalAlpha = 1;
        pctx.lineWidth = 3.2 * eL;
        pctx.stroke();
        linea(3.2 * eL);
        pctx.strokeStyle = '#ffffff';
        pctx.globalAlpha = anim.oscuro ? 0.85 : 0.95;
        pctx.lineWidth = 1.1 * eL;
        pctx.stroke();
        pctx.lineCap = 'butt';
        pctx.lineJoin = 'miter';
      }
      if (p < e.pega) {
        brillo(hx, hy, 26 * eL, e.color, 0.9);
        cabeza(hx, hy, e.color, 1, 0.95, 34 * eL, 4 * eL, colores.texto);
        return;
      }
      if (!e.pego) {
        e.pego = true;
        if (e.alPegar) e.alPegar();
      }
      const q = (p - e.pega) / (1 - e.pega);
      const sq = sale3(q);
      brillo(bx, by, (22 + 70 * sq) * eL, e.color, Math.pow(1 - q, 1.5));
      pctx.globalAlpha = 1 - q;
      pctx.strokeStyle = e.luz;
      pctx.lineWidth = 2.6 * (1 - q) + 0.4;
      pctx.beginPath();
      pctx.arc(bx, by, (8 + 50 * sq) * eL, 0, TAU);
      pctx.stroke();
    };

    function rayo(n, lob, color, alPegar) {
      const l = cerebro ? cerebro.lobulos.find(x => x.id === lob) : null;
      const blanco = n && n._visible ? n : null;
      if (!gestoPosible() || (!blanco && !l)) {
        alPegar();
        return;
      }
      anim.efectos.push({ tipo: 'rayo', n: blanco, lob: l, t0: performance.now(), dur: RAYO.dur, pega: RAYO.pega, color, giro: Math.random() < 0.5 ? -1 : 1, alPegar });
      programarCuadro();
    }

    function hora(t) {
      return new Date(t * 1000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function hace(t) {
      const s = Math.max(0, Date.now() / 1000 - t);
      if (s < 5) return 'ahora';
      if (s < 60) return 'hace ' + Math.floor(s / 5) * 5 + ' s';
      if (s < 3600) return 'hace ' + Math.floor(s / 60) + ' min';
      if (s < 86400) return 'hace ' + Math.floor(s / 3600) + ' h';
      return 'hace ' + Math.floor(s / 86400) + ' d';
    }
    setInterval(() => {
      if (document.hidden) return;
      filas.querySelectorAll('time[data-t]').forEach(el => {
        const v = hace(Number(el.dataset.t));
        if (el.textContent !== v) el.textContent = v;
      });
    }, 1000);

    function resumenFamilias(lista) {
      const cuentas = new Map();
      (lista || []).forEach(b => cuentas.set(COMANDO[b] || COMANDO.otro, (cuentas.get(COMANDO[b] || COMANDO.otro) || 0) + 1));
      const partes = [...cuentas].map(([nombre, n]) => n > 1 ? nombre + ' ×' + n : nombre);
      return partes.slice(0, 3).join(', ') + (partes.length > 3 ? '…' : '');
    }

    function deRafaga(a, b) {
      return !!(a && b && a.e === 'post' && b.e === 'post' && a.k === 'ejecutar' && b.k === 'ejecutar' && !a.repite && !b.repite
        && a.s === b.s && (a.a || '') === (b.a || '') && !SIN_RAFAGA.has(a.b) && !SIN_RAFAGA.has(b.b)
        && b.t - a.t >= 0 && b.t - a.t <= RAFAGA_COMANDOS);
    }

    function fila(ev, viejo) {
      if (!viejo && !repintando) {
        const ult = hechas[hechas.length - 1];
        if (ult && !ult[1] && deRafaga(ult[0], ev) && filas.firstElementChild) {
          ev._veces = (ult[0]._veces || 1) + 1;
          ev._familias = (ult[0]._familias || [ult[0].b]).concat([ev.b]);
          hechas.pop();
          filas.firstElementChild.remove();
        }
      }
      const li = document.createElement('li');
      if (viejo) li.className = 'viejo';
      const k = ev.k || 'otro';
      const t = document.createElement('time');
      const cuando = ev.repite && ev.to ? ev.to : ev.t || Date.now() / 1000;
      if (!ev.repite) t.dataset.t = String(cuando);
      t.dateTime = new Date(cuando * 1000).toISOString();
      t.title = hora(cuando);
      t.textContent = ev.repite ? horaCorta(cuando) : hace(cuando);
      const tipo = document.createElement('span');
      tipo.className = 'tipo';
      tipo.style.setProperty('--c', colorEvento(ev));
      tipo.textContent = nombreEvento(ev);
      const n = notaDe(ev) || notasRecomendadas(ev)[0] || null;
      const que = document.createElement(n ? 'button' : 'span');
      que.className = 'que';
      const leidas = rutasLeidas(ev).concat(recomendadas(ev));
      const tramo = tramoLeido(ev);
      const consola = porConsola(ev);
      const falla = ev.e === 'falla';
      const motivo = falla && Array.isArray(ev.x) && (ev.x[0] === 1 || ev.x[1] === 1) ? (ev.x[0] === 1 ? 'interrumpida' : 'se pasó de tiempo')
        : falla && Number.isFinite(ev.xc) ? 'salió con ' + ev.xc : '';
      const porQue = ev.e === 'aviso' ? pistaDe(ev).filter(x => x.motivo).map(x => tituloVisto(x.n) + ' — ' + razonPista(x, true)) : [];
      que.title = porQue.length ? publico('texto', ev, 'Eligió:\n' + porQue.join('\n'))
        : publico('texto', ev, [falla ? ev.h : '', ev.f].concat(leidas, [ev.p, tramo, consola ? (ev.k === 'buscar' ? 'buscada' : 'leída') + ' por consola (' + ev.h + ')' : '', motivo]).filter(Boolean).join('  ·  ') || ev.h || '');
      if (n) {
        que.type = 'button';
        que.addEventListener('click', () => irA(n.id, true));
      }
      if (ev.s) {
        const s = document.createElement('i');
        s.className = 'agente';
        s.style.setProperty('--c', colorChat(ev.s));
        s.title = publico('chat', ev.s, 'Chat ' + ev.s + (ev.c ? ' · ' + ev.c : ''));
        que.appendChild(s);
      }
      if (ev.a) {
        const a = document.createElement('i');
        a.className = 'agente';
        a.style.setProperty('--c', colorAgente(ev.a));
        a.title = publico('texto', ev, 'Agente: ' + ev.a);
        que.appendChild(a);
        const an = document.createElement('span');
        an.className = 'nombre-agente';
        const suChat = chats.get(ev.s);
        const sub = suChat && suChat.subs.get(ev.a);
        an.textContent = (sub ? nombreSub(suChat, sub) : formasTipo(ev.at || 'agente')[0]) + ': ';
        que.appendChild(an);
      }
      que.appendChild(document.createTextNode(textoFila(ev)));
      if (ev.m) que.appendChild(cambio(ev.m));
      const caja = document.createElement('span');
      caja.className = 'que-caja';
      caja.title = que.title;
      caja.appendChild(que);
      const segundos = segundosDe(ev);
      const detalles = [ev._veces > 1 ? ev._veces + ' comandos: ' + resumenFamilias(ev._familias) : '', motivo, consola ? 'por consola' : '', tramo,
        ev.e === 'aviso' ? resumenPista(ev) : '',
        ev.nr ? 'sin resultados' : '', ev.bg ? 'en segundo plano' : '', segundos > 1.5 ? duracionTexto(segundos) : ''].filter(Boolean);
      if (detalles.length) {
        const d = document.createElement('span');
        d.className = 'dur';
        d.textContent = detalles.join(' · ');
        caja.appendChild(d);
      }
      li.append(t, tipo, caja);
      filas.prepend(li);
      while (filas.children.length > 6) filas.lastElementChild.remove();
      hechas.push([ev, viejo]);
      if (hechas.length > 6) hechas.shift();
      if (!viejo && !repintando) ponerZocalo(ev);
      if (!viejo && !repintando && !ev.repite && ANUNCIADOS.has(ev.e)) anuncio.textContent = nombreEvento(ev) + ': ' + textoFila(ev);
    }

    function textoFila(ev) {
      if (ev.e === 'choque') {
        const o = ev.otro || {};
        const antes = Math.max(0, Math.round((Number(ev.t) - Number(o.t)) / 60));
        return textoFila(Object.assign({}, ev, { e: 'post', k: 'editar' })) + ' · también lo editó ' + quienEdito(o)
          + (antes ? ' ' + antes + ' min antes' : ' recién');
      }
      if (ev.e === 'falla') return nombreFalla(ev);
      if (ev.e === 'recuerda') {
        const r = notasRecomendadas(ev)[0];
        return (ev.f ? 'al editar ' + archivoCorto(ev.f) + ', ' : '') + 'le recordó ' + (r ? tituloVisto(r) : 'una nota');
      }
      if (ev.e === 'guarda') {
        if (ev.p === 'compact') return 'al compactar, le recordó guardar lo decidido';
        return 'le recordó guardar' + (ev.n ? ' (' + ev.n + (ev.n === 1 ? ' archivo' : ' archivos') + ' sin anotar)' : '');
      }
      if (EVENTO[ev.e]) return EVENTO[ev.e][2];
      const n = notaDe(ev);
      if (n) return tituloVisto(n) + yMas(ev.f ? 0 : notasDe(ev).length - 1);
      const carpeta = ev.c ? String(ev.c).replace(/\\/g, '/').split('/').filter(Boolean).pop() : '';
      if (ev.k === 'ejecutar' && carpeta) return 'en ' + publico('carpeta', ev.c, carpeta);
      const p = ev.f ? publico('texto', ev, ev.p) : '';
      return nombreCorto(ev) + (p ? ' · ' + p : '') || ev.h || '';
    }

    const hechas = [];
    let repintando = false;
    const ZOCALO_MIN = 1800;
    const ZOCALO_VIDA = 9000;
    const QUE_EVENTO = { usuario: 'le llega un mensaje', aviso: 'recibe la pista de Neuromapa', recuerda: 'Neuromapa le recuerda una nota al editar', guarda: 'Neuromapa le recuerda guardar lo decidido', fin: 'terminó de responder', espera: 'espera tu OK', compacta: 'comprime su memoria', inicio: 'abre el chat', cierre: 'cierra el chat', 'sub-fin': 'un agente terminó' };
    const zocalo = { el: $('#zocalo'), quien: $('#zocalo-quien'), texto: $('#zocalo-texto'), ev: null, t: -Infinity, pendiente: null, espera: 0, apagar: 0 };
    const mayuscula = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

    function fraseZocalo(ev) {
      if (ev.e === 'falla') return 'falló ' + nombreFalla(ev);
      if (ev.e === 'usuario') {
        const quien = publico('persona', null, EVENTO.usuario[0]);
        return quien ? quien + ' le escribe' : QUE_EVENTO.usuario;
      }
      if (QUE_EVENTO[ev.e]) return QUE_EVENTO[ev.e];
      if (EVENTO[ev.e]) return EVENTO[ev.e][2];
      if (ev.k === 'consulta') {
        const cuantas = recomendadas(ev).length;
        const op = opcionConsulta(ev);
        return 'le pregunta a Neuromapa' + (op ? ' (' + op + ')' : '') + (cuantas ? ' y le recomienda ' + cuantas + (cuantas === 1 ? ' nota' : ' notas') : '');
      }
      if (ev.k === 'ejecutar') {
        const s = segundosDe(ev);
        return (QUE_COMANDO[ev.b] || 'corre un comando') + (ev.nr ? ' (sin resultados)' : '') + (s > 1.5 ? ' · ' + duracionTexto(s) : '');
      }
      const v = verboDe(ev);
      const sinArchivo = !notaDe(ev) && !ev.f && !rutasLeidas(ev).length;
      if (v && sinArchivo) return (v[0] + ' ' + v[1]).trim();
      if (ev.k === 'buscar' && sinArchivo) {
        const p = publico('texto', ev, ev.p);
        return p ? 'busca «' + p + '»' : 'busca en los archivos';
      }
      return nombreEvento(ev) + ' ' + textoFila(ev);
    }

    function quienZocalo(ev) {
      const c = ev.s ? chats.get(ev.s) : null;
      const varios = [...chats.values()].filter(o => o.estado !== 'cerrado').length > 1;
      const partes = ['Claude'];
      if (c && varios) partes.push(nombreVisible(c));
      if (ev.a) {
        const sub = c && c.subs.get(ev.a);
        partes.push(sub ? nombreSub(c, sub) : formasTipo(ev.at || 'agente')[0]);
      }
      return [partes.join(' · '), ev.a ? colorAgente(ev.a) : ev.s ? colorChat(ev.s) : 'var(--acento)'];
    }

    function pintarZocalo() {
      const ev = zocalo.ev;
      if (!ev) return;
      const [quien, color] = quienZocalo(ev);
      zocalo.quien.textContent = quien;
      zocalo.quien.style.setProperty('--c', color);
      zocalo.texto.textContent = recortar(mayuscula(fraseZocalo(ev)), 64);
    }

    function ponerZocalo(ev) {
      if (!presenta.cine) return;
      const falta = zocalo.t + ZOCALO_MIN - performance.now();
      if (falta > 0) {
        zocalo.pendiente = ev;
        if (!zocalo.espera) zocalo.espera = setTimeout(() => {
          zocalo.espera = 0;
          const p = zocalo.pendiente;
          zocalo.pendiente = null;
          if (p) ponerZocalo(p);
        }, falta);
        return;
      }
      zocalo.t = performance.now();
      zocalo.ev = ev;
      pintarZocalo();
      zocalo.el.classList.remove('entra');
      void zocalo.el.offsetWidth;
      zocalo.el.classList.add('entra', 'visible');
      clearTimeout(zocalo.apagar);
      zocalo.apagar = setTimeout(() => zocalo.el.classList.remove('visible'), ZOCALO_VIDA);
    }

    vivo.apagarZocalo = () => {
      clearTimeout(zocalo.espera);
      clearTimeout(zocalo.apagar);
      zocalo.espera = 0;
      zocalo.pendiente = null;
      zocalo.ev = null;
      zocalo.t = -Infinity;
      zocalo.el.classList.remove('visible', 'entra');
    };

    vivo.refrescarNombres = () => {
      chats.forEach(c => {
        if (c.actual && c.evActual) c.actual = frase(c.evActual);
        c.subs.forEach(s => { if (s.actual && s.evActual) s.actual = frase(s.evActual); });
      });
      repintando = true;
      const copia = hechas.splice(0);
      filas.textContent = '';
      copia.forEach(([ev, viejo]) => fila(ev, viejo));
      repintando = false;
      pintarZocalo();
      pintarProgramando();
      pintarUso();
      pintarChats();
    };

    function cambio(m) {
      const s = document.createElement('span');
      s.className = 'cambio';
      const mas = document.createElement('span');
      mas.className = 'mas';
      mas.textContent = '+' + (m[0] || 0);
      const menos = document.createElement('span');
      menos.className = 'menos';
      menos.textContent = '−' + (m[1] || 0);
      s.append(mas, menos);
      return s;
    }

    function anotarArchivo(ev) {
      if (ev.demo || !ev.f || !ev.m || (ev.k !== 'editar' && ev.k !== 'crear')) return;
      const k = clave(ev.f);
      const a = archivos.get(k) || { ev, ruta: ev.f, mas: 0, menos: 0, veces: 0 };
      a.mas += ev.m[0] || 0;
      a.menos += ev.m[1] || 0;
      a.veces++;
      a.t = ev.t;
      a.s = ev.s;
      archivos.set(k, a);
      if (ev.t) archivosT = Math.max(archivosT, ev.t);
    }

    function pintarProgramando() {
      const limite = Date.now() / 1000 - 1800;
      const lista = [...archivos.values()].filter(a => a.t >= limite).sort((a, b) => b.t - a.t).slice(0, 5);
      cajaProg.hidden = !lista.length;
      if (!lista.length) return;
      cajaProg.textContent = '';
      const titulo = document.createElement('b');
      titulo.textContent = 'Programando (última media hora)';
      const ul = document.createElement('ul');
      lista.forEach(a => {
        const li = document.createElement('li');
        const nombre = document.createElement('span');
        nombre.className = 'nombre';
        nombre.title = publico('texto', a, a.ruta + ' · ') + a.veces + (a.veces === 1 ? ' cambio' : ' cambios');
        if (a.s) {
          const s = document.createElement('i');
          s.className = 'agente';
          s.style.cssText = 'display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:4px;background:' + colorChat(a.s);
          nombre.appendChild(s);
        }
        nombre.appendChild(document.createTextNode(nombreCorto(a.ev)));
        const hace = document.createElement('time');
        const min = Math.round((Date.now() / 1000 - a.t) / 60);
        hace.textContent = min < 1 ? 'ahora' : 'hace ' + min + ' min';
        li.append(nombre, cambio([a.mas, a.menos]), hace);
        ul.appendChild(li);
      });
      cajaProg.append(titulo, ul);
    }
    setInterval(pintarProgramando, 30000);

    const UNIR = String.fromCharCode(0x2060);
    const ESPACIO_FIJO = String.fromCharCode(0xa0);
    function textoConsultas(cq) {
      const n = v => Number.isFinite(v) && v > 0 ? v : 0;
      const total = n(cq.total);
      if (!total) return 'Consultas a Neuromapa: ninguna todavía.';
      const opciones = Object.entries(cq.porOpcion || {}).filter(([o, v]) => OPCIONES_CEREBRO.has(o) && n(v))
        .sort((a, b) => b[1] - a[1]).map(([o, v]) => '-' + UNIR + '-' + UNIR + o + ESPACIO_FIJO + v).join(', ');
      const partes = ['Consultas a Neuromapa: ' + total + (opciones ? ' (' + opciones + ')' : '')];
      if (n(cq.pedidos)) partes.push('el chat consultó en ' + n(cq.conConsulta) + ' de ' + n(cq.pedidos) + ' pedidos');
      if (n(cq.recomendadas)) partes.push('de ' + n(cq.recomendadas) + ' notas recomendadas leyó después ' + n(cq.leidas) + ' (' + Math.round(100 * n(cq.leidas) / n(cq.recomendadas)) + ' %)');
      return partes.join(' · ') + '.';
    }

    let usoPendiente = 0;
    function refrescarUso() {
      if (!vivo.calor) return;
      clearTimeout(usoPendiente);
      usoPendiente = setTimeout(cargarUso, 2500);
    }

    function pintarUso() {
      if (!vivo.calor) { cajaUso.hidden = true; return; }
      cajaUso.hidden = false;
      cajaUso.textContent = '';
      if (!vivo.uso) { cajaUso.textContent = 'Cargando el uso…'; return; }
      const usadas = nodos.filter(n => n._usos > 0).length;
      const sinUso = nodos.filter(n => !n._usos).sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
      const fijas = sinUso.filter(n => TIPOS_FIJOS.has(n.tipo));
      const nunca = sinUso.filter(n => !TIPOS_FIJOS.has(n.tipo));
      const desde = vivo.uso.desde ? new Date(vivo.uso.desde * 1000).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
      const horas = vivo.uso.desde ? Math.max(0, Date.now() / 1000 - vivo.uso.desde) / 3600 : 0;
      const datos = horas < 48 ? Math.round(horas) + ' h de datos' : Math.round(horas / 24) + ' días de datos';
      const rot = vivo.uso.rotados || {};
      const p = document.createElement('div');
      p.textContent = desde
        ? 'Uso real desde el ' + desde + ' (' + datos + '): ' + usadas + ' notas usadas y ' + sinUso.length + ' sin uso registrado.'
          + (rot.sinLeer > 0 ? ' Hay ' + rot.sinLeer + (rot.sinLeer === 1 ? ' registro viejo que no leí.' : ' registros viejos que no leí.') : '')
        : 'Todavía no hay registro de uso: se llena solo mientras Claude trabaja.';
      const esc = document.createElement('div');
      esc.className = 'escala';
      const menos = document.createElement('span');
      menos.textContent = 'nunca';
      esc.appendChild(menos);
      ESCALA.forEach((c, i) => {
        const b = document.createElement('i');
        b.style.setProperty('--c', c);
        b.title = RANGOS[i] + (i ? ' usos' : '');
        esc.appendChild(b);
      });
      const mas = document.createElement('span');
      mas.textContent = 'mucho';
      esc.appendChild(mas);
      cajaUso.append(p, esc);
      const cq = vivo.uso.consultas;
      if (cq && cq.visto) {
        const d = document.createElement('div');
        d.textContent = textoConsultas(cq);
        cajaUso.appendChild(d);
      }
      if (!desde || !sinUso.length) return;
      if (fijas.length) {
        const f = document.createElement('div');
        f.textContent = 'Además, ' + fijas.length + ' handoffs, índices y reglas fijas sin uso registrado: es normal, se leen cuando hacen falta.';
        cajaUso.appendChild(f);
      }
      if (!nunca.length) return;
      const det = document.createElement('details');
      det.open = detallesAbiertos;
      det.addEventListener('toggle', () => { detallesAbiertos = det.open; });
      const sum = document.createElement('summary');
      sum.textContent = 'Sin uso registrado desde el ' + desde + ' (' + nunca.length + ')' + (horas >= 24 * 14 ? ': candidatas a fusionar' : '');
      const ul = document.createElement('ul');
      nunca.forEach(n => {
        const li = document.createElement('li');
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = tituloVisto(n);
        b.title = publico('texto', n, n.ruta);
        b.addEventListener('click', () => irA(n.id, true));
        li.appendChild(b);
        ul.appendChild(li);
      });
      det.append(sum, ul);
      cajaUso.appendChild(det);
    }

    function aplicarUso() {
      const cuentas = new Map();
      const detalles = new Map();
      const num = v => Number.isFinite(v) && v > 0 ? v : 0;
      Object.entries((vivo.uso && vivo.uso.rutas) || {}).forEach(([ruta, u]) => {
        if (!u || typeof u !== 'object') return;
        const k = clave(ruta);
        cuentas.set(k, (cuentas.get(k) || 0) + num(u.leer) + num(u.editar) + num(u.crear) + PESO_BUSCAR * num(u.buscar));
        const d = detalles.get(k) || { leer: 0, editar: 0, shell: 0, parcial: 0, falla: 0 };
        d.leer += num(u.leer);
        d.editar += num(u.editar) + num(u.crear);
        d.shell += num(u.shell);
        d.parcial += num(u.parcial);
        d.falla += num(u.falla);
        detalles.set(k, d);
      });
      nodos.forEach(n => {
        n._usos = cuentas.get(clave(n.ruta)) || 0;
        n._calor = ESCALA[nivel(n._usos)];
        n._uso = detalles.get(clave(n.ruta)) || null;
      });
      pintarUso();
      pedirDibujo();
    }

    async function cargarUso() {
      try {
        const r = await fetch('/uso.json', { cache: 'no-store' });
        if (!r.ok) return;
        vivo.uso = await r.json();
        aplicarUso();
      } catch (e) {}
    }

    function ponerColor(uso) {
      vivo.calor = uso;
      marcarColor();
      try { localStorage.setItem('cerebro-color', uso ? 'uso' : estado.porProyecto ? 'proyectos' : 'grupos'); } catch (e) {}
      if (uso) cargarUso();
      pintarUso();
      pedirDibujo();
    }

    const PALETA = ['#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#fb923c'];
    const colorChat = s => PALETA[hashTexto('chat' + s) % PALETA.length];
    const chats = new Map();
    vivo.chats = chats;
    const vividos = [];
    const RAICES_CHAT = PROYECTOS.map(p => [normRuta(p.raiz).replace(/\/+$/, ''), p.alias])
      .concat(CARPETA_CEREBRO ? [[normRuta(CARPETA_CEREBRO).replace(/\/+$/, ''), nombreArchivo(CARPETA_CEREBRO)]] : []);
    let recorridos = [];
    let tRecorridos = -Infinity;

    const horaCorta = t => new Date(t * 1000).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    function textoSueno(r, nombre) {
      const visto = publico('chat', r.s, nombre);
      const chat = visto && visto !== 'chat' ? 'el ' + (visto.startsWith('chat ') ? '' : 'chat ') + visto : 'un chat';
      const tipo = r.at ? publico('agente', r.at, recortar(r.at, 24)) : '';
      const quien = !r.a ? chat : tipo && tipo !== 'agente' ? 'el agente ' + tipo : 'un agente de ' + chat;
      const h0 = r.t0 ? horaCorta(r.t0) : '';
      const h1 = horaCorta(r.t);
      return 'soñando con ' + quien + (h0 && h0 !== h1 ? ', de las ' + h0 + ' a las ' + h1 : ' de las ' + h1);
    }

    function guardarVivido(c) {
      const m = memorias.get(c.id);
      if (!m) return;
      const desde = m.tVivido || 0;
      const notas = [...m.episodio.values()].filter(x => x.t > desde).map(x => x.n);
      m.tVivido = Date.now();
      if (notas.length < 3 || c.id === 'prueba' || c.repite) return;
      vividos.push({ s: c.id, nombre: c.nombre, t: Date.now() / 1000, notas });
      if (vividos.length > 20) vividos.shift();
    }

    const memorias = new Map();
    let memoriaT = 0;
    let marcadasCabeza = new Map();
    const CABEZA_REPASO = 30;
    const CABEZA_LISTA = 40;
    const QUIETO_CHAT = 7200000;
    const QUIETO_AGENTE = 1200000;
    const TOPE_CABEZA = 300;
    const PESO_AGENTE = 0.6;
    const PESO_PARTE = 0.55;
    const CARGAN = new Set(['leer', 'editar', 'crear', 'buscar']);
    const VACIAN_TODO = new Set(['clear', 'startup']);

    function memoriaDe(s) {
      let m = memorias.get(s);
      if (!m) {
        m = { color: colorChat(s), episodio: new Map(), agentes: new Map(), olvidando: null, tUlt: 0, tVivido: 0, ver: false };
        memorias.set(s, m);
      }
      return m;
    }

    function cargarEnCabeza(ep, ev, t) {
      const r = ev.r;
      const parcial = ev.k === 'buscar' || (Array.isArray(r) && r.length === 3 && r[1] > 0 && r[1] < r[2]);
      notasDe(ev).forEach(n => {
        const antes = ep.get(n);
        ep.delete(n);
        ep.set(n, { n, t, k: ev.k, parcial: antes ? antes.parcial && parcial : parcial });
      });
    }

    function fundirCabeza(ep, color, peso) {
      if (!ep || !ep.size || anim.modo === 'nada' || !graficoListo || estado.vista !== 'grafo') return;
      const t0 = performance.now();
      ep.forEach(x => {
        if (x.n._visible) anim.efectos.push({ tipo: 'olvido', n: x.n, t0, dur: 2000, color, alfa: peso * (x.parcial ? PESO_PARTE : 1) });
      });
      programarCuadro();
    }

    function terminarOlvido(m, enVivo) {
      const ep = m.olvidando;
      if (!ep) return;
      m.olvidando = null;
      if (enVivo) fundirCabeza(ep, m.color, 1);
    }

    function olvidarCompactando(s, m, enVivo) {
      terminarOlvido(m, enVivo);
      const ep = m.episodio;
      m.episodio = new Map();
      if (!enVivo) return;
      const c = chats.get(s);
      if (ep.size) m.olvidando = ep;
      const fin = () => {
        if (m.olvidando !== ep) return;
        terminarOlvido(m, memorias.get(s) === m);
        recalcularCabeza();
        pintarChats();
      };
      const lista = c ? repasarCompactando(c, performance.now(), [...ep.keys()].slice(-CABEZA_REPASO), fin) : null;
      if (lista) setTimeout(fin, 45000);
      else fin();
    }

    function memoriaEvento(ev, enVivo) {
      if (!ev.s) return false;
      if (ev.t) memoriaT = Math.max(memoriaT, ev.t);
      const e = ev.e || 'post';
      const t = ev.t ? ev.t * 1000 : Date.now();
      if (e === 'post') {
        if (!CARGAN.has(ev.k) || !notasDe(ev).length) return false;
        const m = memoriaDe(ev.s);
        m.tUlt = Math.max(m.tUlt, t);
        if (!ev.a) {
          cargarEnCabeza(m.episodio, ev, t);
          return true;
        }
        let ag = m.agentes.get(ev.a);
        if (!ag) {
          ag = { episodio: new Map(), tUlt: t, ver: false };
          m.agentes.set(ev.a, ag);
        }
        ag.tUlt = Math.max(ag.tUlt, t);
        cargarEnCabeza(ag.episodio, ev, t);
        return true;
      }
      if (e === 'compacta' && !ev.a) {
        const m = memoriaDe(ev.s);
        m.tUlt = Math.max(m.tUlt, t);
        olvidarCompactando(ev.s, m, enVivo);
        return true;
      }
      const m = memorias.get(ev.s);
      if (!m) return false;
      m.tUlt = Math.max(m.tUlt, t);
      if (e === 'sub-fin') {
        const ag = ev.a && m.agentes.get(ev.a);
        if (!ag) return false;
        m.agentes.delete(ev.a);
        if (enVivo) fundirCabeza(ag.episodio, m.color, PESO_AGENTE);
        return true;
      }
      const p = String(ev.p || '');
      const todo = e === 'cierre' || (e === 'fin' && ev.demo && !ev.repite) ||(e === 'inicio' && VACIAN_TODO.has(p));
      if (!todo && !(e === 'inicio' && p === 'compact')) return false;
      terminarOlvido(m, enVivo);
      if (enVivo) fundirCabeza(m.episodio, m.color, 1);
      m.episodio = new Map();
      if (todo) {
        if (enVivo) m.agentes.forEach(ag => fundirCabeza(ag.episodio, m.color, PESO_AGENTE));
        m.agentes.clear();
      }
      return true;
    }

    function recalcularCabeza() {
      const ahora = Date.now();
      const nuevas = new Map();
      const poner = (ep, color, peso) => ep.forEach(x => {
        const a = peso * (x.parcial ? PESO_PARTE : 1);
        const o = nuevas.get(x.n);
        if (!o || o.alfa < a) nuevas.set(x.n, { color, alfa: a });
      });
      memorias.forEach(m => {
        if (m.olvidando) poner(m.olvidando, m.color, 1);
        if (ahora - m.tUlt < QUIETO_CHAT) poner(m.episodio, m.color, 1);
        m.agentes.forEach(ag => { if (ahora - ag.tUlt < QUIETO_AGENTE) poner(ag.episodio, m.color, PESO_AGENTE); });
      });
      let cambio = nuevas.size !== marcadasCabeza.size;
      marcadasCabeza.forEach((v, n) => {
        const w = nuevas.get(n);
        if (!w || w.color !== v.color || w.alfa !== v.alfa) cambio = true;
        if (!w) n._cabeza = null;
      });
      nuevas.forEach((v, n) => { n._cabeza = v; });
      marcadasCabeza = nuevas;
      if (cambio) pedirDibujo();
    }

    function botonCabeza(duenio, texto, clase, foco) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.foco = foco;
      b.className = clase;
      b.textContent = texto;
      b.setAttribute('aria-expanded', String(!!duenio.ver));
      b.title = duenio.ver ? 'Ocultar las notas' : 'Ver qué notas tiene cargadas';
      b.addEventListener('click', () => { duenio.ver = !duenio.ver; pintarChats(); });
      return b;
    }

    function listaCabeza(ep, sangria, color, foco) {
      const d = document.createElement('div');
      d.className = 'cabeza-lista' + (sangria ? ' de-agente' : '');
      d.style.setProperty('--c', color);
      const todas = [...ep.values()].reverse();
      todas.slice(0, CABEZA_LISTA).forEach(x => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.foco = foco + ':' + x.n.id;
        b.title = tituloVisto(x.n) + (x.parcial ? ' (leyó una parte)' : '');
        const i = document.createElement('i');
        const t = document.createElement('span');
        t.textContent = tituloVisto(x.n, 40);
        b.append(i, t);
        if (x.parcial) {
          const p = document.createElement('small');
          p.textContent = 'una parte';
          b.appendChild(p);
        }
        b.addEventListener('click', () => irA(x.n.id, true));
        d.appendChild(b);
      });
      if (todas.length > CABEZA_LISTA) {
        const mas = document.createElement('span');
        mas.className = 'mas';
        mas.textContent = 'y ' + (todas.length - CABEZA_LISTA) + ' más';
        d.appendChild(mas);
      }
      return d;
    }

    async function cargarRecorridos() {
      try {
        const r = await fetch('/uso.json', { cache: 'no-store' });
        if (!r.ok) return;
        const datos = await r.json();
        if (!Array.isArray(datos.recorridos)) return;
        recorridos = datos.recorridos.map(x => {
          const notas = [];
          (Array.isArray(x.rutas) ? x.rutas : []).forEach(ruta => {
            const n = porRuta.get(clave(String(ruta)));
            if (n && n !== notas[notas.length - 1]) notas.push(n);
          });
          return { s: String(x.s || ''), nombre: nombreChat(x.c), t: Number(x.t) || Date.now() / 1000, t0: Number(x.t0) || 0,
                   a: String(x.a || ''), at: String(x.at || ''), notas };
        }).filter(x => new Set(x.notas).size >= 3);
      } catch (e) {}
    }

    vivo.prepararSuenos = () => {
      const ahora = performance.now();
      if (ahora - tRecorridos > 600000) { tRecorridos = ahora; cargarRecorridos(); }
    };
    vivo.elegirSueno = () => {
      vivo.prepararSuenos();
      const lista = recorridos.concat(vividos).filter(x => x.notas.filter(n => n._visible).length >= 3);
      if (!lista.length) return null;
      const r = lista[Math.floor(Math.random() * lista.length)];
      const otros = lista.some(o => o.s !== r.s && o.nombre === r.nombre) || [...chats.values()].some(o => o.id !== r.s && o.nombre === r.nombre);
      return { notas: r.notas, color: colorChat(r.s), texto: textoSueno(r, otros && r.s ? r.nombre + ' ' + r.s.slice(0, 4) : r.nombre) };
    };
    const cajaChats = $('#en-vivo-chats');
    const resumen = $('#en-vivo-resumen');
    let efectoChats = null;
    const destinoDe = ev => notaDe(ev) || anclaEvento(ev);
    const anclaDeChat = (ev, n) => (ev.c && anclaDe(ev.c)) || n;

    function nombreChat(c) {
      const r = String(c || '').replace(/\\/g, '/').replace(/\/\.claude\/worktrees\/[^/]+/i, '');
      const m = r.toLowerCase().replace(/\/+$/, '');
      const raiz = RAICES_CHAT.find(([base]) => m === base || m.startsWith(base + '/'));
      if (raiz) return raiz[1];
      return r.split('/').filter(Boolean).pop() || 'chat';
    }

    function chatDe(ev) {
      if (!ev.s) return null;
      const ahora = performance.now();
      let c = chats.get(ev.s);
      if (!c) {
        c = { id: ev.s, color: colorChat(ev.s), nombre: 'chat', desde: null, hacia: null, t0: ahora, ang: (hashTexto(ev.s) % 628) / 100, giro: 0,
              estado: 'trabajando', enCurso: new Map(), terminados: new Map(), subs: new Map(), salen: [], numeros: new Map(), actual: '', tUlt: ahora, tFin: 0, ultimaNota: null };
        chats.set(ev.s, c);
      }
      if (ev.repite) c.repite = true;
      if (ev.demo && !ev.repite) c.nombre = 'prueba';
      else if (ev.o === 'app') c.nombre = 'Chat de la app';
      else if (ev.o === 'codex') c.nombre = 'Chat de Codex';
      else if (ev.c) c.nombre = nombreChat(ev.c);
      c.tUlt = ahora;
      return c;
    }
    const nombreVisible = c => publico('chat', c.id, [...chats.values()].some(o => o !== c && o.nombre === c.nombre) ? c.nombre + ' ' + c.id.slice(0, 4) : c.nombre);

    function subDe(c, ev) {
      const ahora = performance.now();
      const aid = ev.a;
      let s = c.subs.get(aid);
      if (!s) {
        if (!c.subs.size) c.numeros.clear();
        s = { color: colorAgente(aid), desde: c.hacia, hacia: c.hacia, t0: ahora, ang: (hashTexto(aid) % 628) / 100, giro: 0, tUlt: ahora,
              nombre: 'agente', num: 0, actual: '', acciones: 0, chat: c, tAccion: ahora, v: null, aid };
        c.subs.set(aid, s);
        if (completo() && graficoListo && !introCorriendo() && c.hacia && c.hacia._visible) anim.efectos.push({ tipo: 'aro', n: c.hacia, t0: ahora, dur: 1500, color: s.color, guion: true });
      }
      if (ev.at && s.nombre !== String(ev.at)) { s.nombre = String(ev.at); s.num = 0; }
      if (!s.num) {
        s.num = (c.numeros.get(s.nombre) || 0) + 1;
        c.numeros.set(s.nombre, s.num);
      }
      s.tUlt = ahora;
      return s;
    }

    const TIPO_AGENTE = {
      Explore: ['explorador', 'explorador', 'exploradores'],
      'general-purpose': ['ayudante', 'ayudante', 'ayudantes'],
      'workflow-subagent': ['agente', 'agente de una tanda', 'agentes de una tanda'],
      agente: ['agente', 'agente', 'agentes']
    };
    const formasTipo = t => {
      const visto = TIPO_AGENTE[t] ? t : publico('agente', t, t);
      return TIPO_AGENTE[visto] || [visto, 'agente ' + visto, 'agentes ' + visto];
    };
    function tipoUnico(c) {
      let t = null;
      for (const o of c.subs.values()) {
        if (t === null) t = o.nombre;
        else if (o.nombre !== t) return null;
      }
      return t;
    }
    function cuentaAgentes(c) {
      const n = c.subs.size;
      const t = tipoUnico(c);
      if (t === null) return n + (n === 1 ? ' agente' : ' agentes');
      return n + ' ' + formasTipo(t)[n === 1 ? 1 : 2];
    }

    function nombreSub(c, s) {
      if (c.subs.size > 1 && tipoUnico(c) !== null) return '#' + s.num;
      let repetido = s.num > 1;
      if (!repetido) for (const o of c.subs.values()) if (o !== s && o.nombre === s.nombre) { repetido = true; break; }
      const corto = formasTipo(s.nombre)[0];
      return repetido ? corto + ' #' + s.num : corto;
    }

    function mover(o, n) {
      if (!n || n === o.hacia) return;
      const nuevo = !o.hacia;
      o.desde = o.hacia;
      o.hacia = n;
      o.t0 = performance.now();
      if (nuevo && completo() && graficoListo && !introCorriendo() && n._visible) anim.efectos.push({ tipo: 'aro', n, t0: o.t0, dur: 1600, color: o.color });
    }

    function asegurarChats() {
      if (!chats.size || !completo() || !graficoListo || estado.vista !== 'grafo') return;
      if (!efectoChats || !anim.efectos.includes(efectoChats)) {
        efectoChats = { tipo: 'chats', t0: performance.now(), dur: 1e12 };
        anim.efectos.push(efectoChats);
      }
      programarCuadro();
    }

    function envion(u) {
      if (u < 80) return -0.035 * sale3(Math.max(0, u) / 80);
      const v = Math.min(1, (u - 80) / 820);
      return -0.035 + 1.035 * (v < 0.5 ? 4 * v * v * v : 0.5 + 0.5 * atras(2 * v - 1));
    }

    function posicion(o, orbita, ahora) {
      const h = o.hacia;
      if (!h || !h._visible || h._sx === undefined) return null;
      const ang = o.ang + o.giro;
      const ox = Math.cos(ang);
      const oy = Math.sin(ang);
      const r = h._sr + orbita;
      const x = h._sx + ox * r;
      const y = h._sy + oy * r;
      const u = ahora - o.t0;
      const d = o.desde;
      if (u < 900 && d && d._visible && d._sx !== undefined) {
        const e = envion(u);
        const el = limitar(e);
        const r0 = d._sr + orbita;
        const x0 = d._sx + ox * r0;
        const y0 = d._sy + oy * r0;
        const [lqx, lqy] = controlCurva(d, h);
        const qx = lqx + ox * (r0 + r) / 2;
        const qy = lqy + oy * (r0 + r) / 2;
        return { x: puntoCurva(x0, qx, x, e), y: puntoCurva(y0, qy, y, e), x0, y0, x1: x, y1: y, qx, qy, e: el, q: u / 900, cx: h._sx, cy: h._sy, r, ang,
                 lx: puntoCurva(d._sx, lqx, h._sx, el), ly: puntoCurva(d._sy, lqy, h._sy, el), lr: d._sr + (h._sr - d._sr) * el };
      }
      return { x, y, q: 1, cx: h._sx, cy: h._sy, r, ang, lx: h._sx, ly: h._sy, lr: h._sr };
    }

    const ORDEN_TERRITORIOS = ['frontal', 'occipital', 'temporal', 'prefrontal', 'cerebelo', 'parietal', 'tronco'];
    const RADIO_TERRITORIO = [0.2, 0.62, 0.42, 0.78];
    const LADOS_CARTEL = [14, 0, 0, -14, 0, 1, 10, -24, 0, 10, 24, 0, -10, -24, 1, -10, 24, 1, 18, -48, 0, 18, 48, 0, -18, -48, 1, -18, 48, 1];
    const territoriosUsados = new Set();
    const cartelesAg = [];
    const cajaCartel = [0, 0, 0, 0];
    const trazoAg = new Float32Array(18);
    const viaAg = [0, 0, 0];
    const PT = { x: 0, y: 0, d: 0 };
    const TRIG = new Float64Array(4);
    const paseoPosible = () => !!(cerebro && cerebro.px && cerebro.px.length && completo());

    function prepararPantalla() {
      TRIG[0] = Math.cos(giro.ang);
      TRIG[1] = Math.sin(giro.ang);
      TRIG[2] = Math.cos(giro.tilt);
      TRIG[3] = Math.sin(giro.tilt);
    }

    function aPantalla(x, y, z) {
      const dx = x - giro.cx;
      const X = dx * TRIG[0] + z * TRIG[1];
      const D = -dx * TRIG[1] + z * TRIG[0];
      const Y = y - giro.cy;
      const Y2 = Y * TRIG[2] - D * TRIG[3];
      const D2 = Y * TRIG[3] + D * TRIG[2];
      const f = giro.F / (giro.F - D2) * giro.esc;
      const t = transformacion;
      PT.x = (giro.cx + X * f + giro.px) * t.k + t.x;
      PT.y = (giro.cy + Y2 * f + giro.py) * t.k + t.y;
      PT.d = D2;
      return PT;
    }

    function parada(p) {
      const o = { x: p.x, y: p.y, z: p.z || 0 };
      o._lob = lobuloDe(o);
      return o;
    }

    function territorios() {
      if (cerebro.territorios) return cerebro.territorios;
      const px = cerebro.px;
      const lista = [];
      const vueltas = RADIO_TERRITORIO.length;
      for (let i = 0; i < ORDEN_TERRITORIOS.length * vueltas; i++) {
        const l = cerebro.lobulos.find(x => x.id === ORDEN_TERRITORIOS[i % ORDEN_TERRITORIOS.length]) || cerebro.lobulos[i % cerebro.lobulos.length];
        const rad = l.wr * RADIO_TERRITORIO[Math.floor(i / ORDEN_TERRITORIOS.length)];
        const ang = i * 2.39996;
        const tx = l.wx + Math.cos(ang) * rad;
        const ty = l.wy + Math.sin(ang) * rad * 0.8;
        const tz = (i % 2 ? 1 : -1) * 0.5 * (cerebro.anchoMundo(tx, ty) || 0);
        let mejor = 0;
        let md = Infinity;
        for (let j = 0; j < px.length; j += 2) {
          const p = px[j];
          const d = (p.x - tx) ** 2 + (p.y - ty) ** 2 + ((p.z || 0) - tz) ** 2;
          if (d < md) { md = d; mejor = j; }
        }
        lista.push(parada(px[mejor]));
      }
      cerebro.territorios = lista;
      return lista;
    }

    function notaCercana(p) {
      let mejor = null;
      let md = Infinity;
      for (const n of nodos) {
        if (!n._visible || n._sx === undefined) continue;
        const d = (n.x - p.x) ** 2 + (n.y - p.y) ** 2 + ((n.z || 0) - (p.z || 0)) ** 2;
        if (d < md) { md = d; mejor = n; }
      }
      return mejor || p;
    }

    function paradaCerca(v) {
      const conGL = !!neuronasGL;
      const px = conGL ? cerebro.px : nodos;
      const T = v.casa;
      const w = v.leyo ? limitar((performance.now() - v.leyo) / 30000) : 1;
      const cx = v.x + (T.x - v.x) * w;
      const cy = v.y + (T.y - v.y) * w;
      const cz = v.z + (T.z - v.z) * w;
      const R = giro.R;
      const r2 = (R * Math.min(2.4, 0.3 + 0.16 * v.pasos)) ** 2;
      const m2 = (R * 0.14) ** 2;
      for (let k = 0; k < 60; k++) {
        const p = px[Math.floor(Math.random() * px.length)];
        if (!conGL && (!p._visible || p._sx === undefined || p === v.obj)) continue;
        const z = p.z || 0;
        if ((p.x - cx) ** 2 + (p.y - cy) ** 2 + (z - cz) ** 2 < r2 && (p.x - v.x) ** 2 + (p.y - v.y) ** 2 + (z - v.z) ** 2 > m2) return conGL ? parada(p) : p;
      }
      return conGL ? T : notaCercana(T);
    }

    function chispasEn(x, y, z, color, cuantas) {
      const px = cerebro.px;
      const pares = cerebro.vecinos;
      if (!pares || !pares.length || !completo() || introCorriendo()) return;
      const r2 = (190 * cerebro.S) ** 2;
      const ahora = performance.now();
      let hechas = 0;
      for (let k = 0; k < cuantas * 16 && hechas < cuantas && vida.chispas.length < 180; k++) {
        const par = pares[Math.floor(Math.random() * pares.length)];
        const A = px[par[0]];
        if ((A.x - x) ** 2 + (A.y - y) ** 2 + ((A.z || 0) - z) ** 2 < r2) {
          vida.chispas.push({ a: par[0], b: par[1], t0: ahora + hechas * 45, color, saltos: 0, max: 3 + hechas % 3 });
          hechas++;
        }
      }
      asegurarVida();
    }

    const durViaje = (v, o) => Math.max(700, Math.min(2600, 650 + 1500 * Math.hypot(o.x - v.x, o.y - v.y, (o.z || 0) - v.z) / giro.R));

    function viajeA(v, o, dur, ahora) {
      const a = v.a;
      const q = v.q;
      a[0] = v.x;
      a[1] = v.y;
      a[2] = v.z;
      const desde = v.obj;
      v.obj = o;
      v.rA = v.r;
      const bz = o.z || 0;
      const mx = (a[0] + o.x) / 2;
      const my = (a[1] + o.y) / 2;
      const mz = (a[2] + bz) / 2;
      const k = desde && desde !== o ? ranuraVia(desde, o) : -1;
      if (k >= 0) {
        viaMundo(k, viaAg);
        q[0] = 2 * viaAg[0] - mx;
        q[1] = 2 * viaAg[1] - my;
        q[2] = 2 * viaAg[2] - mz;
      } else {
        q[0] = mx + (mx - giro.cx) * 0.35;
        q[1] = my + (my - giro.cy) * 0.35;
        q[2] = mz * 1.35;
      }
      v.t0 = ahora;
      v.dur = dur;
      v.u = 0;
      v.llego = false;
    }

    function visualDe(c, s, ahora) {
      if (s.v) return s.v;
      const T = territorios();
      let i = 0;
      while (territoriosUsados.has(i) && i < T.length) i++;
      const propio = i < T.length;
      if (!propio) i = hashTexto(s.nombre + s.num) % T.length;
      else territoriosUsados.add(i);
      const casa = T[i];
      const meta = neuronasGL ? casa : notaCercana(casa);
      const o = c.hacia && c.hacia._visible ? c.hacia : meta;
      const v = { a: new Float64Array(3), q: new Float64Array(3), obj: o, x: o.x, y: o.y, z: o.z || 0, t0: ahora, dur: 0, u: 1, e: 1, llego: true, tLlega: ahora,
                  nace: false, sale: 0, lento: false, casa, terr: i, propio, pasos: 0, r: 0, rA: 0, sx: 0, sy: 0, luz: 1, lado: -1, destello: 0, pulso: 0, leyo: 0,
                  foco: { x: 0, y: 0, z: 0, color: s.color, r2: 0, cada: 90, fuerza: 0.2 } };
      s.v = v;
      if (o !== meta) {
        v.nace = true;
        viajeA(v, meta, durViaje(v, meta) * 0.85, ahora);
        chispasEn(o.x, o.y, o.z || 0, s.color, 8);
      }
      return v;
    }

    function soltarTerritorio(s) {
      if (s.v && s.v.propio) {
        territoriosUsados.delete(s.v.terr);
        s.v.propio = false;
      }
    }

    function pasear(c, s, ev) {
      const ahora = performance.now();
      s.tAccion = ahora;
      if (!paseoPosible() || introCorriendo()) return;
      const v = visualDe(c, s, ahora);
      const nota = notaDe(ev);
      if (nota && nota._visible) {
        if (v.obj !== nota) viajeA(v, nota, durViaje(v, nota), ahora);
        v.nace = false;
        v.lento = false;
        v.leyo = ahora;
        return;
      }
      if (!v.llego && (v.nace || ahora - v.t0 < 450)) return;
      v.pasos++;
      v.lento = false;
      const p = paradaCerca(v);
      viajeA(v, p, durViaje(v, p), ahora);
    }

    function despedir(c, s) {
      soltarTerritorio(s);
      const v = s.v;
      if (!v || !paseoPosible()) return;
      const ahora = performance.now();
      const o = c.hacia && c.hacia._visible ? c.hacia : null;
      v.sale = ahora;
      v.nace = false;
      v.lento = false;
      v.volver = !!o;
      if (o) viajeA(v, o, Math.max(700, durViaje(v, o) * 0.8), ahora);
      c.salen.push(s);
      if (c.salen.length > 16) c.salen.shift();
    }

    function avanzarVisual(s, v, ahora, eL) {
      const u = v.dur > 0 ? limitar((ahora - v.t0) / v.dur) : 1;
      const e = v.nace ? sale3(u) : entraSale(u);
      const o = v.obj;
      const oz = o.z || 0;
      v.u = u;
      v.e = e;
      v.x = puntoCurva(v.a[0], v.q[0], o.x, e);
      v.y = puntoCurva(v.a[1], v.q[1], o.y, e);
      v.z = puntoCurva(v.a[2], v.q[2], oz, e);
      if (u >= 1) {
        v.x = o.x;
        v.y = o.y;
        v.z = oz;
      }
      const nota = o._visible && o._sx !== undefined;
      const rMeta = nota ? o._sr + 9 * eL : 6 * eL;
      v.r = v.dur > 0 && u < 1 ? v.rA + (rMeta - v.rA) * e : rMeta;
      aPantalla(v.x, v.y, v.z);
      let sx = PT.x;
      let sy = PT.y;
      v.luz = 0.55 + 0.45 * limitar((PT.d + giro.R) / (2 * giro.R));
      if (nota) {
        aPantalla(o.x, o.y, oz);
        sx += (o._sx - PT.x) * e;
        sy += (o._sy - PT.y) * e;
      }
      const ang = s.ang + s.giro;
      v.sx = sx + Math.cos(ang) * v.r;
      v.sy = sy + Math.sin(ang) * v.r;
      if (u >= 1 && !v.llego) {
        v.llego = true;
        v.tLlega = ahora;
        v.destello = ahora;
        chispasEn(v.x, v.y, v.z, s.color, v.sale ? 4 : v.nace ? 10 : v.lento ? 3 : 6);
        v.nace = false;
      }
      if (v.llego && !v.sale && ahora - v.tLlega > 3200 && ahora - s.tAccion > 6000) {
        v.pasos++;
        v.lento = true;
        const p = paradaCerca(v);
        viajeA(v, p, durViaje(v, p) * 2.4, ahora);
      }
    }

    function dibujarAgente(s, v, alfa, eL, ahora) {
      if (v.u < 1 && v.dur > 0) {
        const e0 = Math.max(0, v.e - (v.lento ? 0.18 : 0.3));
        const o = v.obj;
        for (let i = 0; i <= 8; i++) {
          const e = e0 + (v.e - e0) * i / 8;
          aPantalla(puntoCurva(v.a[0], v.q[0], o.x, e), puntoCurva(v.a[1], v.q[1], o.y, e), puntoCurva(v.a[2], v.q[2], o.z || 0, e));
          trazoAg[i * 2] = PT.x;
          trazoAg[i * 2 + 1] = PT.y;
        }
        pctx.strokeStyle = s.color;
        pctx.lineCap = 'round';
        pctx.lineJoin = 'round';
        pctx.beginPath();
        pctx.moveTo(trazoAg[0], trazoAg[1]);
        for (let i = 1; i <= 8; i++) pctx.lineTo(trazoAg[i * 2], trazoAg[i * 2 + 1]);
        pctx.lineTo(v.sx, v.sy);
        const fuerte = v.lento ? 0.5 : 1;
        pctx.globalAlpha = 0.18 * alfa * fuerte;
        pctx.lineWidth = 7 * eL;
        pctx.stroke();
        pctx.globalAlpha = 0.7 * alfa * fuerte;
        pctx.lineWidth = 1.8;
        pctx.stroke();
        pctx.lineCap = 'butt';
        pctx.lineJoin = 'miter';
      }
      const dd = ahora - v.destello;
      if (v.destello && dd < 700) {
        const k = dd / 700;
        pctx.globalAlpha = alfa * (1 - k) * 0.9;
        pctx.strokeStyle = s.color;
        pctx.lineWidth = 2 * (1 - k) + 0.5;
        pctx.beginPath();
        pctx.arc(v.sx, v.sy, 5 + (v.sale ? 14 : 24) * sale3(k) * eL, 0, TAU);
        pctx.stroke();
        brillo(v.sx, v.sy, 16 + 20 * (1 - k), s.color, alfa * (1 - k));
      }
      brillo(v.sx, v.sy, 16, s.color, alfa);
      pctx.globalAlpha = alfa;
      pctx.fillStyle = s.color;
      pctx.beginPath();
      pctx.arc(v.sx, v.sy, 4.8, 0, TAU);
      pctx.fill();
      const rot = ahora / 120;
      pctx.strokeStyle = s.color;
      pctx.lineWidth = 1.8;
      pctx.beginPath();
      pctx.arc(v.sx, v.sy, 8.5, rot, rot + 3.6);
      pctx.stroke();
    }

    function dibujarSalen(c, ahora, eL, f, pos) {
      let quedan = 0;
      for (const s of c.salen) {
        const v = s.v;
        avanzarVisual(s, v, ahora, eL);
        if (v.volver && pos) {
          const k = v.llego ? 1 : sale3(limitar((v.u - 0.45) / 0.55));
          v.sx += (pos.x - v.sx) * k;
          v.sy += (pos.y - v.sy) * k;
        }
        let alfa;
        if (v.volver) {
          if (v.llego && ahora - v.tLlega > 700) continue;
          alfa = f * v.luz * (v.llego ? 1 : 1 - 0.45 * v.e);
        } else {
          alfa = f * v.luz * (1 - (ahora - v.sale) / 600);
          if (alfa <= 0) continue;
        }
        c.salen[quedan++] = s;
        if (v.volver && v.llego) {
          const k = (ahora - v.tLlega) / 700;
          pctx.globalAlpha = alfa * (1 - k);
          pctx.strokeStyle = s.color;
          pctx.lineWidth = 2 * (1 - k) + 0.5;
          pctx.beginPath();
          pctx.arc(v.sx, v.sy, 4 + 14 * sale3(k) * eL, 0, TAU);
          pctx.stroke();
          brillo(v.sx, v.sy, 12 + 18 * (1 - k), s.color, alfa * (1 - k));
        } else dibujarAgente(s, v, alfa, eL, ahora);
      }
      c.salen.length = quedan;
    }

    function focoAgente(s, v, ahora, apagar) {
      const f = v.foco;
      f.x = v.x;
      f.y = v.y;
      f.z = v.z;
      f.color = s.color;
      const mueve = v.u < 1 && !v.lento;
      const d = Math.max(v.destello ? Math.exp(-(ahora - v.destello) / 350) : 0, v.pulso ? 0.8 * Math.exp(-(ahora - v.pulso) / 500) : 0);
      f.fuerza = ((mueve ? 0.34 : 0.2) + 0.45 * d) * apagar;
      f.cada = mueve ? 26 : v.u < 1 ? 60 : 110;
      f.r2 = ((mueve ? 150 : 240) * cerebro.S) ** 2;
      return f;
    }

    function cajaLibre(caja) {
      if (caja[0] < 4 || caja[2] > ancho - 4 || caja[1] < 4 || caja[3] > alto - 4) return false;
      if (bajoPanel(caja[0], caja[1], caja[2], caja[3]) || choca(caja, vivo.tapas)) return false;
      const rot = cerebro && cerebro.rotulos;
      if (rot) {
        for (const r of rot) {
          if (r.a > 0.1 && caja[0] < r.x + r.w / 2 + 4 && caja[2] > r.x - r.w / 2 - 4 && caja[1] < r.y + 10 * escalaTexto && caja[3] > r.y - 10 * escalaTexto) return false;
        }
      }
      return true;
    }

    function cartelAgente(s, texto, alfa) {
      const v = s.v;
      const w = anchoEtiqueta(texto);
      const n = LADOS_CARTEL.length / 3;
      let elegido = -1;
      for (let k = -1; k < n && elegido < 0; k++) {
        const j = k < 0 ? v.lado : k;
        if (j < 0 || (k >= 0 && j === v.lado)) continue;
        const x = v.sx + LADOS_CARTEL[j * 3];
        const y = v.sy + LADOS_CARTEL[j * 3 + 1];
        const izq = LADOS_CARTEL[j * 3 + 2];
        cajaCartel[0] = izq ? x - w : x;
        cajaCartel[1] = y - 11;
        cajaCartel[2] = izq ? x : x + w;
        cajaCartel[3] = y + 11;
        if (cajaLibre(cajaCartel)) elegido = j;
      }
      const tapado = elegido < 0;
      if (tapado) elegido = v.lado >= 0 ? v.lado : 0;
      v.lado = elegido;
      etiqueta(v.sx + LADOS_CARTEL[elegido * 3], v.sy + LADOS_CARTEL[elegido * 3 + 1], texto, s.color, alfa * (tapado ? 0.3 : 1), !!LADOS_CARTEL[elegido * 3 + 2]);
    }

