  function partirLineas(c, texto, maximo) {
    const lineas = [];
    let actual = '';
    texto.split(' ').forEach(p => {
      const prueba = actual ? actual + ' ' + p : p;
      if (actual && c.measureText(prueba).width > maximo) { lineas.push(actual); actual = p; }
      else actual = prueba;
    });
    if (actual) lineas.push(actual);
    return lineas;
  }

  async function armarMiDia() {
    if (captura.grabacion) { aviso('Estoy grabando: la tarjeta, cuando termine el video.'); return; }
    if (compartir.ocupado) { aviso('Esperá un momento: todavía estoy armando lo anterior.'); return; }
    if (!vivo.resumenDia) { aviso('«Mi día» necesita el servidor: abrí el mapa con /neuromapa:abrir (sin el plugin, con bin/neuromapa abrir).'); return; }
    compartir.ocupado = true;
    let dia = null;
    let error = '';
    try { dia = await vivo.resumenDia(); } catch (e) { error = e.message; }
    compartir.ocupado = false;
    if (error) { aviso('No pude armar la tarjeta: ' + error + '.'); return; }
    if (!dia || !dia.tot || !dia.tot.eventos) { aviso('Todavía no hay nada registrado hoy: la tarjeta sale cuando Claude haya trabajado un rato.'); return; }
    if (!(await confirmarNombres('tarjeta'))) return;
    compartir.ocupado = true;
    compartir.dia.disabled = true;
    compartir.dia.textContent = 'Armando…';
    try {
      const cv = await pedirCaptura(() => armarTarjeta(dia));
      bajar(await lienzoABlob(cv), nombreBajada('mi-dia', 'png'));
      aviso('Bajé la tarjeta de tu día.');
    } catch (e) {
      aviso('No pude armar la tarjeta: ' + e.message + '.');
    } finally {
      compartir.ocupado = false;
      compartir.dia.disabled = false;
      compartir.dia.textContent = 'Mi día';
    }
  }

  function iniciarCompartir() {
    compartir.dialogo = $('#compartir-dialogo');
    compartir.texto = $('#compartir-texto');
    compartir.foto = $('#sacar-foto');
    compartir.dia = $('#mi-dia');
    compartir.sinNotas = $('#sin-notas');
    compartir.grabar = $('#grabar-clip');
    compartir.formato = $('#formato-clip');
    compartir.marca = $('#grabando');
    try { compartir.vertical = localStorage.getItem('cerebro-clip') === 'vertical'; } catch (e) {}
    compartir.dia.hidden = !/^https?:$/.test(location.protocol);
    compartir.sinNotas.hidden = !/^https?:$/.test(location.protocol) || DATOS.compartido === true;
    pintarFormato();
    pintarBotonGrabar();
    compartir.foto.addEventListener('click', sacarFoto);
    compartir.dia.addEventListener('click', armarMiDia);
    compartir.sinNotas.addEventListener('click', bajarSinNotas);
    compartir.grabar.addEventListener('click', alternarGrabacion);
    compartir.formato.addEventListener('click', () => {
      compartir.vertical = !compartir.vertical;
      try { localStorage.setItem('cerebro-clip', compartir.vertical ? 'vertical' : 'horizontal'); } catch (e) {}
      pintarFormato();
    });
    const d = compartir.dialogo;
    $('#compartir-cancelar').addEventListener('click', () => d.close(''));
    $('#compartir-cerrar').addEventListener('click', () => d.close(''));
    $('#compartir-real').addEventListener('click', () => d.close('real'));
    $('#compartir-anonimo').addEventListener('click', () => d.close('anonimo'));
    d.addEventListener('click', ev => { if (ev.target === d) d.close(''); });
  }

  function focoDe(n, fuente) {
    const ns = new Set([n]);
    const as = new Set();
    n.salientes.forEach(l => { if (l._visible) { as.add(l); ns.add(l.target); } });
    n.entrantes.forEach(l => { if (l._visible) { as.add(l); ns.add(l.source); } });
    return { fuente, nodos: ns, aristas: as, centro: n };
  }

  function calcularFoco() {
    const h = arrastrando || estado.hover;
    if (h && h._visible) return focoDe(h, 'hover');
    const e = estado.nombrada;
    if (e && e.nota === estado.seleccionado && e.nota._visible) return { fuente: 'busqueda', nodos: e.nodos, aristas: e.aristas, centro: null };
    const s = estado.seleccionado;
    if (s && s._visible && estado.coincidencias && estado.coincidencias.has(s)) return focoDe(s, 'seleccion');
    if (estado.coincidencias) return { fuente: 'busqueda', nodos: estado.coincidencias, aristas: estado.aristasBusqueda, centro: null };
    if (s && s._visible) return focoDe(s, 'seleccion');
    return { fuente: null, nodos: null, aristas: null, centro: null };
  }

  function redondeado(x, y, w, h, r, c = ctx) {
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  const SOMA = new Float64Array(7);
  function geometriaSoma(n, r) {
    const d = n._dendritas;
    const m = n._m;
    SOMA[6] = r;
    if (!d || !m || !d.punta || m[6] < 0.02) return 0;
    const e = Math.min(1, m[6]);
    const ux = m[2] / m[6];
    const uy = m[3] / m[6];
    const r0 = Math.min(r, n._sr);
    if (d.forma === 'purkinje') {
      const ext = r0 * d.punta * e;
      if (ext < 0.5) return 0;
      SOMA[0] = ux * ext;
      SOMA[1] = uy * ext;
      return 1;
    }
    const a = r0 * (1 - 0.25 * e);
    const rho = a * (1 - 0.6 * e);
    const delta = 2 * (a - rho);
    SOMA[6] = rho + r - r0;
    if (delta < 0.02 * r0) { SOMA[6] = a + r - r0; return 0; }
    const apice = delta + r0 * d.punta * e * 0.35;
    SOMA[0] = ux * apice;
    SOMA[1] = uy * apice;
    SOMA[2] = (-0.5 * ux - 0.8660254 * uy) * delta;
    SOMA[3] = (0.8660254 * ux - 0.5 * uy) * delta;
    SOMA[4] = (-0.5 * ux + 0.8660254 * uy) * delta;
    SOMA[5] = (-0.8660254 * ux - 0.5 * uy) * delta;
    return 2;
  }

  function anguloNormal(i, k) {
    const ex = SOMA[2 * k] - SOMA[2 * i];
    const ey = SOMA[2 * k + 1] - SOMA[2 * i + 1];
    const mx = SOMA[2 * k] + SOMA[2 * i];
    const my = SOMA[2 * k + 1] + SOMA[2 * i + 1];
    return ey * mx - ex * my < 0 ? Math.atan2(ex, -ey) : Math.atan2(-ex, ey);
  }

  function bajoSoma(n, r) {
    const tipo = geometriaSoma(n, r);
    if (tipo === 0) return SOMA[6];
    if (tipo === 1) return r + Math.max(0, SOMA[1]);
    return SOMA[6] + Math.max(SOMA[1], SOMA[3], SOMA[5]);
  }

  function alcanceSoma(n) {
    const tipo = geometriaSoma(n, n._sr);
    if (tipo === 0) return n._sr;
    return Math.max(n._sr, Math.hypot(SOMA[0], SOMA[1]) + (tipo === 2 ? SOMA[6] : n._sr));
  }

  function trazarForma(n, x, y, r, c = ctx) {
    c.beginPath();
    const tipo = geometriaSoma(n, r);
    if (tipo === 0) { c.arc(x, y, SOMA[6], 0, TAU); return; }
    if (tipo === 1) {
      const D = Math.hypot(SOMA[0], SOMA[1]) + r;
      const base = Math.atan2(SOMA[1], SOMA[0]);
      const th = Math.acos(r / D);
      c.moveTo(x + Math.cos(base) * D, y + Math.sin(base) * D);
      c.arc(x, y, r, base + th, base - th + TAU);
      c.closePath();
      return;
    }
    const R = SOMA[6];
    for (let i = 0; i < 3; i++) {
      const a0 = anguloNormal((i + 2) % 3, i);
      let a1 = anguloNormal(i, (i + 1) % 3);
      if (a1 < a0) a1 += TAU;
      c.arc(x + SOMA[2 * i], y + SOMA[2 * i + 1], R, a0, a1);
    }
    c.closePath();
  }

  function trazarBorde(n, x, y, r) {
    ctx.strokeStyle = colores.bordeNodo;
    ctx.lineCap = 'butt';
    switch (n.tipo) {
      case 'feedback':
        ctx.lineWidth = 1.6; trazarForma(n, x, y, r); ctx.stroke(); break;
      case 'project':
        ctx.lineWidth = 1.6; ctx.setLineDash([3, 2]); trazarForma(n, x, y, r); ctx.stroke(); break;
      case 'reference':
        ctx.lineWidth = 1.9; ctx.lineCap = 'round'; ctx.setLineDash([0.1, 2.8]); trazarForma(n, x, y, r); ctx.stroke(); break;
      case 'user':
        ctx.lineWidth = 1.2; trazarForma(n, x, y, r); ctx.stroke();
        ctx.lineWidth = 1; trazarForma(n, x, y, r + 2.8); ctx.stroke(); break;
      case 'indice':
        ctx.lineWidth = 1.8; trazarForma(n, x, y, r); ctx.stroke(); break;
      case 'instrucciones':
        ctx.lineWidth = 2; trazarForma(n, x, y, r); ctx.stroke();
        ctx.lineWidth = 1; trazarForma(n, x, y, r + 3.2); ctx.stroke(); break;
      case 'handoff':
        break;
      default:
        ctx.strokeStyle = colores.fondo; ctx.lineWidth = 1; trazarForma(n, x, y, r); ctx.stroke();
    }
    ctx.setLineDash([]);
  }

  function factorNace(n) {
    if (!n._nace) return 1;
    const p = (anim.ahora - n._nace) / INTRO.nace;
    return p >= 1 ? 1 : p <= 0 ? 0 : sale3(p);
  }

  const NEURONA = {
    piramidal: { punta: 0.95, piso: 3, tope: 11, grosor: 1 },
    ca1: { punta: 1.2, piso: 3, tope: 11, grosor: 0.85 },
    betz: { punta: 1, piso: 6, tope: 14, grosor: 1.3 },
    purkinje: { punta: 0.6, piso: 4.5, tope: 13, grosor: 1 },
    multipolar: { punta: 0, piso: 3, tope: 11, grosor: 1 }
  };

  function lugarNeurona(n) {
    const l = cerebro.lobulos[lobuloDe(n)];
    const id = l ? l.id : '';
    const zona = id === 'cerebelo' || id === 'tronco' ? id : 'cuerpo';
    let forma = zona === 'cerebelo' ? 'purkinje' : zona === 'tronco' ? 'multipolar' : id === 'temporal' ? 'ca1' : 'piramidal';
    if (n.tipo === 'indice' || n.tipo === 'instrucciones') forma = 'betz';
    return { zona, forma };
  }

  function dendritasDe(n) {
    if (n._dendritas) return n._dendritas;
    if (!cerebro) return null;
    const { zona, forma } = lugarNeurona(n);
    const azar = azarConSemilla(hashTexto('neurona' + n.id));
    const entre = (a, b) => a + azar() * (b - a);
    const lado = () => (azar() < 0.5 ? -1 : 1);
    const capas = { g: [], f: [], x: [] };
    const dirAz = (phi, e) => [Math.cos(phi) * Math.cos(e), Math.sin(e), Math.sin(phi) * Math.cos(e)];
    const sigue = p => [p[4], p[5], p[6]];
    const ultimo = r => r[r.length - 1];
    const rama = (capa, p, dir, largo, pasos, torsion) => {
      const lista = capas[capa];
      let x = p[0];
      let y = p[1];
      let z = p[2];
      let d = p[3];
      const l0 = Math.hypot(dir[0], dir[1], dir[2]) || 1;
      let vx = dir[0] / l0;
      let vy = dir[1] / l0;
      let vz = dir[2] / l0;
      lista.push(x, y, z, d, 1);
      const l = largo / pasos;
      const puntos = [];
      for (let i = 0; i < pasos; i++) {
        vx += (azar() - 0.5) * torsion;
        vy += (azar() - 0.5) * torsion;
        vz += (azar() - 0.5) * torsion;
        const lv = Math.hypot(vx, vy, vz) || 1;
        vx /= lv;
        vy /= lv;
        vz /= lv;
        x += vx * l;
        y += vy * l;
        z += vz * l;
        d += l;
        lista.push(x, y, z, d, 0);
        puntos.push([x, y, z, d, vx, vy, vz]);
      }
      return puntos;
    };
    const terminal = (p, k, largo) => {
      for (let i = 0; i < k; i++) rama('x', p, [p[4] + entre(-0.9, 0.9), p[5] + entre(-0.9, 0.9), p[6] + entre(-0.9, 0.9)], largo * entre(0.6, 1.1), 1, 0);
    };
    const piramidal = o => {
      const eje = rama('g', [0, 1.3, 0, 0], [entre(-0.1, 0.1), 1, entre(-0.1, 0.1)], o.apical * 0.62, 4, 0.1);
      const cima = ultimo(rama('f', ultimo(eje), sigue(ultimo(eje)), o.apical * 0.38, 2, 0.14));
      const giro0 = azar() * TAU;
      for (let i = 0; i < o.oblicuas; i++) {
        const p = eje[1 + Math.floor(azar() * (eje.length - 1))];
        rama('f', p, dirAz(giro0 + i * 2.4 + entre(-0.4, 0.4), entre(0.3, 0.75)), entre(o.oblicua[0], o.oblicua[1]), 2, 0.3);
      }
      for (let i = 0; i < o.penacho; i++) {
        const phi = giro0 + (i / o.penacho) * TAU + entre(-0.5, 0.5);
        const r = rama('f', cima, dirAz(phi, entre(0.35, 0.9)), entre(o.cima[0], o.cima[1]), 3, 0.35);
        if (o.ramifica && azar() < 0.5) rama('f', r[0], dirAz(phi + lado() * entre(0.6, 1.1), entre(0.3, 0.8)), o.cima[0] * entre(0.5, 0.9), 2, 0.3);
      }
      for (let i = 0; i < o.basales; i++) {
        const phi = giro0 + 0.7 + (i / o.basales) * TAU + entre(-0.45, 0.45);
        const e = entre(-1.05, -0.4);
        const L = entre(o.basal[0], o.basal[1]);
        const raiz = rama('g', [Math.cos(phi) * 0.7, -0.5, Math.sin(phi) * 0.7, 0], dirAz(phi, e), L * 0.35, 1, 0.15);
        const fino = rama('f', raiz[0], sigue(raiz[0]), L * 0.65, 3, 0.6);
        if (o.ramifica && azar() < 0.75) rama('f', fino[0], dirAz(phi + lado() * entre(0.5, 0.9), e - 0.2), L * 0.4, 2, 0.4);
      }
      const ax = rama('x', [0, -1, 0, 0], [entre(-0.08, 0.08), -1, entre(-0.08, 0.08)], o.axon, 6, 0.07);
      for (let i = 0; i < o.colaterales; i++) rama('x', ax[2 + i * 2], dirAz(azar() * TAU, entre(-0.4, 0.1)), entre(1.1, 1.9), 3, 0.25);
      terminal(ultimo(ax), o.ramifica ? 3 : 2, 0.9);
    };
    const purkinje = () => {
      const tallo = ultimo(rama('g', [0, 1.1, 0, 0], [0, 1, 0], 1.1, 2, 0.05));
      const abanico = (p, ang, nivel, largo) => {
        const hijos = nivel === 0 || azar() < 0.88 ? 2 : 1;
        for (let h = 0; h < hijos; h++) {
          const desvio = hijos === 1 ? entre(-0.25, 0.25) : (h ? 1 : -1) * entre(0.24, 0.52);
          const a = Math.max(-1.35, Math.min(1.35, ang + desvio));
          const r = rama(nivel < 2 ? 'g' : 'f', p, [Math.sin(a), Math.cos(a), entre(-0.05, 0.05)], largo * entre(0.8, 1.1), 2, 0.1);
          if (nivel < 4) abanico(ultimo(r), a, nivel + 1, largo * 0.8);
        }
      };
      abanico(tallo, 0, 0, 1.9);
      const ax = rama('x', [0, -1, 0, 0], [entre(-0.1, 0.1), -1, 0], entre(3.8, 4.6), 5, 0.08);
      rama('x', ax[2], [lado() * 0.9, 0.5, 0], entre(1.3, 1.8), 3, 0.3);
      terminal(ultimo(ax), 2, 0.8);
    };
    const multipolar = () => {
      const k = 5 + Math.floor(azar() * 3);
      const giro0 = azar() * TAU;
      for (let i = 0; i < k; i++) {
        const u = entre(-0.8, 0.8);
        const phi = giro0 + (i / k) * TAU + entre(-0.4, 0.4);
        const h = Math.sqrt(1 - u * u);
        const dir = [Math.cos(phi) * h, u, Math.sin(phi) * h];
        const raiz = rama('g', [dir[0] * 0.8, dir[1] * 0.8, dir[2] * 0.8, 0], dir, entre(0.5, 0.9), 1, 0.2);
        const fino = rama('f', raiz[0], dir, entre(1.3, 2.6), 3, 0.55);
        if (azar() < 0.6) rama('f', fino[0], [dir[0] + entre(-0.9, 0.9), dir[1] + entre(-0.9, 0.9), dir[2] + entre(-0.9, 0.9)], entre(0.8, 1.4), 2, 0.5);
      }
      const ax = rama('x', [0, -1, 0, 0], [entre(-0.3, 0.3), -1, entre(-0.3, 0.3)], entre(4.5, 6.5), 5, 0.12);
      terminal(ultimo(ax), 3, 0.9);
    };
    const handoff = n.tipo === 'handoff';
    if (forma === 'purkinje') purkinje();
    else if (forma === 'multipolar') multipolar();
    else if (forma === 'betz') {
      piramidal({ apical: entre(7.5, 8.5), oblicuas: 3 + Math.floor(azar() * 2), oblicua: [1.3, 2.1], penacho: 4 + Math.floor(azar() * 2), cima: [1.8, 2.6],
                  basales: 6 + Math.floor(azar() * 3), basal: [2.6, 3.8], axon: entre(7.5, 9), colaterales: 2, ramifica: true });
    } else if (forma === 'ca1') {
      piramidal({ apical: entre(6.5, 8.2) * (handoff ? 0.6 : 1), oblicuas: handoff ? 2 : 4 + Math.floor(azar() * 3), oblicua: [0.6, 1.1], penacho: handoff ? 2 : 2 + Math.floor(azar() * 2), cima: [0.9, 1.4],
                  basales: 3 + Math.floor(azar() * 2), basal: [1.3, 2.1], axon: entre(4, 5.5), colaterales: handoff ? 0 : 1, ramifica: !handoff });
    } else {
      piramidal({ apical: entre(5, 7) * (handoff ? 0.55 : 1), oblicuas: handoff ? 1 : 2 + Math.floor(azar() * 2), oblicua: [0.8, 1.5], penacho: handoff ? 2 : 3 + Math.floor(azar() * 2),
                  cima: handoff ? [0.8, 1.3] : [1.1, 1.9], basales: handoff ? 2 + Math.floor(azar() * 2) : 3 + Math.floor(azar() * 3), basal: handoff ? [1.4, 2.2] : [1.8, 3],
                  axon: entre(4.5, 6.5) * (handoff ? 0.7 : 1), colaterales: handoff ? 0 : 1 + Math.floor(azar() * 2), ramifica: !handoff });
    }
    let maxD = 0;
    let maxX = 0;
    for (const lista of [capas.g, capas.f]) for (let i = 3; i < lista.length; i += 5) maxD = Math.max(maxD, lista[i]);
    for (let i = 3; i < capas.x.length; i += 5) maxX = Math.max(maxX, capas.x[i]);
    const empacar = (lista, tope) => {
      for (let i = 3; i < lista.length; i += 5) lista[i] /= tope || 1;
      return new Float32Array(lista);
    };
    const simplificar = arr => {
      const fuera = [];
      for (let i = 0; i < arr.length;) {
        let k = 1;
        while (i + k * 5 < arr.length && !arr[i + k * 5 + 4]) k++;
        const lineas = k - 1;
        for (let j = 0; j <= lineas; j++) {
          if (j === 0 || j === lineas || lineas <= 2 || j === Math.ceil(lineas / 2)) for (let q = 0; q < 5; q++) fuera.push(arr[i + j * 5 + q]);
        }
        i += k * 5;
      }
      return new Float32Array(fuera);
    };
    const [bx, by, rx, ry, rz] = cerebro.elipses[zona];
    const S = cerebro.S;
    const vuelta = forma === 'purkinje' ? 0 : azar() * TAU;
    const tipo = NEURONA[forma];
    const gruesas = empacar(capas.g, maxD);
    const finas = empacar(capas.f, maxD);
    const axon = empacar(capas.x, maxX);
    return (n._dendritas = {
      forma, zona, punta: tipo.punta, piso: tipo.piso, tope: tipo.tope, grosor: tipo.grosor, plano: forma === 'purkinje',
      gruesas, finas, axon, chica: [simplificar(gruesas), simplificar(finas), simplificar(axon)],
      ex: (bx - 520) * S, ey: (by - 330) * S, ix: 1 / (rx * S) ** 2, iy: 1 / (ry * S) ** 2, iz: 1 / (rz * S) ** 2,
      cg: Math.cos(vuelta), sg: Math.sin(vuelta)
    });
  }

  function orientar(n, ca, sa, ct, st) {
    const d = dendritasDe(n);
    if (!d) return;
    const m = n._m || (n._m = new Float32Array(7));
    let nx = (n.x - d.ex) * d.ix;
    let ny = (n.y - d.ey) * d.iy;
    let nz = d.plano ? 0 : (n.z || 0) * d.iz;
    let l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) { nx = 0; ny = -1; nz = 0; l = 1; }
    nx /= l;
    ny /= l;
    nz /= l;
    const lt = Math.hypot(nx, ny);
    let tx = 0;
    let ty = 0;
    let tz = 0;
    if (lt > 0.08) { tx = ny / lt; ty = -nx / lt; }
    else { const lx = Math.hypot(ny, nz) || 1; ty = nz / lx; tz = -ny / lx; }
    const wx = ny * tz - nz * ty;
    const wy = nz * tx - nx * tz;
    const wz = nx * ty - ny * tx;
    const ax = tx * d.cg + wx * d.sg;
    const ay = ty * d.cg + wy * d.sg;
    const az = tz * d.cg + wz * d.sg;
    const cx = wx * d.cg - tx * d.sg;
    const cy = wy * d.cg - ty * d.sg;
    const cz = wz * d.cg - tz * d.sg;
    let Xa = ax * ca + az * sa;
    const Da = az * ca - ax * sa;
    let Ya = ay * ct - Da * st;
    const Za = ay * st + Da * ct;
    let Xn = nx * ca + nz * sa;
    const Dn = nz * ca - nx * sa;
    let Yn = ny * ct - Dn * st;
    const Zn = ny * st + Dn * ct;
    const Xc = cx * ca + cz * sa;
    const Dc = cz * ca - cx * sa;
    const Yc = cy * ct - Dc * st;
    const Zc = cy * st + Dc * ct;
    if (d.plano && Math.abs(Zc) < 0.35) {
      const k = (Zc - 0.35 * Math.tanh(Zc / 0.07) / Math.tanh(5)) / Math.max(1e-6, Xc * Xc + Yc * Yc);
      Xa += k * Za * Xc;
      Ya += k * Za * Yc;
      Xn += k * Zn * Xc;
      Yn += k * Zn * Yc;
    }
    m[0] = Xa;
    m[1] = Ya;
    m[2] = Xn;
    m[3] = Yn;
    m[4] = Xc;
    m[5] = Yc;
    m[6] = Math.hypot(Xn, Yn);
  }

  function trazarRamas(c, arr, x, y, m, s) {
    const a0 = m[0] * s, a1 = m[1] * s, b0 = m[2] * s, b1 = m[3] * s, c0 = m[4] * s, c1 = m[5] * s;
    for (let i = 0; i < arr.length; i += 5) {
      const u = arr[i];
      const v = arr[i + 1];
      const w = arr[i + 2];
      const px = x + u * a0 + v * b0 + w * c0;
      const py = y + u * a1 + v * b1 + w * c1;
      if (arr[i + 4]) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
  }

  function trazarBanda(c, arr, x, y, m, s, lo, hi) {
    const a0 = m[0] * s, a1 = m[1] * s, b0 = m[2] * s, b1 = m[3] * s, c0 = m[4] * s, c1 = m[5] * s;
    for (let i = 5; i < arr.length; i += 5) {
      if (arr[i + 4]) continue;
      const d0 = arr[i - 2];
      const d1 = arr[i + 3];
      if (d1 <= lo || d0 >= hi || d1 <= d0) continue;
      const t0 = Math.max(0, (lo - d0) / (d1 - d0));
      const t1 = Math.min(1, (hi - d0) / (d1 - d0));
      const j = i - 5;
      const du = arr[i] - arr[j];
      const dv = arr[i + 1] - arr[j + 1];
      const dw = arr[i + 2] - arr[j + 2];
      let u = arr[j] + du * t0;
      let v = arr[j + 1] + dv * t0;
      let w = arr[j + 2] + dw * t0;
      c.moveTo(x + u * a0 + v * b0 + w * c0, y + u * a1 + v * b1 + w * c1);
      u = arr[j] + du * t1;
      v = arr[j + 1] + dv * t1;
      w = arr[j + 2] + dw * t1;
      c.lineTo(x + u * a0 + v * b0 + w * c0, y + u * a1 + v * b1 + w * c1);
    }
  }

  const escalaNeurona = (d, r) => Math.min(d.tope, Math.max(d.piso, r));

  const aclarados = new Map();
  const legibles = new Map();
  function legibleEnClaro(hex) {
    const clave = hex + '|' + colores.halo;
    const hecho = legibles.get(clave);
    if (hecho) return hecho;
    const rgb = h => { const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h); return m ? [1, 2, 3].map(i => parseInt(m[i], 16)) : null; };
    const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const base = rgb(hex);
    const fondo = rgb(colores.halo || '#ffffff') || [255, 255, 255];
    let r = hex;
    if (base) {
      const lf = lum(fondo);
      for (let t = 0; t <= 0.95; t += 0.05) {
        const c = base.map(v => Math.round(v * (1 - t)));
        r = '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
        if ((lf + 0.05) / (lum(c) + 0.05) >= 4.5) break;
      }
    }
    if (legibles.size > 200) legibles.clear();
    legibles.set(clave, r);
    return r;
  }

  function aclarar(hex, t) {
    const clave = hex + '|' + t;
    const hecho = aclarados.get(clave);
    if (hecho) return hecho;
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const c = [1, 2, 3].map(i => Math.round(parseInt(m[i], 16) + (255 - parseInt(m[i], 16)) * t));
    const r = '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
    if (aclarados.size > 600) aclarados.clear();
    aclarados.set(clave, r);
    return r;
  }

  function lavar(hex, t) {
    const clave = hex + '~' + t;
    const hecho = aclarados.get(clave);
    if (hecho) return hecho;
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return hex;
    const c = [1, 2, 3].map(i => parseInt(m[i], 16));
    const l = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const r = '#' + c.map(v => Math.round(v + (l - v) * t).toString(16).padStart(2, '0')).join('');
    if (aclarados.size > 600) aclarados.clear();
    aclarados.set(clave, r);
    return r;
  }

  function colorVivoDe(n) {
    const c = colorDe(n);
    return n._lavado > 0 && !vivo.calor ? lavar(c, n._lavado) : c;
  }

  function dibujarNeurona(n, x, y, r, alfa, color) {
    const d = dendritasDe(n);
    const m = n._m;
    if (!d || !m) return;
    const claro = anim.oscuro ? aclarar(color, 0.45) : color;
    const s = escalaNeurona(d, r);
    const chica = s < 5;
    ctx.strokeStyle = claro;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = alfa * (anim.oscuro ? 0.95 : 0.75);
    ctx.lineWidth = 2.3 * d.grosor;
    ctx.beginPath();
    trazarRamas(ctx, chica ? d.chica[0] : d.gruesas, x, y, m, s);
    ctx.stroke();
    ctx.globalAlpha = alfa * (anim.oscuro ? 0.75 : 0.55);
    ctx.lineWidth = 1.2 * d.grosor;
    ctx.beginPath();
    if (anim.nivel === 2) trazarRamas(ctx, chica ? d.chica[1] : d.finas, x, y, m, s);
    trazarRamas(ctx, chica ? d.chica[2] : d.axon, x, y, m, s);
    ctx.stroke();
    const gigante = d.forma === 'betz';
    const base = colorDe(n);
    if ((anim.nivel === 2 || gigante) && /^#[0-9a-f]{6}$/i.test(base)) {
      const R = gigante ? r * 3.4 + 8 : r * 2.8 + 5;
      ctx.globalAlpha = alfa * (anim.oscuro ? (gigante ? 0.62 : 0.5) : (gigante ? 0.3 : 0.22));
      ctx.drawImage(sprite(base, 'brillo'), x - R, y - R, 2 * R, 2 * R);
    }
  }

  function factorRefractario(n) {
    const hasta = n._refractaHasta;
    if (!hasta || anim.ahora >= hasta || anim.ahora <= n._refractaDesde) return 1;
    const u = (anim.ahora - n._refractaDesde) / (hasta - n._refractaDesde);
    return 1 - 0.5 * Math.min(1, u / 0.08) * Math.pow(1 - u, 1.2);
  }

  function dibujarCabeza(c, n, x, y, r, color, a) {
    const R = r * 2.1 + 6;
    c.globalAlpha = a * (anim.oscuro ? 0.36 : 0.22);
    c.drawImage(sprite(color, 'brillo'), x - R, y - R, 2 * R, 2 * R);
    if (r < 1.5) return;
    c.globalAlpha = a * (anim.oscuro ? 0.75 : 0.85);
    c.strokeStyle = color;
    c.lineWidth = 1.3;
    trazarForma(n, x, y, r + 2.4, c);
    c.stroke();
  }

  function dibujarNodo(n, alfa, destacado) {
    const x = n._sx;
    const y = n._sy;
    let r = n._sr;
    if (n._nace) {
      const p = (anim.ahora - n._nace) / INTRO.nace;
      if (p >= 1) n._nace = 0;
      else if (p <= 0) return;
      else { alfa *= sale3(p); r *= 0.25 + 0.75 * saltar(p); }
    }
    if (n._choque) r *= escalaChoque(n, anim.ahora);
    if (n._cortina > 0.03 && gestos.barrido) {
      const R = r * 2.6 + 16;
      ctx.globalAlpha = alfa * n._cortina * (anim.oscuro ? 0.9 : 0.5);
      ctx.drawImage(sprite(gestos.barrido.hex, 'brillo'), x - R, y - R, 2 * R, 2 * R);
    }
    alfa *= factorRefractario(n);
    if (!destacado && anim.penNota < 1) alfa *= anim.penNota + (1 - anim.penNota) * (n._rec || 0);
    const apagado = n.tipo === 'handoff' && !destacado;
    const base = colorDe(n);
    const colorCuerpo = destacado ? base : colorVivoDe(n);
    const coc = destacado ? 0 : n._coc || 0;
    if (coc > 0.02 && /^#[0-9a-f]{6}$/i.test(colorCuerpo)) {
      const R = r * (2 + 2.4 * coc) + 4;
      ctx.globalAlpha = alfa * coc * (anim.oscuro ? 0.34 : 0.22) * (apagado ? 0.6 : 1);
      ctx.drawImage(sprite(colorCuerpo, 'brillo'), x - R, y - R, 2 * R, 2 * R);
    }
    const simple = anim.masivo && !destacado;
    if (!simple && r >= 1.8 && anim.nivel >= 1 && coc < 0.6) dibujarNeurona(n, x, y, r, alfa * (apagado ? 0.6 : 1) * (1 - coc / 0.6), colorCuerpo);
    if (coc) alfa *= 1 - 0.5 * coc;
    if (n._consolidada) {
      const u = Math.max(0, anim.ahora - n._consolidada) / 3600000;
      if (u >= 1) n._consolidada = 0;
      else if (/^#[0-9a-f]{6}$/i.test(base)) {
        const R = r * 3.2 + 7;
        ctx.globalAlpha = alfa * (1 - u) * (anim.oscuro ? 0.55 : 0.32);
        ctx.drawImage(sprite(base, 'brillo'), x - R, y - R, 2 * R, 2 * R);
      }
    }
    if (n._cabeza) dibujarCabeza(ctx, n, x, y, r, n._cabeza.color, alfa * n._cabeza.alfa);
    ctx.globalAlpha = alfa * (apagado ? 0.5 : 1);
    trazarForma(n, x, y, r);
    if (!simple && r >= 3 && anim.nivel >= 1 && /^#[0-9a-f]{6}$/i.test(colorCuerpo)) {
      const g = ctx.createRadialGradient(x - 0.3 * r, y - 0.3 * r, 0, x, y, r * 1.05);
      g.addColorStop(0, aclarar(colorCuerpo, 0.75));
      g.addColorStop(0.35, aclarar(colorCuerpo, 0.25));
      g.addColorStop(1, colorCuerpo);
      ctx.fillStyle = g;
    } else {
      ctx.fillStyle = colorCuerpo;
    }
    ctx.fill();
    if (colores.nucleo && r >= 7) {
      ctx.beginPath();
      ctx.arc(x - 0.24 * r, y - 0.24 * r, 0.3 * r, 0, TAU);
      ctx.fillStyle = colores.nucleo;
      ctx.fill();
    }
    if (!simple && r >= 2.4) trazarBorde(n, x, y, r);
    if (estado.coincidencias && estado.coincidencias.has(n)) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colores.resalte;
      ctx.lineWidth = 2.2;
      trazarForma(n, x, y, r + 3.4);
      ctx.stroke();
    }
    if (n === estado.seleccionado) {
      ctx.globalAlpha = 1;
      ctx.strokeStyle = colores.texto;
      ctx.lineWidth = 2;
      trazarForma(n, x, y, r + (n.tipo === 'user' || n.tipo === 'instrucciones' ? 6.5 : 4.6));
      ctx.stroke();
    }
  }

  function flecha(a, b, tam) {
    const [qx, qy] = controlCurva(a, b);
    const dx = b._sx - qx;
    const dy = b._sy - qy;
    const d = Math.hypot(dx, dy);
    if (d < b._sr + tam * 2.5) return;
    const ux = dx / d;
    const uy = dy / d;
    const px = b._sx - ux * (b._sr + 3);
    const py = b._sy - uy * (b._sr + 3);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - ux * tam - uy * tam * 0.55, py - uy * tam + ux * tam * 0.55);
    ctx.lineTo(px - ux * tam + uy * tam * 0.55, py - uy * tam - ux * tam * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  const umbralEtiqueta = n => n.tipo === 'handoff' ? 2.4 : n.importante ? 0.45 : 1.35;
  function etiquetaPorZoom(n, k) { return k >= umbralEtiqueta(n) * 0.85; }
  function alfaZoom(n, k) { const u = umbralEtiqueta(n); return Math.min(1, Math.max(0, (k - 0.85 * u) / (0.15 * u))); }

  const choca = (caja, cajas) => cajas.some(r => caja[0] < r[2] && caja[2] > r[0] && caja[1] < r[3] && caja[3] > r[1]);

  function tapaOtroGrupo(caja, grupo) {
    for (const n of nodosVisibles) {
      if (!n._en || n.grupo === grupo) continue;
      const r = n._sr + 2;
      if (n._sx + r > caja[0] && n._sx - r < caja[2] && n._sy + r > caja[1] && n._sy - r < caja[3]) return true;
    }
    return false;
  }

  function ubicarCarteles(carteles, ocupadas) {
    const puestos = [];
    if (!carteles.length) return puestos;
    const espaciado = 'letterSpacing' in ctx;
    ctx.font = FUENTE_CARTEL;
    if (espaciado) ctx.letterSpacing = '0.08em';
    for (const cartel of carteles) {
      if (cartel.alfa < 0.05) continue;
      const g = cartel.g;
      cartel.texto = g._cartel || (g._cartel = recortar(publico('grupo', g, g.nombre).replace(/\s*\(.*\)\s*$/, ''), 32).toUpperCase());
      cartel.w = g._wc || (g._wc = ctx.measureText(cartel.texto).width);
      const e = escalaTexto;
      const xMin = 12 + 14 * e + cartel.w / 2;
      const xMax = ancho - 12 - 4 - cartel.w / 2;
      for (const [px, y] of cartel.pos) {
        const x = xMax > xMin ? Math.min(xMax, Math.max(xMin, px)) : px;
        const caja = [x - cartel.w / 2 - 14 * e, y - 2, x + cartel.w / 2 + 4, y + 17 * e];
        if (choca(caja, ocupadas) || tapaOtroGrupo(caja, g.id)) continue;
        ocupadas.push(caja);
        cartel.x = x;
        cartel.y = y;
        puestos.push(cartel);
        break;
      }
    }
    if (espaciado) ctx.letterSpacing = '0px';
    return puestos;
  }

  function dibujarCarteles(puestos) {
    if (!puestos.length) return;
    const espaciado = 'letterSpacing' in ctx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.font = FUENTE_CARTEL;
    if (espaciado) ctx.letterSpacing = '0.08em';
    const e = escalaTexto;
    for (const cartel of puestos) {
      ctx.globalAlpha = cartel.alfa;
      ctx.lineWidth = 4 * e;
      ctx.strokeStyle = colores.halo;
      ctx.strokeText(cartel.texto, cartel.x, cartel.y);
      ctx.fillStyle = colores.texto2;
      ctx.fillText(cartel.texto, cartel.x, cartel.y);
      ctx.beginPath();
      ctx.arc(cartel.x - cartel.w / 2 - 8 * e, cartel.y + 7 * e, 3.5 * e, 0, TAU);
      ctx.fillStyle = colorDelGrupo(cartel.g);
      ctx.fill();
      if (cartel.alfa > 0.15) anim.cajasTexto.push([cartel.x - cartel.w / 2 - 14 * e, cartel.y - 2, cartel.x + cartel.w / 2 + 4, cartel.y + 17 * e, cartel.alfa]);
    }
    if (espaciado) ctx.letterSpacing = '0px';
  }

  function pintarEtiquetas(plan) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    ctx.setLineDash([]);
    ctx.lineWidth = 3.5;
    for (const e of plan) {
      ctx.font = e.fuerte ? FUENTE_FUERTE : FUENTE;
      ctx.globalAlpha = e.alfa;
      ctx.strokeStyle = colores.halo;
      ctx.strokeText(e.texto, e.x, e.y);
      ctx.fillStyle = e.fuerte ? colores.texto : colores.texto2;
      ctx.fillText(e.texto, e.x, e.y);
      if (e.w && e.alfa > 0.15) anim.cajasTexto.push([e.x - e.w / 2 - 3, e.y - 1, e.x + e.w / 2 + 3, e.y + 16, e.alfa]);
    }
  }

  const etiquetasVivas = new Set();
  const centrosGrupo = new Map();
  const yEtiqueta = n => n._sy + bajoSoma(n, n._sr) + 4;

  function planearEtiquetas(foco, k, carteles, ahora, extras) {
    const colocadas = [];
    const plan = [];
    const hechos = new Set();
    const marca = ++anim.cuadroEtq;
    const dt = Math.min(64, Math.max(0, ahora - (anim.tEtq || ahora)));
    anim.tEtq = ahora;
    const f = anim.modo === 'nada' ? 1 : 1 - Math.exp(-dt / 180);
    const pesoProf = pesoProfundidad();
    const tapas = vivo.tapas;
    const nombres = fundidoIntro(INTRO.nombres, 600, ahora);
    const poner = (n, fuerte, alfa, forzar) => {
      if (hechos.has(n)) return;
      hechos.add(n);
      if (alfa < 0.05) return;
      if (!n._visible || !n._en || factorNace(n) < 1) return;
      const texto = n._etq || (n._etq = publico('nota', n, tituloCorto(n, 44)));
      ctx.font = fuerte ? FUENTE_FUERTE : FUENTE;
      let w;
      if (fuerte) w = n._wf || (n._wf = ctx.measureText(texto).width);
      else w = n._w || (n._w = ctx.measureText(texto).width);
      const x = n._sx;
      const y = yEtiqueta(n);
      const caja = [x - w / 2 - 3, y - 1, x + w / 2 + 3, y + 16];
      if (!forzar && choca(caja, colocadas)) return;
      colocadas.push(caja);
      let a = alfa;
      if (!forzar) {
        a *= nombres * (1 - pesoProf * 0.7 * (1 - limitar((n._prof + giro.R) / (2 * giro.R))));
        if (n._coc) a *= 1 - 0.6 * n._coc;
        if (tapas.length && choca(caja, tapas)) a *= 0.12;
      }
      n._metaEtq = a;
      n._fuerteEtq = fuerte;
      n._forzadaEtq = forzar;
      n._marcaEtq = marca;
      etiquetasVivas.add(n);
    };
    if (foco.centro) {
      poner(foco.centro, true, 1, true);
      foco.nodos.forEach(n => poner(n, false, 1, false));
    }
    if (foco.fuente === 'busqueda') {
      const pocas = foco.nodos.size <= 60;
      for (const n of porImportancia) {
        if (foco.nodos.has(n) && (pocas || etiquetaPorZoom(n, k))) poner(n, true, pocas ? 1 : alfaZoom(n, k), false);
      }
    }
    if (estado.seleccionado) poner(estado.seleccionado, true, 1, true);
    const alfaResto = anim.aE;
    if (alfaResto > 0 && nombres > 0) {
      for (let pasada = 0; pasada < 2; pasada++) {
        for (const n of porImportancia) {
          if (hechos.has(n) || !n._visible || !etiquetaPorZoom(n, k)) continue;
          if (pasada === 0 && n._marcaEtq !== marca - 1) continue;
          poner(n, false, alfaResto * alfaZoom(n, k), false);
        }
      }
    }
    let fundiendo = false;
    const arriba = [];
    for (const n of etiquetasVivas) {
      const puesta = n._marcaEtq === marca;
      const meta = puesta ? n._metaEtq : 0;
      let a = (n._aEtq || 0) + (meta - (n._aEtq || 0)) * f;
      if (Math.abs(a - meta) < 0.01) a = meta;
      else fundiendo = true;
      n._aEtq = a;
      if (a <= 0 && meta <= 0) { etiquetasVivas.delete(n); continue; }
      if (a < 0.02 || !n._visible || !n._en || !n._etq) continue;
      (puesta && n._forzadaEtq ? arriba : plan).push({ texto: n._etq, x: n._sx, y: yEtiqueta(n), fuerte: n._fuerteEtq, alfa: a, w: (n._fuerteEtq ? n._wf : n._w) || 0 });
    }
    for (const e of arriba) plan.push(e);
    if (fundiendo) anim.escenaHasta = Math.max(anim.escenaHasta, ahora + 20);
    anim.cajasNotas = colocadas;
    return { plan, carteles: ubicarCarteles(carteles, extras && extras.length ? colocadas.concat(extras) : colocadas) };
  }

  function dibujar(ahora) {
    const t = transformacion;
    const k = t.k;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, ancho, alto);
    anim.cajasTexto.length = 0;
    const centro0 = proyectar(giro.cx, giro.cy, 0);
    centroPant.x = centro0.x * k + t.x;
    centroPant.y = centro0.y * k + t.y;
    cuadroVia++;
    dibujarCerebro(t, k);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const escalaR = Math.sqrt(k);
    const escalaL = Math.min(1.6, Math.max(0.55, escalaR));
    const porGrupo = new Map();
    const pesoProf = pesoProfundidad();
    const cA = Math.cos(giro.ang);
    const sA = Math.sin(giro.ang);
    const cT = Math.cos(giro.tilt);
    const sT = Math.sin(giro.tilt);
    const dtR = anim.tRec ? Math.min(100, Math.max(0, ahora - anim.tRec)) : 1e9;
    anim.tRec = ahora;
    const aR = completo() ? 1 - Math.exp(-dtR / 600) : 1;
    anim.penNota = brasas.activo ? 0.45 + 0.35 * ritmo.luz : 1;
    let recMueve = false;
    actualizarGestos(ahora);
    const empuja = gestos.hay && !!neuronasGL && !!cerebro;
    const cortina = !!gestos.barrido;
    const dof = camara.dof > 0.01 ? camara.dof : 0;
    let enPantalla = 0;
    for (const n of nodosVisibles) {
      const p = proyectar(n.x, n.y, n.z || 0);
      const px = p.x;
      const py = p.y;
      n._cortina = cortina ? cortinaEn(n) : 0;
      if (empuja) {
        empujar(n.x, n.y, n.z || 0);
        const q = proyectar(EMP[0], EMP[1], EMP[2]);
        n._sx = q.x * k + t.x;
        n._sy = q.y * k + t.y;
      } else {
        n._sx = px * k + t.x;
        n._sy = py * k + t.y;
      }
      n._prof = p.d;
      n._coc = dof ? dof * limitar((Math.abs(p.d - camara.prof) / giro.R - 0.08) * 1.9) : 0;
      n._luz = 1 - pesoProf * 0.55 * (1 - limitar((p.d + giro.R) / (2 * giro.R)));
      const metaR = n._brasa ? Math.min(1, n._brasa.calor * 2.2) : 0;
      const rec = n._rec === undefined ? metaR : n._rec + (metaR - n._rec) * aR;
      n._rec = Math.abs(metaR - rec) < 0.005 ? metaR : rec;
      if (n._rec !== metaR) recMueve = true;
      n._lavado = brasas.activo ? Math.round((1 - n._rec) * 5) * 7 / 100 : 0;
      n._sr = Math.max(1.6, n.r * escalaR * p.f);
      n._en = n._sx > -80 && n._sx < ancho + 80 && n._sy > -80 && n._sy < alto + 80;
      if (n._en) {
        enPantalla++;
        orientar(n, cA, sA, cT, sT);
        n._alcance = alcanceSoma(n);
      }
      let g = porGrupo.get(n.grupo);
      if (!g) porGrupo.set(n.grupo, g = { c: 0, sx: 0, sy: 0, s2: 0, top: Infinity, fondo: -Infinity });
      g.c++;
      g.sx += px;
      g.sy += py;
      g.s2 += px * px + py * py;
      if (py < g.top) g.top = py;
      if (py > g.fondo) g.fondo = py;
    }
    anim.masivo = enPantalla > MASIVO || anim.masivoForzado;
    centrosGrupo.clear();
    porGrupo.forEach((g, id) => centrosGrupo.set(id, g));
    if (recMueve) anim.escenaHasta = Math.max(anim.escenaHasta, ahora + 34);
    const focoActual = calcularFoco();
    if (dof) {
      if (focoActual.nodos) focoActual.nodos.forEach(n => { n._coc = 0; });
      if (estado.seleccionado) estado.seleccionado._coc = 0;
      if (camara.nota) camara.nota._coc = 0;
    }
    let foco = focoActual;
    const hayActual = !!focoActual.nodos;
    const esSel = focoActual.fuente === 'seleccion';
    const metaA = hayActual ? (esSel ? 0.3 : 0.08) : 1;
    const metaN = hayActual ? (esSel ? 0.38 : 0.13) : 1;
    const metaE = hayActual ? (esSel ? 0.45 : 0) : 1;
    if (hayActual) { anim.focoPrevio = focoActual; anim.focoSoltado = 0; }
    else if (anim.focoPrevio && !anim.focoSoltado) anim.focoSoltado = ahora;
    const dtF = Math.min(64, Math.max(0, ahora - anim.tFoco));
    anim.tFoco = ahora;
    if (anim.modo === 'nada') { anim.aA = metaA; anim.aN = metaN; anim.aE = metaE; anim.focoPrevio = null; }
    else {
      const sube = metaA > anim.aA;
      if (!sube || !anim.focoSoltado || ahora - anim.focoSoltado > 90) {
        const f = 1 - Math.exp(-dtF / (sube ? 60 : 40));
        anim.aA += (metaA - anim.aA) * f;
        anim.aN += (metaN - anim.aN) * f;
        anim.aE += (metaE - anim.aE) * f;
      }
      if (Math.abs(anim.aA - metaA) < 0.01 && Math.abs(anim.aN - metaN) < 0.01 && Math.abs(anim.aE - metaE) < 0.01) {
        anim.aA = metaA;
        anim.aN = metaN;
        anim.aE = metaE;
        if (!hayActual) anim.focoPrevio = null;
      } else anim.escenaHasta = Math.max(anim.escenaHasta, ahora + 20);
      if (!hayActual && anim.focoPrevio) foco = anim.focoPrevio;
    }
    const hay = !!foco.nodos;
    const atenuarArista = anim.aA;
    const atenuarNodo = anim.aN;

    let qA = 1;
    if (anim.encendido) { const p = (ahora - anim.encendido - 250) / 800; if (p >= 1) anim.encendido = null; else qA = p <= 0 ? 0 : entraSale(p); }

    if (anim.nivel === 2 && colores.auraAlfa > 0) {
      const fz = limitar((2.2 - k) / 1.2);
      if (fz > 0) {
        const tope = 0.6 * Math.max(ancho, alto);
        ctx.globalAlpha = colores.auraAlfa * fz * qA * Math.max(0.5, atenuarNodo);
        for (const [id, g] of porGrupo) {
          if (g.c < 3) continue;
          const cx = g.sx / g.c;
          const cy = g.sy / g.c;
          const R = Math.min((Math.sqrt(Math.max(0, g.s2 / g.c - cx * cx - cy * cy)) * 1.5 + 40) * k, tope);
          const x = cx * k + t.x;
          const y = cy * k + t.y;
          if (x + R < 0 || x - R > ancho || y + R < 0 || y - R > alto) continue;
          ctx.drawImage(sprite(colorDelGrupo(grupoPorId.get(id)), 'aura'), x - R, y - R, 2 * R, 2 * R);
        }
      }
    }

    const carteles = [];
    const fc = limitar((1.1 - k) / 0.5) * qA;
    if (fc > 0 && !estado.local) {
      const alfaC = fc * (estado.coincidencias ? 0.5 : 1) * (focoActual.fuente === 'busqueda' ? 1 : Math.max(0.5, atenuarNodo));
      const dentro = y => y >= 4 && y <= alto - 20;
      for (const [id, g] of porGrupo) {
        if (g.c < 3) continue;
        const x = g.sx / g.c * k + t.x;
        if (x < 0 || x > ancho) continue;
        const pos = [g.top * k + t.y - 30, g.fondo * k + t.y + 18].filter(dentro).map(y => [x, y]);
        const rot = cerebro && cerebro.rotuloPorGrupo ? cerebro.rotuloPorGrupo.get(id) : null;
        if (rot) {
          const w = limitar((rot.a - 0.2) / 0.5);
          const base = pos[0] || [x, g.top * k + t.y - 30];
          const bx = base[0] + (rot.x - base[0]) * w;
          const by = base[1] + (rot.y + 10 * escalaTexto - base[1]) * w;
          if (w > 0 && dentro(by)) pos.unshift([bx, by]);
        }
        if (pos.length) carteles.push({ g: grupoPorId.get(id), x, pos, alfa: alfaC, c: g.c });
      }
      carteles.sort((a, b) => b.c - a.c);
    }
    const ocupadasExtra = [];
    if (cerebro && cerebro.rotulos) {
      for (const r of cerebro.rotulos) if (r.a > 0.15) ocupadasExtra.push([r.x - r.w / 2 - 2, r.y - 7 * escalaTexto, r.x + r.w / 2 + 2, r.y + 7 * escalaTexto]);
    }
    if (vivo.tapaPanel) ocupadasExtra.push(vivo.tapaPanel);

    const livianoAlGirar = anim.gira && anim.aristasLivianas && anim.nivel >= 2;
    const liviano = anim.masivo || anim.nivel < 2 || livianoAlGirar;
    anim.dibujoLiviano = livianoAlGirar && !anim.masivo;
    let lc = ctx;
    if (anim.masivo) {
      const w = Math.max(1, Math.round(ancho / 2));
      const h = Math.max(1, Math.round(alto / 2));
      if (!capaAristas) capaAristas = document.createElement('canvas');
      if (capaAristas.width !== w || capaAristas.height !== h) { capaAristas.width = w; capaAristas.height = h; }
      lc = capaAristas.getContext('2d');
      lc.setTransform(0.5, 0, 0, 0.5, 0, 0);
      lc.clearRect(0, 0, ancho, alto);
    }
    const mielina = estado.clasesOn.has('aprendida');
    for (const c of ORDEN_DIBUJO) {
      if (qA <= 0) break;
      if (!estado.clasesOn.has(c)) continue;
      const grupoAristas = visiblesPorClase[c];
      if (!grupoAristas || !grupoAristas.length) continue;
      const info = CLASES[c];
      if (anim.masivo && info.alfa < 0.25) continue;
      const especial = info.debil || anim.nivel === 0;
      const alfaBase = (hay ? info.alfa * atenuarArista : info.alfa) * qA;
      const guion = liviano ? null : info.guion;
      lc.lineCap = guion ? 'butt' : 'round';
      lc.setLineDash(guion ? guion.map(v => v * escalaL) : []);
      const caminos = new Map();
      for (const l of grupoAristas) {
        if (hay && foco.aristas.has(l)) continue;
        if (l._sobre && tapada(l)) continue;
        const a = l.source;
        const b = l.target;
        if ((a._sx < 0 && b._sx < 0) || (a._sx > ancho && b._sx > ancho) || (a._sy < 0 && b._sy < 0) || (a._sy > alto && b._sy > alto)) continue;
        if (qA < 1 && (factorNace(a) < 0.5 || factorNace(b) < 0.5)) continue;
        const color = especial ? colores[info.tinta] : colorDe(a);
        const nivel = info.porPeso ? nivelPeso(l) : 0;
        const uso = mielina ? nivelUso(l._mielina) : 0;
        const llave = color + '|' + nivel + '|' + uso;
        let camino = caminos.get(llave);
        if (!camino) caminos.set(llave, camino = new Path2D());
        const [qx, qy] = controlCurva(a, b);
        camino.moveTo(a._sx, a._sy);
        camino.quadraticCurveTo(qx, qy, b._sx, b._sy);
      }
      for (const [llave, camino] of caminos) {
        const partes = llave.split('|');
        const color = partes[0];
        const nivel = Number(partes[1]);
        const uso = Number(partes[2]);
        lc.strokeStyle = color;
        if (especial) {
          lc.globalAlpha = Math.min(1, alfaBase * (1 + 0.5 * uso));
          lc.lineWidth = info.ancho * escalaL * (nivel ? 0.5 + 0.6 * nivel : 1) * (1 + 0.5 * uso);
          lc.stroke(camino);
          continue;
        }
        if (anim.oscuro) lc.globalCompositeOperation = 'lighter';
        if (!liviano) {
          lc.globalAlpha = alfaBase * 0.14 * (1 + 0.8 * uso);
          lc.lineWidth = info.ancho * escalaL * 3.2 * (1 + 0.35 * uso);
          lc.stroke(camino);
        }
        const nucleo = Math.max(0.6, info.ancho * escalaL * 0.85) * (1 + 0.5 * uso);
        lc.globalAlpha = Math.min(0.7 + 0.08 * uso, alfaBase * 0.6 * (1 + 0.8 * uso));
        lc.lineWidth = nucleo;
        lc.stroke(camino);
        if (uso >= 2 && !liviano) {
          lc.lineCap = 'round';
          lc.setLineDash([2.5 * escalaL, 4.5 * escalaL]);
          lc.globalAlpha = Math.min(0.85, 0.3 + 0.15 * uso) * alfaBase / info.alfa;
          lc.lineWidth = nucleo * 1.9;
          lc.stroke(camino);
          lc.lineCap = guion ? 'butt' : 'round';
          lc.setLineDash(guion ? guion.map(v => v * escalaL) : []);
        }
        lc.globalCompositeOperation = 'source-over';
      }
    }
    lc.setLineDash([]);
    if (lc !== ctx) {
      ctx.globalAlpha = 1;
      ctx.drawImage(capaAristas, 0, 0, ancho, alto);
    }

    if (hay && foco.aristas.size) {
      const colorFoco = foco.fuente === 'busqueda' ? colores.resalte : colorDe(foco.centro);
      for (const l of foco.aristas) {
        if (!l._visible || (l._sobre && tapada(l))) continue;
        const info = CLASES[l.clase];
        const color = colores[tintaArista(l, null)] || colorFoco;
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.95 * qA;
        ctx.lineWidth = Math.max(1.3, info.ancho * 1.4) * escalaL * (1 + 0.3 * (mielina ? nivelUso(l._mielina) : 0));
        ctx.lineCap = info.guion ? 'butt' : 'round';
        ctx.setLineDash(info.guion ? info.guion.map(v => v * escalaL * 1.2) : []);
        const [qx, qy] = controlCurva(l.source, l.target);
        ctx.beginPath();
        ctx.moveTo(l.source._sx, l.source._sy);
        ctx.quadraticCurveTo(qx, qy, l.target._sx, l.target._sy);
        ctx.stroke();
        if (foco.fuente !== 'busqueda') {
          ctx.setLineDash([]);
          flecha(l.source, l.target, 5 * escalaL + 1.5);
        }
      }
      ctx.setLineDash([]);
    }

    if (anim.nivel === 2 && colores.brilloAlfa > 0) {
      for (const n of porImportancia) {
        if (!n.importante) break;
        if (!n._visible || !n._en) continue;
        const q = factorNace(n);
        if (q <= 0) continue;
        const R = n._sr * 2.4 * (0.4 + 0.6 * q);
        ctx.globalAlpha = colores.brilloAlfa * (hay && !foco.nodos.has(n) ? atenuarNodo : 1) * q;
        ctx.drawImage(sprite(colorDe(n), 'brillo'), n._sx - R, n._sy - R, 2 * R, 2 * R);
      }
    }

    const etiquetas = planearEtiquetas(focoActual, k, carteles, ahora, ocupadasExtra);

    const enOrden = giro.ang || giro.tilt ? nodosVisibles.slice().sort((a, b) => a._prof - b._prof) : nodosVisibles;
    for (const n of enOrden) {
      if (!n._en || (hay && foco.nodos.has(n))) continue;
      dibujarNodo(n, (hay ? atenuarNodo : 1) * (n._luz === undefined ? 1 : n._luz), false);
    }
    if (hay) {
      foco.nodos.forEach(n => { if (n._visible && n._en) dibujarNodo(n, 1, true); });
      if (focoActual.centro && focoActual.fuente === 'hover' && focoActual.centro._en) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = colorDe(focoActual.centro);
        ctx.lineWidth = 2;
        trazarForma(focoActual.centro, focoActual.centro._sx, focoActual.centro._sy, focoActual.centro._sr + 3);
        ctx.stroke();
      }
    } else if (estado.seleccionado && estado.seleccionado._visible && estado.seleccionado._en) {
      dibujarNodo(estado.seleccionado, 1, true);
    }

    dibujarCarteles(etiquetas.carteles);
    pintarEtiquetas(etiquetas.plan);
    ctx.globalAlpha = 1;
  }

  function nodoEn(px, py) {
    let mejor = null;
    let md = Infinity;
    for (const n of nodosVisibles) {
      if (n._sx === undefined || (n._nace && factorNace(n) < 0.3)) continue;
      const dx = n._sx - px;
      const dy = n._sy - py;
      const d = dx * dx + dy * dy;
      const alc = (n._en && n._alcance || n._sr) + 5;
      const lim = alc * alc;
      if (d <= lim && d < md) { md = d; mejor = n; }
    }
    return mejor;
  }

  function ocultarTooltip() {
    tooltip.hidden = true;
  }

  function textoUso(u) {
    if (!u) return '';
    const plural = (c, uno, varios) => c + ' ' + (c === 1 ? uno : varios);
    const partes = [];
    if (u.leer) partes.push(plural(u.leer, 'lectura', 'lecturas') + (u.parcial ? ' (' + plural(u.parcial, 'parcial', 'parciales') + ')' : ''));
    if (u.shell) partes.push(plural(u.shell, 'vez', 'veces') + ' por consola');
    if (u.editar) partes.push(plural(u.editar, 'edición', 'ediciones'));
    if (u.falla) partes.push(plural(u.falla, 'intento fallido', 'intentos fallidos'));
    return partes.join(' · ');
  }

  function mostrarTooltip(n, ev) {
    if (!n) { ocultarTooltip(); return; }
    const uso = vivo.calor ? textoUso(n._uso) : '';
    if (tooltip._nodo !== n || tooltip._uso !== uso) {
      tooltip._nodo = n;
      tooltip._uso = uso;
      const g = grupoPorId.get(n.grupo);
      const p = proyectoPorId.get(n.proyecto);
      const desc = n.descripcion ? publico('texto', n, recortar(n.descripcion, 190)) : '';
      tooltip.innerHTML = '<div class="tt-titulo">' + punto(n) + '<b>' + esc(publico('nota', n, n.titulo)) + '</b></div>' +
        '<div class="tt-sub">' + esc(estado.porProyecto ? publico('proyecto', p, p.nombre) : publico('grupo', g, g.nombre)) + ' · ' + esc(nombreTipo(n.tipo)) + ' · ' + n.grado + (n.grado === 1 ? ' conexión' : ' conexiones') + '</div>' +
        (uso ? '<div class="tt-sub">' + esc(uso) + '</div>' : '') +
        (desc ? '<div class="tt-desc">' + esc(desc) + '</div>' : '');
    }
    tooltip.hidden = false;
    const r = centro.getBoundingClientRect();
    const w = tooltip.offsetWidth;
    const h = tooltip.offsetHeight;
    let x = ev.clientX - r.left + 16;
    let y = ev.clientY - r.top - h - 14;
    if (x + w > r.width - 8) x = ev.clientX - r.left - w - 12;
    if (y < 4) y = ev.clientY - r.top + 18;
    tooltip.style.transform = 'translate(' + Math.max(4, x) + 'px,' + Math.max(4, y) + 'px)';
  }

  function hashTexto(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function azarConSemilla(semilla) {
    let s = semilla >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const ANATOMIA = {
    cuerpo: [['M', 95, 345], ['C', 70, 250, 120, 140, 230, 90], ['C', 330, 40, 470, 30, 590, 45], ['C', 720, 60, 840, 110, 900, 190],
      ['C', 950, 255, 955, 330, 925, 385], ['C', 905, 420, 870, 440, 830, 447], ['C', 780, 452, 730, 455, 690, 465],
      ['C', 640, 478, 610, 510, 560, 525], ['C', 480, 545, 390, 548, 330, 515], ['C', 290, 495, 280, 460, 300, 430],
      ['C', 260, 440, 210, 440, 170, 428], ['C', 125, 415, 100, 390, 95, 345], ['Z']],
    cerebelo: [['M', 700, 470], ['C', 740, 440, 860, 440, 915, 480], ['C', 950, 510, 935, 570, 880, 590],
      ['C', 820, 610, 740, 600, 705, 565], ['C', 680, 540, 675, 495, 700, 470], ['Z']],
    tronco: [['M', 600, 505], ['C', 640, 520, 690, 520, 700, 540], ['C', 705, 580, 690, 620, 680, 690], ['L', 630, 690],
      ['C', 628, 640, 620, 600, 600, 560], ['C', 590, 535, 590, 515, 600, 505], ['Z']],
    surcos: [
      [['M', 300, 430], ['C', 380, 400, 480, 380, 580, 355], ['C', 620, 345, 650, 330, 675, 305]],
      [['M', 560, 42], ['C', 545, 110, 520, 170, 505, 230], ['C', 495, 270, 470, 310, 460, 362]],
      [['M', 470, 38], ['C', 455, 110, 430, 180, 410, 250], ['C', 400, 290, 385, 330, 372, 392]],
      [['M', 645, 56], ['C', 630, 120, 605, 180, 592, 245]],
      [['M', 232, 92], ['C', 280, 150, 330, 180, 405, 200]],
      [['M', 140, 250], ['C', 210, 262, 285, 285, 350, 332]],
      [['M', 610, 255], ['C', 680, 225, 760, 205, 850, 212]],
      [['M', 818, 108], ['C', 828, 150, 840, 182, 852, 214]],
      [['M', 335, 482], ['C', 430, 456, 540, 440, 650, 420], ['C', 700, 410, 745, 396, 800, 376]],
      [['M', 400, 520], ['C', 500, 500, 600, 484, 690, 468]],
      [['M', 882, 250], ['C', 902, 300, 902, 350, 884, 398]]
    ],
    lobulos: [
      { id: 'prefrontal', nombre: 'Prefrontal', x: 170, y: 300, r: 170, ex: 150, ey: 470 },
      { id: 'frontal', nombre: 'Frontal', x: 320, y: 200, r: 230, ex: 300, ey: 58 },
      { id: 'parietal', nombre: 'Parietal', x: 650, y: 170, r: 220, ex: 700, ey: 55 },
      { id: 'occipital', nombre: 'Occipital', x: 850, y: 300, r: 170, ex: 860, ey: 92 },
      { id: 'temporal', nombre: 'Temporal', x: 500, y: 465, r: 210, ex: 430, ey: 580 },
      { id: 'cerebelo', nombre: 'Cerebelo', x: 815, y: 525, r: 130, ex: 915, ey: 630 },
      { id: 'tronco', nombre: 'Tronco', x: 650, y: 610, r: 90, ex: 548, ey: 655 }
    ],
    anclas: {},
    anclaPorDefecto: [690, 250],
    tractos: {
      calloso: { espina: [[290, 292, 0], [340, 276, 0], [420, 263, 0], [520, 260, 0], [620, 266, 0], [690, 292, 0]], n: 300 },
      corona: { espina: [[520, 120, 120], [560, 280, 72], [600, 405, 48], [640, 525, 22], [651, 630, 12]], n: 280 },
      arqueado: { espina: [[318, 250, 150], [450, 232, 170], [590, 262, 180], [668, 340, 175], [620, 420, 165], [520, 452, 150]], r: 14, n: 200, abre: 1.6 },
      longitudinal: { espina: [[200, 265, 190], [300, 190, 200], [450, 150, 210], [600, 160, 210], [740, 215, 190], [830, 275, 160]], r: 12, n: 150, abre: 1.8 },
      cingulo: { espina: [[245, 372, 40], [222, 300, 42], [270, 222, 45], [420, 200, 45], [600, 205, 45], [700, 250, 45], [720, 340, 45], [690, 420, 50], [620, 452, 60]], r: 8, n: 120, abre: 1.2 },
      fornix: { espina: [[600, 452, 70], [665, 390, 45], [640, 318, 20], [540, 300, 12], [470, 318, 12], [440, 372, 16]], r: 5, n: 60, abre: 1 },
      uncinado: { espina: [[190, 395, 140], [260, 398, 150], [325, 408, 150], [352, 455, 145], [400, 488, 135]], r: 8, n: 76, abre: 1.5 },
      pedunculos: { espina: [[642, 560, 20], [690, 552, 40], [745, 525, 70], [805, 515, 95]], r: 8, n: 100, abre: 2.2 }
    },
    vias: {
      'prefrontal-frontal': 'longitudinal', 'prefrontal-parietal': 'longitudinal', 'prefrontal-occipital': 'cingulo',
      'prefrontal-temporal': 'uncinado', 'prefrontal-cerebelo': 'corona', 'prefrontal-tronco': 'corona',
      'frontal-parietal': 'longitudinal', 'frontal-occipital': 'cingulo', 'frontal-temporal': ['arqueado', 0.62],
      'frontal-cerebelo': 'corona', 'frontal-tronco': 'corona', 'parietal-occipital': 'longitudinal',
      'parietal-temporal': ['arqueado', 0.58], 'parietal-cerebelo': 'corona', 'parietal-tronco': 'corona',
      'occipital-temporal': 'arqueado', 'occipital-cerebelo': 'pedunculos', 'occipital-tronco': 'corona',
      'temporal-cerebelo': 'pedunculos', 'temporal-tronco': 'corona', 'cerebelo-tronco': 'pedunculos'
    }
  };
  (function () {
    const datosGrupos = Array.isArray(DATOS.grupos) ? DATOS.grupos.filter(g => g && g.id != null) : [];
    const rotulos = DATOS.lobulos && typeof DATOS.lobulos === 'object' ? DATOS.lobulos : {};
    const numeros = v => Array.isArray(v) && (v.length === 3 || v.length === 4) && v.every(x => typeof x === 'number' && isFinite(x));
    const cuantosEn = {};
    ANATOMIA.lobulos.forEach(l => {
      l.anatomico = l.nombre;
      if (typeof rotulos[l.id] === 'string') l.nombre = rotulos[l.id];
      const g = datosGrupos.find(x => x.lobulo === l.id);
      l.grupo = g ? String(g.id) : '';
    });
    datosGrupos.forEach(g => {
      const id = String(g.id);
      if (numeros(g.ancla)) { ANATOMIA.anclas[id] = g.ancla.slice(); return; }
      const l = ANATOMIA.lobulos.find(x => x.id === g.lobulo);
      if (!l) return;
      const k = cuantosEn[l.id] = (cuantosEn[l.id] || 0) + 1;
      const ang = (k - 1) * 2.399963;
      const d = k === 1 ? 0 : l.r * 0.38;
      ANATOMIA.anclas[id] = [l.x + Math.cos(ang) * d, l.y + Math.sin(ang) * d, Math.max(30, l.r * 0.42)];
    });
  })();
  function textoDelLobulo(l) {
    const nombre = String(l.nombre);
    const prefijo = l.anatomico + ' · ';
    return nombre.startsWith(prefijo) ? nombre.slice(prefijo.length) : nombre === l.anatomico ? '' : nombre;
  }
  let cerebro = null;
  const ctxForma = document.createElement('canvas').getContext('2d');

  const giro = { ang: 0, vel: TAU / 80000, t: 0, activo: true, F: 3000, cx: 0, cy: 0, R: 700, tilt: 0, esc: 1, px: 0, py: 0, inclina: 0, inerciaV: 0, tiltFondo: 0 };
  const INCLINA_TOPE = 1.45;
  const topeInclina = v => Math.max(-INCLINA_TOPE, Math.min(INCLINA_TOPE, v));
  const pesoProfundidad = () => 0.35 + 0.65 * Math.max(Math.abs(Math.sin(giro.ang)), limitar(Math.abs(giro.tilt) - 0.25));
  const MODOS_CAMARA = ['seguir', 'girar', 'quieto'];
  const CAMARA = { espera: 15000, cambio: 3000, foco: 1200, esperando: 20000, ventana: 0.6, resorte: 0.0022, tope: 0.0006, zoom: 0.09, corrimiento: 0.1, paralaje: 1.6 };
  const camara = { modo: 'seguir', activo: false, meta: 0, tMeta: 0, vel: 0, toque: -1e9, peso: 0, prof: 0, dof: 0, nota: null, tNota: 0, x: 0, y: 0, z: 0, angPrevio: 0, paralaje: 0, filmando: false };
  try {
    const guardado = localStorage.getItem('cerebro-giro');
    camara.modo = guardado === 'no' ? 'quieto' : MODOS_CAMARA.includes(guardado) ? guardado : 'seguir';
  } catch (e) {}
  giro.activo = camara.modo !== 'quieto';
  try {
    const inclina = parseFloat(localStorage.getItem('cerebro-inclina'));
    if (Number.isFinite(inclina)) giro.inclina = topeInclina(inclina);
  } catch (e) {}
  const guardarInclina = () => { try { localStorage.setItem('cerebro-inclina', String(Math.round(giro.inclina * 1000) / 1000)); } catch (e) {} };
  const envolver = a => a - TAU * Math.floor((a + Math.PI) / TAU);

  function proyectar(x, y, z, ang, tilt, esc) {
    const libre = ang === undefined;
    const a = libre ? giro.ang : ang;
    const ti = tilt === undefined ? giro.tilt : tilt;
    const e = esc === undefined ? giro.esc : esc;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const dx = x - giro.cx;
    const X = dx * c + z * s;
    const D = -dx * s + z * c;
    const Y = y - giro.cy;
    const Y2 = Y * Math.cos(ti) - D * Math.sin(ti);
    const D2 = Y * Math.sin(ti) + D * Math.cos(ti);
    const f = giro.F / (giro.F - D2) * e;
    return { x: giro.cx + X * f + (libre ? giro.px : 0), y: giro.cy + Y2 * f + (libre ? giro.py : 0), f, d: D2 };
  }

  function desproyectar(px, py, z) {
    const c = Math.cos(giro.ang);
    const s = Math.sin(giro.ang);
    const ct = Math.cos(giro.tilt);
    const st = Math.sin(giro.tilt);
    const F = giro.F;
    const e = giro.esc || 1;
    const u = (px - giro.px - giro.cx) / e;
    const v = (py - giro.py - giro.cy) / e;
    const a11 = u * ct * s - F * c;
    const a12 = -u * st;
    const b1 = F * s * z + u * ct * c * z - u * F;
    const a21 = v * ct * s - F * st * s;
    const a22 = -v * st - F * ct;
    const b2 = v * ct * c * z - F * st * c * z - v * F;
    const det = a11 * a22 - a12 * a21;
    if (Math.abs(det) < 1e-6) return [giro.cx + u, giro.cy + v];
    return [giro.cx + (b1 * a22 - a12 * b2) / det, giro.cy + (a11 * b2 - a21 * b1) / det];
  }

  const hexARgb = h => {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(h || ''));
    return m ? [parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255] : [0.6, 0.65, 0.75];
  };

  let neuronasGL = null;
  const PRECISION_ALTA = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
  const DERIVA_FONDO = 8;
  const lienzoNeuronas = document.getElementById('neuronas');
  if (lienzoNeuronas) {
    lienzoNeuronas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      if (!neuronasGL) return;
      neuronasGL.perdido = true;
      console.warn('Neuromapa: el navegador se llevó el contexto WebGL, espero a que lo devuelva');
    });
    lienzoNeuronas.addEventListener('webglcontextrestored', () => {
      const G = terminarGL(prepararGL());
      if (!G) {
        console.warn('Neuromapa: el WebGL volvió pero no se pudo rearmar; sigo con el dibujo 2D');
        neuronasGL = null;
        if (cerebro && cerebro.px && !cerebro.baldes) cerebro.baldes = baldesDe(cerebro.px);
        pedirDibujo();
        return;
      }
      neuronasGL = G;
      if (cerebro && cerebro.px) cerebro.gl = subirNeuronas(cerebro.px, cerebro.vecinos, cerebro.fibras);
      pedirDibujo();
    });
  }
  function terminarGL(G) {
    if (!G) return null;
    if (dibujaPorSoftware(G.gl)) {
      anim.porSoftware = true;
      arrancarLiviano();
    }
    try {
      [G.puntos, G.lineas, G.fondo].forEach(G.listo);
    } catch (e) {
      console.warn('Neuromapa: sin WebGL para las neuronas', e);
      return null;
    }
    if (G.motas) {
      try {
        G.listo(G.motas);
      } catch (e) {
        console.warn('Neuromapa: sin motas de primer plano', e);
        G.motas = null;
      }
    }
    if (G.brillo) {
      try {
        [G.brillo.desenfoque, G.brillo.mezcla].forEach(G.listo);
      } catch (e) {
        console.warn('Neuromapa: sin resplandor', e);
        G.brillo = null;
      }
    }
    return G;
  }
  function prepararGL() {
    const cv = document.getElementById('neuronas');
    if (!cv) return null;
    let gl = null;
    try { gl = cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    gl.getExtension('KHR_parallel_shader_compile');
    const compilar = (tipo, fuente) => {
      const s = gl.createShader(tipo);
      gl.shaderSource(s, fuente);
      gl.compileShader(s);
      return s;
    };
    const programa = (vs, fs, uniformes) => {
      const p = gl.createProgram();
      const partes = [compilar(gl.VERTEX_SHADER, vs), compilar(gl.FRAGMENT_SHADER, fs)];
      partes.forEach(s => gl.attachShader(p, s));
      gl.linkProgram(p);
      return { p, partes, uniformes };
    };
    const listo = x => {
      if (x.u) return;
      if (!gl.getProgramParameter(x.p, gl.LINK_STATUS)) {
        const rota = x.partes.find(s => !gl.getShaderParameter(s, gl.COMPILE_STATUS));
        throw new Error(rota ? gl.getShaderInfoLog(rota) : gl.getProgramInfoLog(x.p));
      }
      const u = {};
      x.uniformes.forEach(n => { u[n] = gl.getUniformLocation(x.p, n); });
      x.u = u;
      ['aPos', 'aCol', 'aExtra', 'aInicio', 'aNorm'].forEach(n => { x[n] = gl.getAttribLocation(x.p, n); });
    };
    const COMUN = 'uniform float uAng, uF, uCx, uCy, uK, uTx, uTy, uW, uH, uR, uLuz, uTilt, uEsc, uNoche;\n' +
      'vec3 girar(vec3 n) {\n' +
      '  float c = cos(uAng); float s = sin(uAng);\n' +
      '  float D = -n.x * s + n.z * c;\n' +
      '  float ct = cos(uTilt); float st = sin(uTilt);\n' +
      '  return vec3(n.x * c + n.z * s, n.y * ct - D * st, n.y * st + D * ct);\n' +
      '}\n' +
      'vec3 niebla(vec3 col, float prof) {\n' +
      '  float l = dot(col, vec3(0.3, 0.59, 0.11));\n' +
      '  vec3 frio = mix(vec3(0.66, 0.72, 0.84), vec3(0.45, 0.6, 1.0) * (l * 1.1 + 0.04), uNoche);\n' +
      '  return mix(col, frio, 0.62 * pow(1.0 - prof, 1.4));\n' +
      '}\n' +
      'vec4 proyectar(vec3 p, out float f, out float prof) {\n' +
      '  float c = cos(uAng); float s = sin(uAng);\n' +
      '  float dx = p.x - uCx;\n' +
      '  float X = dx * c + p.z * s;\n' +
      '  float D = -dx * s + p.z * c;\n' +
      '  float Y = p.y - uCy;\n' +
      '  float ct = cos(uTilt); float st = sin(uTilt);\n' +
      '  float Y2 = Y * ct - D * st;\n' +
      '  float D2 = Y * st + D * ct;\n' +
      '  f = uF / (uF - D2) * uEsc;\n' +
      '  vec2 q = vec2(uCx + X * f, uCy + Y2 * f) * uK + vec2(uTx, uTy);\n' +
      '  prof = clamp((D2 + uR) / (2.0 * uR), 0.0, 1.0);\n' +
      '  return vec4(q.x / uW * 2.0 - 1.0, 1.0 - q.y / uH * 2.0, 0.0, 1.0);\n' +
      '}\n';
    const UNIF = ['uAng', 'uF', 'uCx', 'uCy', 'uK', 'uTx', 'uTy', 'uW', 'uH', 'uR', 'uLuz', 'uTilt', 'uEsc', 'uNoche'];
    const focosGL = gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS) >= 224 ? FOCOS_MAX : 12;
    const ACTIVIDAD = 'uniform vec4 uFoco[' + focosGL + ']; uniform vec4 uFocoCol[' + focosGL + ']; uniform vec4 uOnda; uniform vec4 uOndaCol;\n' +
      'float actividad(vec3 p, inout vec3 col) {\n' +
      '  float act = 0.0;\n' +
      '  for (int i = 0; i < ' + focosGL + '; i++) {\n' +
      '    vec4 fo = uFoco[i];\n' +
      '    if (fo.w <= 0.0) break;\n' +
      '    vec3 d = p - fo.xyz;\n' +
      '    float a = uFocoCol[i].a * exp(-dot(d, d) / (fo.w * fo.w));\n' +
      '    col = mix(col, uFocoCol[i].rgb, min(1.0, a) * 0.7);\n' +
      '    act += a;\n' +
      '  }\n' +
      '  if (uOndaCol.a > 0.0) {\n' +
      '    float dd = length(p - uOnda.xyz);\n' +
      '    float w = uOnda.w * 0.16 + 40.0;\n' +
      '    float an = exp(-(dd - uOnda.w) * (dd - uOnda.w) / (w * w)) * uOndaCol.a;\n' +
      '    col = mix(col, uOndaCol.rgb, min(1.0, an) * 0.65);\n' +
      '    act += an;\n' +
      '  }\n' +
      '  return min(act, 1.6);\n' +
      '}\n' +
      'uniform vec4 uHuella[' + HUELLAS + ']; uniform vec4 uHuellaCol[' + HUELLAS + '];\n' +
      'float brasas(vec3 p, inout vec3 col) {\n' +
      '  float h = 0.0;\n' +
      '  for (int i = 0; i < ' + HUELLAS + '; i++) {\n' +
      '    vec4 hu = uHuella[i];\n' +
      '    if (hu.w <= 0.0) break;\n' +
      '    vec3 d = p - hu.xyz;\n' +
      '    float a = uHuellaCol[i].a * exp(-dot(d, d) / (hu.w * hu.w));\n' +
      '    col = mix(col, uHuellaCol[i].rgb, min(1.0, a) * 0.4);\n' +
      '    h += a;\n' +
      '  }\n' +
      '  return min(h, 1.0);\n' +
      '}\n' +
      'uniform vec4 uChoque[' + CHOQUES + ']; uniform vec4 uChoqueF[' + CHOQUES + ']; uniform vec4 uGestoEsc; uniform vec4 uContraer; uniform vec4 uPlano; uniform vec4 uPlanoCol;\n' +
      'vec3 gesto(vec3 p, float k, inout vec3 col, inout float act) {\n' +
      '  vec3 m = vec3(0.0);\n' +
      '  vec3 ez = vec3(-sin(uAng) * cos(uTilt), sin(uTilt), cos(uAng) * cos(uTilt));\n' +
      '  for (int i = 0; i < ' + CHOQUES + '; i++) {\n' +
      '    vec4 ch = uChoque[i];\n' +
      '    if (ch.w <= 0.0) break;\n' +
      '    vec3 d = p - ch.xyz;\n' +
      '    d -= ez * dot(d, ez);\n' +
      '    float l = length(d);\n' +
      '    float u = (l - ch.w) / uGestoEsc.x;\n' +
      '    float an = exp(-u * u);\n' +
      '    float f = uChoqueF[i].a;\n' +
      '    m += d / max(l, 1.0) * (an - 0.4 * exp(-(u + 1.7) * (u + 1.7))) * f * uGestoEsc.y;\n' +
      '    float a = an * min(1.0, abs(f));\n' +
      '    col = mix(col, uChoqueF[i].rgb, min(1.0, a) * 0.8);\n' +
      '    act += a * k;\n' +
      '  }\n' +
      '  if (uPlanoCol.a > 0.0) {\n' +
      '    float u = (dot(p, uPlano.xyz) - uPlano.w) / uGestoEsc.z;\n' +
      '    float an = exp(-u * u) * uPlanoCol.a;\n' +
      '    m += uPlano.xyz * an * uGestoEsc.w;\n' +
      '    col = mix(col, uPlanoCol.rgb, min(1.0, an) * 0.9);\n' +
      '    act += an * 0.7 * k;\n' +
      '  }\n' +
      '  m += (uContraer.xyz - p) * uContraer.w;\n' +
      '  act = min(act, 1.8);\n' +
      '  return m;\n' +
      '}\n';
    const UNIF_ACT = ['uFoco', 'uFocoCol', 'uOnda', 'uOndaCol', 'uHuella', 'uHuellaCol', 'uChoque', 'uChoqueF', 'uGestoEsc', 'uContraer', 'uPlano', 'uPlanoCol'];
    const RITMO = 'uniform vec4 uRitmo; uniform vec3 uDirOnda; uniform float uTr, uLuzReposo, uPenumbra;\n' +
      'vec3 penumbra(vec3 col, float vivo, float piso) {\n' +
      '  float l = dot(col, vec3(0.3, 0.59, 0.11));\n' +
      '  return mix(vec3(l), col, mix(1.0, mix(piso, 1.0, vivo), uPenumbra));\n' +
      '}\n' +
      'float ritmo(vec3 p, float fase, float act, float brasa, float k, inout vec3 col, out float tam) {\n' +
      '  float ola = 0.5 + 0.5 * sin(dot(p, uDirOnda) - uTr * 0.00104720);\n' +
      '  float sOla = (ola * ola - 0.375) * 1.6;\n' +
      '  float post = smoothstep(-0.35, 0.85, (p.x - uCx) / uR);\n' +
      '  float sAlfa = 0.6 * sin(uTr * 0.00125664) + 0.4 * post * sin(uTr * 0.00628319 - p.x / uR * 1.2);\n' +
      '  float chis = fract(sin(fase * 12.9898 + mod(floor(uTr / 50.0), 1200.0) * 78.233) * 43758.5453);\n' +
      '  float vivo = min(act, 1.0);\n' +
      '  float luz = min(act + brasa, 1.0);\n' +
      '  float rap = uRitmo.z * vivo;\n' +
      '  float sTw = sin(uTr * 0.00157080 + fase);\n' +
      '  float m = 1.0 + (2.0 * k - 1.0) * 0.43 * (1.0 - 0.55 * uRitmo.x - 0.35 * uRitmo.y) * sTw + k * (0.55 * uRitmo.x * sOla + 0.3 * uRitmo.y * sAlfa + 0.6 * rap * (pow(chis, 4.0) * 5.0 - 1.0));\n' +
      '  float l = dot(col, vec3(0.3, 0.59, 0.11));\n' +
      '  vec3 azul = mix(vec3(0.16, 0.26, 0.7) * (0.55 + 0.6 * l), vec3(0.34, 0.47, 1.0) * (l * 1.35 + 0.2), uNoche);\n' +
      '  col = mix(col, azul, uRitmo.w * 0.6 * (1.0 - luz) * min(1.0, k * 1.6));\n' +
      '  col = mix(col, mix(vec3(0.3, 0.38, 0.9), vec3(0.7, 0.78, 1.0), uNoche), uRitmo.w * 0.22 * k * ola * ola);\n' +
      '  tam = 1.0 + 0.3 * uRitmo.x * ola + 0.6 * rap * pow(chis, 4.0);\n' +
      '  return max(0.0, m) * mix(uLuzReposo, 1.0, luz);\n' +
      '}\n';
    const UNIF_RITMO = ['uRitmo', 'uDirOnda', 'uTr', 'uLuzReposo', 'uPenumbra'];
    const FOCO = 'uniform float uFocoProf, uDof;\n' +
      'float borroso(float prof) {\n' +
      '  if (uDof <= 0.0) return 0.0;\n' +
      '  float d = (prof * 2.0 - 1.0) * uR;\n' +
      '  return uDof * clamp((abs(d - uFocoProf) / uR - 0.08) * 1.9, 0.0, 1.0);\n' +
      '}\n';
    const UNIF_FOCO = ['uFocoProf', 'uDof'];
    try {
      const puntos = programa(
        'attribute vec3 aPos; attribute vec4 aCol; attribute vec2 aExtra; attribute vec4 aInicio; attribute vec4 aNorm;\n' +
        'uniform float uDpr, uIntro, uPeso; uniform vec2 uFases; uniform vec3 uLuzDir; uniform vec4 uNido;\n' +
        'varying vec4 vCol; varying float vCoc;\n' + COMUN + ACTIVIDAD + RITMO + FOCO +
        'void main() {\n' +
        '  float f; float prof; float tam;\n' +
        '  float qi = clamp((uIntro - aInicio.w) / ' + INTRO.vuelo.toFixed(1) + ', 0.0, 1.0);\n' +
        '  float ei = 1.0 - pow(1.0 - qi, 3.0);\n' +
        '  vec3 col = aCol.rgb;\n' +
        '  float act = actividad(aPos, col);\n' +
        '  vec3 emp = gesto(aPos, 1.0, col, act);\n' +
        '  float br = brasas(aPos, col);\n' +
        '  float vivo = min(act + br, 1.0);\n' +
        '  float actB = act + 0.5 * br;\n' +
        '  float tw = 0.7 * ritmo(aPos, aExtra.y, act, br, 1.0, col, tam);\n' +
        '  col = penumbra(col, vivo, 0.72);\n' +
        '  vec3 nv = girar(aNorm.xyz);\n' +
        '  float borde = pow(1.0 - min(1.0, abs(nv.z)), 2.2);\n' +
        '  float vol = mix(0.9, 0.5 + 0.7 * max(0.0, dot(nv, uLuzDir)) + 1.0 * borde, aNorm.w);\n' +
        '  col = mix(col, mix(col * 0.5, vec3(0.78, 0.93, 1.0), uNoche), borde * aNorm.w * 0.45);\n' +
        '  vec3 pos = mix(aInicio.xyz, aPos, ei);\n' +
        '  if (ei < 1.0) {\n' +
        '    float ar = (1.0 - ei) * uNido.w;\n' +
        '    vec3 dn = pos - uNido.xyz;\n' +
        '    pos = uNido.xyz + vec3(dn.x * cos(ar) - dn.z * sin(ar), dn.y, dn.x * sin(ar) + dn.z * cos(ar));\n' +
        '  }\n' +
        '  pos += emp + vec3(sin(uFases.x + aExtra.y * 7.0), cos(uFases.y + aExtra.y * 5.0), 0.0) * act * 3.0;\n' +
        '  gl_Position = proyectar(pos, f, prof);\n' +
        '  col = niebla(col, prof);\n' +
        '  float base = clamp(aExtra.x * 4.4 * f * uK * uDpr * (1.0 + 0.9 * actB) * tam * (1.0 + 0.8 * (1.0 - ei)), 1.5, 64.0);\n' +
        '  vCoc = borroso(prof);\n' +
        '  float lado = max(base, min(base * (1.0 + 1.6 * vCoc), 24.0 * uDpr));\n' +
        '  gl_PointSize = lado;\n' +
        '  vCol = vec4(col, aCol.a * mix(0.22, 1.0, prof) * tw * uLuz * vol * (1.0 + 2.2 * actB) * smoothstep(0.0, 0.15, qi) * (uPeso > 0.0 ? mix(uPeso, 1.0, vivo) : 1.0) * pow(base / lado, 1.6));\n' +
        '}\n',
        'precision mediump float;\n' +
        'varying vec4 vCol; varying float vCoc;\n' +
        'void main() {\n' +
        '  float r = length(gl_PointCoord - 0.5) * 2.0;\n' +
        '  if (r > 1.0) discard;\n' +
        '  float nucleo = smoothstep(1.0, 0.15, r) * 0.45 + smoothstep(0.42, 0.0, r) * 0.8;\n' +
        '  float disco = (0.62 + 0.3 * smoothstep(0.55, 0.92, r)) * smoothstep(1.0, 0.88, r) * 0.32;\n' +
        '  float a = vCol.a * mix(nucleo, disco, vCoc);\n' +
        '  gl_FragColor = vec4(vCol.rgb * a, a);\n' +
        '}\n', UNIF.concat(['uFases', 'uDpr', 'uIntro', 'uPeso', 'uLuzDir', 'uNido'], UNIF_ACT, UNIF_RITMO, UNIF_FOCO));
      const lineas = programa(
        'attribute vec3 aPos; attribute vec4 aCol;\n' +
        'uniform vec4 uFrente;\n' +
        'varying vec4 vCol;\n' + COMUN + ACTIVIDAD + RITMO + FOCO +
        'void main() {\n' +
        '  float f; float prof; float tam;\n' +
        '  float fr = clamp((uFrente.w - length(aPos - uFrente.xyz)) / (uR * 0.12), 0.0, 1.0);\n' +
        '  vec3 col = aCol.rgb;\n' +
        '  float act = actividad(aPos, col);\n' +
        '  vec3 emp = gesto(aPos, 0.35, col, act);\n' +
        '  float br = brasas(aPos, col);\n' +
        '  float r = ritmo(aPos, fract(dot(aPos, vec3(0.0131, 0.0217, 0.0173))) * 6.2832, act, br, 0.5, col, tam);\n' +
        '  col = penumbra(col, min(act + br, 1.0), 0.6);\n' +
        '  gl_Position = proyectar(aPos + emp, f, prof);\n' +
        '  vCol = vec4(niebla(col, prof), min(1.0, aCol.a * (1.0 + 3.0 * (act + 0.5 * br))) * mix(0.15, 1.0, prof) * uLuz * r * (1.0 - 0.45 * borroso(prof)) * fr * (1.0 + 2.5 * fr * (1.0 - fr)));\n' +
        '}\n',
        'precision mediump float;\n' +
        'varying vec4 vCol;\n' +
        'void main() { gl_FragColor = vec4(vCol.rgb * vCol.a, vCol.a); }\n', UNIF.concat(['uFrente'], UNIF_ACT, UNIF_RITMO, UNIF_FOCO));
      let motas = null;
      try {
        motas = programa(
          'attribute vec3 aPos; attribute vec2 aExtra;\n' +
          'uniform float uDpr, uMotas;\n' +
          'varying float vA;\n' + COMUN +
          'void main() {\n' +
          '  float f; float prof;\n' +
          '  gl_Position = proyectar(aPos, f, prof);\n' +
          '  float D = -(aPos.x - uCx) * sin(uAng) + aPos.z * cos(uAng);\n' +
          '  float D2 = (aPos.y - uCy) * sin(uTilt) + D * cos(uTilt);\n' +
          '  vA = aExtra.y * uMotas * smoothstep(uR * 1.05, uR * 1.4, D2);\n' +
          '  if (vA <= 0.0) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);\n' +
          '  gl_PointSize = clamp(aExtra.x * f * sqrt(uK) * uDpr, 2.0, 64.0);\n' +
          '}\n',
          'precision mediump float;\n' +
          'uniform vec3 uColMota;\n' +
          'varying float vA;\n' +
          'void main() {\n' +
          '  float r = length(gl_PointCoord - 0.5) * 2.0;\n' +
          '  if (r > 1.0) discard;\n' +
          '  float a = vA * (0.75 + 0.25 * smoothstep(0.6, 0.92, r)) * smoothstep(1.0, 0.86, r);\n' +
          '  gl_FragColor = vec4(uColMota * a, a);\n' +
          '}\n', UNIF.concat(['uDpr', 'uMotas', 'uColMota']));
      } catch (e) {
        console.warn('Neuromapa: sin motas de primer plano', e);
        motas = null;
      }
      const fondo = programa(
        'attribute vec3 aPos;\n' +
        'void main() { gl_Position = vec4(aPos.xy, 0.0, 1.0); }\n',
        PRECISION_ALTA +
        'uniform vec2 uRes, uCentro;\n' +
        'uniform float uRadio, uGiro, uTilt, uFase, uDeriva, uNoche, uVela;\n' +
        'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\n' +
        'float ruido(vec2 p) {\n' +
        '  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);\n' +
        '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);\n' +
        '}\n' +
        'float fbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 4; i++) { v += a * ruido(p); p *= 2.07; a *= 0.5; } return v; }\n' +
        'void main() {\n' +
        '  vec2 px = gl_FragCoord.xy;\n' +
        '  vec2 uv = px / uRes.y;\n' +
        '  vec3 col = vec3(0.0);\n' +
        '  if (uNoche > 0.5) {\n' +
        '    for (int capa = 0; capa < 2; capa++) {\n' +
        '      float esc = capa == 0 ? 70.0 : 130.0;\n' +
        '      vec2 sp = uv * esc + vec2(uGiro, uTilt) * (capa == 0 ? 7.0 : 3.0);\n' +
        '      vec2 celda = floor(sp);\n' +
        '      float h = hash(celda + float(capa) * 17.0);\n' +
        '      if (h > 0.955) {\n' +
        '        vec2 c = celda + vec2(hash(celda + 3.1), hash(celda + 7.7));\n' +
        '        float d = length(sp - c);\n' +
        '        float tw = 0.55 + 0.45 * sin(uFase + h * 91.0);\n' +
        '        col += vec3(0.85, 0.9, 1.0) * smoothstep(0.16, 0.0, d) * tw * (capa == 0 ? 0.95 : 0.5);\n' +
        '      }\n' +
        '    }\n' +
        '  }\n' +
        '  vec2 np = uv * 1.8 + vec2(uGiro * 0.18, uDeriva + uTilt * 0.18);\n' +
        '  float n = fbm(np + 0.6 * fbm(np * 1.6 + 4.0));\n' +
        '  vec3 neb = mix(vec3(0.16, 0.12, 0.42), vec3(0.05, 0.28, 0.45), smoothstep(0.35, 0.75, fbm(np * 0.7 + 9.0)));\n' +
        '  col += neb * pow(n, 2.4) * (uNoche > 0.5 ? 0.9 : 0.35);\n' +
        '  float dc = length(px - uCentro) / uRadio;\n' +
        '  col += vec3(0.42, 0.36, 0.95) * exp(-dc * dc * 1.4) * (uNoche > 0.5 ? 0.3 : 0.12);\n' +
        '  float a = clamp(max(max(col.r, col.g), col.b), 0.0, 1.0);\n' +
        '  gl_FragColor = vec4(col, a) * uVela;\n' +
        '}\n', ['uRes', 'uCentro', 'uRadio', 'uGiro', 'uTilt', 'uFase', 'uDeriva', 'uNoche', 'uVela']);
      fondo.buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, fondo.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), gl.STATIC_DRAW);
      return { gl, cv, puntos, lineas, fondo, motas, listo, brillo: prepararResplandor(gl, programa), focos: focosGL,
               vFoco: bufFoco.subarray(0, focosGL * 4), vFocoCol: bufFocoCol.subarray(0, focosGL * 4) };
    } catch (e) {
      console.warn('Neuromapa: sin WebGL para las neuronas', e);
      return null;
    }
  }

