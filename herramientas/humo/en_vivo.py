from humo.base import *


def momento(anio, mes, dia, hora, minuto):
    return time.mktime((anio, mes, dia, hora, minuto, 0, 0, 0, -1))


def renglon_evento(t_evento, fase, herramienta, tipo, ruta, **extra):
    evento = dict({"t": t_evento, "s": "regis001", "e": fase, "h": herramienta, "k": tipo, "f": ruta}, **extra)
    return (f"{json.dumps(evento, ensure_ascii=False)}\r\n").encode("utf-8")


def revisar_registros(t):
    seccion("Registros viejos (resumen por día y compresión)")
    en_vivo = t / "en-vivo"
    ana = str(t / "memoria" / "perfil-ana.md")
    regla = str(t / "memoria" / "regla-sin-comentarios.md")
    login = str(t / "memoria" / "arreglo-login.md")
    ahora = time.time()
    viejo1 = en_vivo / "eventos-20260101-120000.jsonl"
    viejo2 = en_vivo / "eventos-20260102-120000.jsonl"
    reciente = en_vivo / (f'eventos-{time.strftime("%Y%m%d-%H%M%S", time.localtime(ahora - 3600))}.jsonl')
    contenido = {
        viejo1: (renglon_evento(momento(2026, 1, 1, 10, 0), "pre", "Read", "leer", ana)
                 + renglon_evento(momento(2026, 1, 1, 10, 0), "post", "Read", "leer", ana)
                 + renglon_evento(momento(2026, 1, 1, 10, 5), "post", "Read", "leer", ana)
                 + renglon_evento(momento(2026, 1, 1, 10, 9), "post", "Grep", "buscar", ana, p=SECRETO)
                 + renglon_evento(momento(2026, 1, 1, 10, 10), "post", "Edit", "editar", login)),
        viejo2: renglon_evento(momento(2026, 1, 2, 9, 0), "post", "Read", "leer", ana),
        reciente: renglon_evento(ahora - 3700, "post", "Read", "leer", regla),
    }
    for archivo, crudo in contenido.items():
        archivo.write_bytes(crudo)
    vivo = (en_vivo / "eventos.jsonl").read_bytes()
    pocos, todos = servidor.archivos_historia(-1e9, 0), servidor.archivos_historia(ahora - 7200, ahora + 60)
    probar("la historia de un momento muy viejo no abre todos los registros (antes, /historia?hasta=0 los cargaba todos)",
           len(pocos) <= 1 and servidor.REGISTRO not in pocos and servidor.REGISTRO in todos,
           ([p.name for p in pocos], len(todos)))
    seguro = servidor.evento_seguro({"t": 100, "s": "aaaa1111", "e": "falla", "k": "ejecutar", "b": "python", "d": 1234,
                                     "xc": 2, "x": [0, 0], "bg": "sí", "nr": 1, "cmd": "secreto"})
    probar("la historia del día deja pasar la familia, la duración y el código de salida de un comando (números), y nada "
           "que no esté en su lista", seguro == {"t": 100, "s": "aaaa1111", "e": "falla", "k": "ejecutar", "b": "python",
                                                  "x": [0, 0], "d": 1234, "xc": 2, "nr": 1}, seguro)
    pista = {"t": 100, "s": "aaaa1111", "e": "aviso", "k": "aviso", "fs": [login, ana]}
    historia = [servidor.evento_seguro(dict(pista, fp=fp)).get("fp") for fp in
                ([["p", 3, 9, ""], ["a", 1, 4, login]], [["p", 3, 9, ""]], [["p", 3, 9, ""], ["x", 1, 4, ""]],
                 [["p", 3, 9, ""], ["i", 1, "4", ""]], [["p", 3, 9, ""], ["i", 1, 4, "https://x.invalid/a"]])]
    probar("la historia del día deja pasar por qué eligió la pista cada nota solo si viene alineado con sus rutas y con "
           "códigos, números y rutas válidos", historia == [[["p", 3, 9, ""], ["a", 1, 4, login]], None, None, None, None],
           historia)
    origenes = [servidor.evento_seguro({"t": 100, "s": "codex1a2b", "e": "post", "k": "consulta", "o": o}).get("o")
                for o in ("app", "codex", "otra")]
    probar("la historia del día deja pasar el origen de una charla del conector (la app de Claude o Codex) y nada más",
           origenes == ["app", "codex", None], origenes)
    marcas = [servidor.evento_seguro(dict(pista, sa=sa)).get("sa") for sa in (1, 7, "1")]
    probar("la historia del día deja pasar la marca del modo de comparación solo como 0 o 1", marcas == [1, None, None],
           marcas)
    guardas = [servidor.evento_seguro({"t": 100, "s": "aaaa1111", "e": "guarda", "k": "guarda", "p": p, "n": n})
               for p, n in (("fin", 6), ("compact", 0), ("borrar", "6"))]
    probar("la historia del día deja pasar el recordatorio de guardar con su motivo y su cuenta, y nada raro",
           guardas == [{"t": 100, "s": "aaaa1111", "e": "guarda", "k": "guarda", "p": "fin", "n": 6},
                       {"t": 100, "s": "aaaa1111", "e": "guarda", "k": "guarda", "p": "compact"},
                       {"t": 100, "s": "aaaa1111", "e": "guarda", "k": "guarda"}], guardas)
    dias_antes = servidor.cerebro.CONFIG["borrar_registros_dias"]
    servidor.cerebro.CONFIG["borrar_registros_dias"] = 0

    hecho = servidor.ordenar_registros(ahora)
    probar("resume los 3 registros rotados", hecho is not None and hecho["nuevos"] == 3, hecho and hecho["nuevos"])
    probar("comprime solo los 2 de más de 30 días", hecho is not None and hecho["comprimidos"] == 2,
           hecho and hecho["comprimidos"])
    iguales = all(not a.exists() and a.with_name(f"{a.name}.gz").exists()
                  and gzip.decompress(a.with_name(f"{a.name}.gz").read_bytes()) == contenido[a] for a in (viejo1, viejo2))
    probar("cada comprimido es idéntico al original, y el original ya no está", iguales)
    probar("el reciente queda sin comprimir", reciente.exists() and not reciente.with_name(f"{reciente.name}.gz").exists())
    probar("el registro en vivo no se toca", (en_vivo / "eventos.jsonl").read_bytes() == vivo)
    texto = (en_vivo / servidor.RESUMEN).read_text(encoding="utf-8")
    resumen = json.loads(texto)
    clave_ana = ana.replace("\\", "/").lower()
    enero = resumen["archivos"][viejo1.name]["dias"]["2026-01-01"]["notas"]
    probar("el resumen cuenta por día lo mismo que el mapa de calor",
           enero[clave_ana]["leer"] == 2 and enero[clave_ana]["buscar"] == 1
           and enero[login.replace("\\", "/").lower()]["editar"] == 1, enero.get(clave_ana))
    probar("el resumen no guarda textos, solo cuentas", SECRETO not in texto)
    otra = servidor.ordenar_registros(ahora)
    probar("una segunda pasada no hace nada",
           otra is not None and otra["nuevos"] == 0 and otra["comprimidos"] == 0
           and (en_vivo / servidor.RESUMEN).read_text(encoding="utf-8") == texto,
           otra and (otra["nuevos"], otra["comprimidos"]))

    servidor.uso = servidor.Uso()
    lector = servidor.Lector()
    lector.cargar_historial()
    sumados = servidor.sumar_resumenes(hecho["resumen"], lector.leidos)
    cuentas = servidor.uso.cuentas
    probar("al arrancar, suma los 2 resúmenes que no carga enteros", sumados == 2, sumados)
    probar("el mapa de calor cuenta la historia comprimida (3 lecturas de perfil-ana)",
           cuentas.get(clave_ana, {}).get("leer") == 3, cuentas.get(clave_ana))
    clave_regla = regla.replace("\\", "/").lower()
    probar("y no cuenta dos veces el rotado que sí carga entero",
           cuentas.get(clave_regla, {}).get("leer") == 1, cuentas.get(clave_regla))
    probar("«desde» retrocede al 1 de enero", servidor.uso.desde == momento(2026, 1, 1, 10, 0), servidor.uso.desde)
    probar("ningún registro queda «sin leer»", servidor.uso.rotados == {"leidos": 1, "resumidos": 2, "sinLeer": 0},
           servidor.uso.rotados)
    servidor.cerebro.CONFIG["borrar_registros_dias"] = 90
    try:
        borrado = servidor.ordenar_registros(ahora)
    finally:
        servidor.cerebro.CONFIG["borrar_registros_dias"] = dias_antes
    quedan = sorted(p.name for p in en_vivo.glob("eventos-*"))
    sigue = json.loads((en_vivo / servidor.RESUMEN).read_text(encoding="utf-8"))["archivos"]
    probar("con borrar_registros_dias = 90, borra los rotados viejos ya resumidos, "
           "deja el reciente y el resumen del día queda",
           borrado is not None and borrado["borrados"] == 2 and quedan == [reciente.name]
           and sigue[viejo1.name]["dias"]["2026-01-01"]["notas"][clave_ana]["leer"] == 2,
           (borrado and borrado["borrados"], quedan))
    sin_servidor = [en_vivo / "eventos-20250101-120000.jsonl", en_vivo / "eventos-20250102-120000-1.jsonl.gz"]
    sin_servidor[0].write_bytes(renglon_evento(momento(2025, 1, 1, 9, 0), "post", "Read", "leer", login))
    sin_servidor[1].write_bytes(gzip.compress(renglon_evento(momento(2025, 1, 2, 9, 0), "post", "Read", "leer", login)))
    servidor.cerebro.CONFIG["borrar_registros_dias"] = 90
    try:
        podados = hook_evento.podar(ahora)
    finally:
        servidor.cerebro.CONFIG["borrar_registros_dias"] = dias_antes
    resumidos = json.loads((en_vivo / servidor.RESUMEN).read_text(encoding="utf-8"))["archivos"]
    probar("aunque el mapa no se abra nunca, el hook borra al rotar los registros de más de 90 días (y deja los recientes), "
           "pero antes los resume: el resumen de esos días queda (antes se perdía)",
           podados == 2 and not any(a.exists() for a in sin_servidor) and reciente.exists()
           and "eventos-20250101-120000.jsonl" in resumidos and "eventos-20250102-120000-1.jsonl" in resumidos,
           (podados, sorted(p.name for p in en_vivo.glob("eventos-*")), sorted(resumidos)))
    activo = Path(hook_evento.REGISTRO)
    guardado = activo.read_bytes()
    antes = set(en_vivo.glob("eventos-*"))
    try:
        vueltas = []
        for dias in (6, 8):
            activo.write_bytes(renglon_evento(ahora - dias * 86400, "post", "Read", "leer", ana)
                               + renglon_evento(ahora - 3600, "post", "Read", "leer", regla))
            hook_evento.rotar(ahora)
            nuevos = set(en_vivo.glob("eventos-*")) - antes
            vueltas.append((dias, activo.exists(), sorted(p.name for p in nuevos)))
            for p in nuevos:
                p.unlink()
    finally:
        activo.write_bytes(guardado)
    probar("el registro activo también se rota cuando su primer evento tiene más de una semana (antes solo al pasar de "
           "5 MB: con poco uso, lo de más de 90 días no se borraba nunca)",
           vueltas[0][1:] == (True, []) and not vueltas[1][1] and len(vueltas[1][2]) == 1, vueltas)


def pedir(puerto, camino, host=None, metodo="GET", cabeceras=None, respuesta_entera=False):
    conexion = http.client.HTTPConnection("127.0.0.1", puerto, timeout=10)
    try:
        todas = {"Host": host or f"127.0.0.1:{puerto}", "X-Cerebro-Clave": servidor.clave()}
        todas.update(cabeceras or {})
        conexion.request(metodo, camino, headers={k: v for k, v in todas.items() if v is not None})
        respuesta = conexion.getresponse()
        if respuesta_entera:
            return respuesta.status, respuesta.read(), dict(respuesta.getheaders())
        return respuesta.status, respuesta.read(), respuesta.getheader("Cache-Control")
    finally:
        conexion.close()


def primer_trozo_sse(puerto, lineas=2):
    conexion = http.client.HTTPConnection("127.0.0.1", puerto, timeout=5)
    try:
        conexion.request("GET", "/eventos", headers={"Host": f"127.0.0.1:{puerto}", "X-Cerebro-Clave": servidor.clave()})
        respuesta = conexion.getresponse()
        return respuesta.status, b"".join(respuesta.fp.readline() for _ in range(lineas))
    except OSError as error:
        return None, str(error).encode()
    finally:
        conexion.close()


def revisar_servidor(t):
    seccion("Servidor (en la carpeta de prueba, puerto libre)")
    pagina = t / "cerebro.html"
    pagina.unlink(missing_ok=True)
    probar("generar() rearma la página junto al config (el cerebro.py que lanza recibe el mismo config)",
           servidor.generar() and pagina.is_file() and "window.CEREBRO = " in pagina.read_text(encoding="utf-8"))
    servidor.armar_indice()
    probar("arma el índice de búsqueda con las notas inventadas",
           servidor.indice["actual"] is not None and len(servidor.indice["actual"].notas) == 8)
    preguntar_nombre = socket.getfqdn
    preguntas = []
    socket.getfqdn = lambda *a: preguntas.append(a) or "lento.invalid"
    try:
        web = servidor.Servidor(("127.0.0.1", 0), servidor.Manejador)
    finally:
        socket.getfqdn = preguntar_nombre
    probar("abrir el servidor no le pregunta a la red el nombre de la máquina (en las Mac de GitHub tardaba ~35 s cada "
           "arranque)", not preguntas and web.server_name == "127.0.0.1", (preguntas, web.server_name))
    puerto = web.server_address[1]
    hilo = threading.Thread(target=web.serve_forever, daemon=True)
    hilo.start()
    try:
        estado, cuerpo, cache = pedir(puerto, "/cerebro.html")
        probar("/cerebro.html da 200 con los datos y sin caché",
               estado == 200 and b"window.CEREBRO = " in cuerpo and cache == "no-store", (estado, cache))
        estado, _, _ = pedir(puerto, "/cerebro.html", metodo="HEAD")
        probar("HEAD /cerebro.html da 200", estado == 200, estado)
        estado, _, _ = pedir(puerto, "/")
        probar("/ lleva a /cerebro.html (302)", estado == 302, estado)
        estado, cuerpo, _ = pedir(puerto, "/buscar?q=login")
        datos = json.loads(cuerpo) if estado == 200 else {}
        probar("/buscar responde con notas", estado == 200 and datos.get("listo") and datos.get("resultados"), estado)
        estado, cuerpo, _ = pedir(puerto, "/sobre?q=" + "fase%200")
        datos = json.loads(cuerpo) if estado == 200 else {}
        primero = (datos.get("leerPrimero") or [{}])[0]
        probar("/sobre manda al plan", estado == 200 and Path(primero.get("ruta", "")).name == "PLAN-DEMO.md", estado)
        estado, cuerpo, _ = pedir(puerto, "/uso.json")
        probar("/uso.json da 200 y es JSON", estado == 200 and isinstance(json.loads(cuerpo), dict), estado)
        estado, cuerpo, _ = pedir(puerto, "/historia")
        datos = json.loads(cuerpo) if estado == 200 else {}
        texto = cuerpo.decode("utf-8", "replace")
        probar("/historia da 200, sin eventos pre ni secretos",
               estado == 200 and '"e":"pre"' not in texto and SECRETO not in texto, (estado, texto[:200]))
        estado, _, _ = pedir(puerto, "/historia?modo=minuto")
        probar("/historia?modo=minuto da 200", estado == 200, estado)
        estado, trozo = primer_trozo_sse(puerto)
        probar("/eventos abre el canal en vivo con «previos»", estado == 200 and b"event: previos" in trozo,
               (estado, trozo[:120]))
        antes = dict(servidor.aprendizaje)
        servidor.aprendizaje.update(firma=1, datos={"semana": {"pedidos": 3}, "pares": []})
        try:
            estado, trozo = primer_trozo_sse(puerto, 5)
        finally:
            servidor.aprendizaje.update(antes)
        probar("al conectarse, la página recibe también lo último que aprendió (y después cada vez que cambia)",
               estado == 200 and b"event: aprendido" in trozo and b'"pedidos": 3' in trozo, (estado, trozo[-160:]))
        probar("el servidor arma lo aprendido para la página con su índice, sin fallar",
               servidor.datos_aprendidos() is None or isinstance(servidor.datos_aprendidos(), dict))
        estado, _, _ = pedir(puerto, "/cerebro.html", host=f"evil.example:{puerto}")
        probar("un Host ajeno da 403 (defensa contra DNS rebinding)", estado == 403, estado)
        sin = {"X-Cerebro-Clave": None}
        faltan = [c for c in ("/cerebro.html", "/sobre?q=login", "/uso.json", "/historia", "/eventos")
                  if pedir(puerto, c, cabeceras=sin)[0] != 403]
        probar("sin la clave, la página y todo lo demás dan 403", not faltan, faltan)
        estado, _, _ = pedir(puerto, "/cerebro.html", cabeceras={"X-Cerebro-Clave": "otra-clave-cualquiera-de-prueba"})
        probar("con una clave equivocada, 403", estado == 403, estado)
        estado, _, cabeza = pedir(puerto, f"/cerebro.html?clave={servidor.clave()}", cabeceras=sin, respuesta_entera=True)
        galleta = cabeza.get("Set-Cookie", "")
        probar("con ?clave= deja una galleta propia (HttpOnly, SameSite=Strict) que no es la clave, y lleva a /cerebro.html "
               "sin la clave a la vista (antes la galleta guardaba la clave misma)",
               estado == 302 and cabeza.get("Location") == "/cerebro.html" and "HttpOnly" in galleta
               and "SameSite=Strict" in galleta and servidor.valor_galleta() in galleta and servidor.clave() not in galleta,
               (estado, cabeza.get("Location"), galleta[:80]))
        _, _, con_opciones = pedir(puerto, f"/cerebro.html?anonimo&clave={servidor.clave()}&cine&x=<b>", cabeceras=sin,
                                   respuesta_entera=True)
        _, _, desde_raiz = pedir(puerto, "/?anonimo", respuesta_entera=True)
        probar("con ?clave= y otras opciones (anonimo, cine), la página abre con ellas y sin la clave; desde «/» también "
               "(antes se perdía el modo anónimo)",
               con_opciones.get("Location") == "/cerebro.html?anonimo&cine"
               and desde_raiz.get("Location") == "/cerebro.html?anonimo",
               (con_opciones.get("Location"), desde_raiz.get("Location")))
        propia = f"{servidor.nombre_galleta(puerto)}={servidor.clave()}"
        estado, cuerpo, _ = pedir(puerto, "/cerebro.html", cabeceras={"X-Cerebro-Clave": None, "Cookie": propia})
        probar("con la galleta, la página da 200", estado == 200 and b"window.CEREBRO = " in cuerpo, estado)
        _, _, renovada = pedir(puerto, "/cerebro.html", cabeceras={"X-Cerebro-Clave": None, "Cookie": propia},
                               respuesta_entera=True)
        nueva = f"{servidor.nombre_galleta(puerto)}={servidor.valor_galleta()}"
        estado_nueva, _, _ = pedir(puerto, "/cerebro.html", cabeceras={"X-Cerebro-Clave": None, "Cookie": nueva})
        probar("la galleta vieja (que era la clave) sigue sirviendo y se cambia por la nueva, que también abre la página",
               servidor.valor_galleta() in renovada.get("Set-Cookie", "") and estado_nueva == 200,
               (renovada.get("Set-Cookie", "")[:60], estado_nueva))
        numero = servidor.nueva_entrada()
        estado, _, cabeza = pedir(puerto, f"/cerebro.html?entrada={numero}&anonimo", cabeceras=sin, respuesta_entera=True)
        estado_otra, _, _ = pedir(puerto, f"/cerebro.html?entrada={numero}", cabeceras=sin)
        vencido = servidor.nueva_entrada(time.monotonic() - servidor.VIDA_ENTRADA - 1)
        estado_vencido, _, _ = pedir(puerto, f"/cerebro.html?entrada={vencido}", cabeceras=sin)
        probar("el navegador entra con un número de un solo uso que vence en un minuto, no con la clave: la clave ya no "
               "queda en el historial del navegador (S7)",
               estado == 302 and cabeza.get("Location") == "/cerebro.html?anonimo"
               and servidor.valor_galleta() in cabeza.get("Set-Cookie", "") and estado_otra == 403
               and estado_vencido == 403, (estado, cabeza.get("Location"), estado_otra, estado_vencido))
        estado_sin_firma, _, _ = pedir(puerto, "/entrada", cabeceras=sin)
        pedido = servidor.pedir_entrada(puerto)
        estado_pedido, _, _ = pedir(puerto, f"/cerebro.html?entrada={pedido}", cabeceras=sin)
        abrir = servidor.direccion_para_abrir(puerto, propia=True)
        probar("otra ventana pide el número al mapa prendido con un pedido firmado (sin firma, 403), y la dirección que se "
               "abre en el navegador nunca lleva la clave",
               estado_sin_firma == 403 and pedido and estado_pedido == 302 and "?entrada=" in abrir
               and servidor.clave() not in abrir, (estado_sin_firma, bool(pedido), estado_pedido, abrir[-40:]))
        _, _, cabezas = pedir(puerto, "/cerebro.html", respuesta_entera=True)
        politica = cabezas.get("Content-Security-Policy", "")
        probar("las respuestas llevan política de seguridad (sin objetos, sin marcos, conexiones solo al mismo servidor) "
               "y nosniff",
               "object-src 'none'" in politica and "frame-ancestors 'none'" in politica and "connect-src 'self'" in politica
               and cabezas.get("X-Content-Type-Options") == "nosniff",
               (politica[:120], cabezas.get("X-Content-Type-Options")))
        _, pagina, de_pagina = pedir(puerto, "/cerebro.html", respuesta_entera=True)
        _, otra_pagina, otras_cabezas = pedir(puerto, "/cerebro.html", respuesta_entera=True)
        _, _, de_json = pedir(puerto, "/uso.json", respuesta_entera=True)
        scripts = re.search(r"script-src ([^;]*)", de_pagina.get("Content-Security-Policy", ""))
        nonce = re.search(r"'nonce-([\w-]{16,})'", scripts.group(1) if scripts else "")
        etiquetas = re.findall(rb"(?m)^<script[^>]*>", pagina)
        probar("la página solo corre sus propios scripts: un nonce nuevo en cada respuesta, puesto en cada <script> de la "
               "página, sin 'unsafe-inline' ni el CDN; y lo que no es la página no corre ninguno",
               nonce is not None and "unsafe-inline" not in scripts.group(1)
               and "jsdelivr" not in de_pagina.get("Content-Security-Policy", "")
               and len(etiquetas) >= 3 and set(etiquetas) == {f'<script nonce="{nonce.group(1)}">'.encode("ascii")}
               and nonce.group(1) not in otras_cabezas.get("Content-Security-Policy", "")
               and f'nonce="{nonce.group(1)}"'.encode("ascii") not in otra_pagina
               and "script-src 'none'" in de_json.get("Content-Security-Policy", ""),
               (scripts and scripts.group(1), etiquetas[:4], de_json.get("Content-Security-Policy", "")[:80]))
        otro = f"{servidor.nombre_galleta(puerto + 1)}={servidor.clave()}"
        estado_otro, _, _ = pedir(puerto, "/cerebro.html", cabeceras={"X-Cerebro-Clave": None, "Cookie": otro})
        probar("la galleta lleva el puerto: la de un mapa en otro puerto no entra acá ni lo pisa (dos mapas a la vez)",
               f"{servidor.nombre_galleta(puerto)}=" in galleta and estado_otro == 403, (galleta[:60], estado_otro))
        for camino in ("/en-vivo/eventos.jsonl", "/en-vivo%2Feventos.jsonl", "/servidor.py", "/plantilla.html",
                       "/hechos.json", "/memoria/", "/memoria/perfil-ana.md"):
            estado, _, _ = pedir(puerto, camino)
            probar(f"{camino} da 404", estado == 404, estado)
        estado, cuerpo, _ = pedir(puerto, "/no-existe")
        estado_post, cuerpo_post, _ = pedir(puerto, "/cerebro.html", metodo="POST")
        probar("las páginas de error vienen en castellano (antes, en inglés)",
               estado == 404 and "No hay nada en esa dirección".encode("utf-8") in cuerpo and estado_post == 501
               and "solo atiende".encode("utf-8") in cuerpo_post, (cuerpo[:160], cuerpo_post[:160]))
        cortes, otros = io.StringIO(), io.StringIO()
        for error, destino in ((ConnectionResetError(), cortes), (ConnectionAbortedError(), cortes),
                               (BrokenPipeError(), cortes), (TimeoutError(), cortes), (ValueError("raro"), otros)):
            with contextlib.redirect_stderr(destino):
                try:
                    raise error
                except Exception:
                    servidor.Servidor.handle_error(None, None, ("127.0.0.1", 1))
        probar("cerrar una pestaña no llena la ventana del servidor de errores en inglés; un error de verdad se avisa en "
               "castellano", cortes.getvalue() == "" and otros.getvalue().startswith("Neuromapa: falló un pedido")
               and "ValueError" in otros.getvalue(), (cortes.getvalue()[:200], otros.getvalue()[:200]))
        anotado = servidor.EN_VIVO / "servidor.json"
        anotado.parent.mkdir(parents=True, exist_ok=True)
        anotado.write_text(json.dumps({"puerto": puerto, "pid": os.getpid()}), encoding="utf-8")
        vivo = servidor.ya_prendido()
        import hook_servir
        visitas = []
        espia = socket.socket()
        espia.bind(("127.0.0.1", 0))
        espia.listen(5)
        espia.settimeout(0.5)
        proxy = f"http://127.0.0.1:{espia.getsockname()[1]}"
        antes = {k: os.environ.get(k) for k in ("HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy")}
        os.environ.update(HTTP_PROXY=proxy, http_proxy=proxy)
        os.environ.pop("NO_PROXY", None)
        os.environ.pop("no_proxy", None)
        try:
            respuesta = hook_servir.del_servidor(str(servidor.EN_VIVO.parent), "login")
            try:
                conexion, _ = espia.accept()
                visitas.append(conexion.recv(200))
                conexion.close()
            except OSError:
                pass
        finally:
            espia.close()
            for k, v in antes.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        probar("el contexto automático le pregunta al servidor directo, sin pasar por un proxy "
               "(antes le mandaba el pedido y la clave)",
               respuesta is not None and not visitas, (respuesta is not None, visitas))
        with socket.socket() as libre:
            libre.bind(("127.0.0.1", 0))
            sin_nadie = libre.getsockname()[1]
        anotado.write_text(json.dumps({"puerto": sin_nadie, "pid": 1}), encoding="utf-8")
        muerto = servidor.ya_prendido()
        terminado = subprocess.Popen([sys.executable, "-c", "pass"])
        terminado.wait()
        anotado.write_text(json.dumps({"puerto": puerto, "pid": terminado.pid}), encoding="utf-8")
        ajeno = (servidor.ya_prendido(), hook_servir.del_servidor(str(servidor.EN_VIVO.parent), "login"))
        anotado.unlink()
        probar("abrir desde el plugin reusa el servidor prendido y no se confunde con uno anotado que ya no está",
               vivo == puerto and muerto is None and servidor.ya_prendido() is None, (vivo, puerto, muerto))
        probar("si el proceso anotado ya no existe, nadie le manda la clave a ese puerto (podría ser de otro programa)",
               ajeno == (None, None), ajeno)
        revisar_firmas(puerto, anotado)
    finally:
        web.shutdown()
        web.server_close()
    revisar_apagado()


def revisar_vivo(t):
    seccion("Lo en vivo del servidor (eventos nuevos, notas editadas y registro rotado)")
    registro = servidor.REGISTRO
    registro.parent.mkdir(parents=True, exist_ok=True)
    guardado = registro.read_bytes() if registro.exists() else None
    rotado = registro.with_name("eventos-20991231-235959.jsonl")
    nota = str(t / "memoria" / "perfil-ana.md")
    cola = queue.Queue()
    ordenar = servidor.ordenar_en_fondo

    def recibidos():
        salida = []
        while True:
            try:
                salida.append(cola.get_nowait())
            except queue.Empty:
                return salida

    def escribir(eventos):
        with open(registro, "ab") as f:
            f.write("".join(json.dumps(ev) + "\n" for ev in eventos).encode("utf-8"))

    servidor.ordenar_en_fondo = lambda *a, **k: None
    with servidor.clientes_lock:
        servidor.clientes.append(cola)
    try:
        registro.write_bytes(b"")
        lector = servidor.Lector()
        lector.cargar_historial()
        recibidos()
        servidor.regenerar["en"] = 0.0
        escribir([{"t": 1, "s": "vivo0001", "e": "post", "k": "leer", "f": nota},
                  {"t": 2, "s": "vivo0001", "e": "post", "k": "editar", "f": nota},
                  {"t": 3, "s": "vivo0001", "e": "post", "k": "ejecutar", "b": "git"}])
        lector.revisar()
        llegaron = recibidos()
        probar("los eventos nuevos del registro llegan a la página abierta, y editar una nota pide rearmar la página",
               len(llegaron) == 3 and all(m.startswith(b"event: accion") for m in llegaron)
               and servidor.regenerar["en"] > 0, (len(llegaron), servidor.regenerar["en"]))
        escribir([{"t": 4, "s": "vivo0001", "e": "post", "k": "leer", "f": nota},
                  {"t": 5, "s": "vivo0001", "e": "post", "k": "buscar", "p": "x"}])
        os.replace(registro, rotado)
        registro.write_bytes(b"")
        lector.revisar()
        tras = recibidos()
        probar("si el registro rota justo después de dos eventos, esos dos llegan igual a la página",
               len(tras) == 2 and all(b'"vivo0001"' in m for m in tras), [m[:80] for m in tras])
    finally:
        servidor.ordenar_en_fondo = ordenar
        servidor.regenerar["en"] = 0.0
        with servidor.clientes_lock:
            servidor.clientes.remove(cola)
        rotado.unlink(missing_ok=True)
        if guardado is None:
            registro.unlink(missing_ok=True)
        else:
            registro.write_bytes(guardado)


def revisar_firmas(puerto, anotado):
    import firmas
    import hook_servir
    recibidos = []

    class Impostor(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            recibidos.append((self.path, dict(self.headers)))
            cuerpo = json.dumps({"firma": "0" * 64, "listo": True, "leerPrimero": []}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.end_headers()
            self.wfile.write(cuerpo)

        def log_message(self, *a):
            pass

    impostor = http.server.HTTPServer(("127.0.0.1", 0), Impostor)
    threading.Thread(target=impostor.serve_forever, daemon=True).start()
    try:
        anotado.write_text(json.dumps({"puerto": impostor.server_address[1], "pid": os.getpid()}), encoding="utf-8")
        engaño = (hook_servir.del_servidor(str(servidor.EN_VIVO.parent), "pedido secretisimo"), servidor.ya_prendido())
    finally:
        impostor.shutdown()
        impostor.server_close()
    filtrado = [r for r in recibidos if "secretisimo" in r[0] or servidor.clave() in json.dumps(r[1])
                or not r[0].startswith("/hola?n=")]
    probar("si otro programa ocupa el puerto anotado (el proceso existe pero no es Neuromapa), no recibe el pedido ni la "
           "clave: primero tiene que demostrar que sabe la clave",
           engaño == (None, None) and len(recibidos) == 2 and not filtrado, (engaño, recibidos))
    desafio = firmas.numero()
    estado, cuerpo, _ = pedir(puerto, f"/hola?n={desafio}", cabeceras={"X-Cerebro-Clave": None})
    raro, _, _ = pedir(puerto, "/hola?n=../../x", cabeceras={"X-Cerebro-Clave": None})
    probar("/hola firma el desafío sin pedir la clave, y rechaza uno mal formado",
           estado == 200 and firmas.servidor_valido(servidor.clave(), desafio, json.loads(cuerpo).get("firma"))
           and raro == 400, (estado, raro))
    camino = "/sobre?alcance=foco&q=login"
    bien, _, _ = pedir(puerto, camino, cabeceras={"X-Cerebro-Clave": None,
                                                 "X-Cerebro-Firma": firmas.del_pedido(servidor.clave(), camino)})
    otro, _, _ = pedir(puerto, camino + "x", cabeceras={"X-Cerebro-Clave": None,
                                                       "X-Cerebro-Firma": firmas.del_pedido(servidor.clave(), camino)})
    vieja, _, _ = pedir(puerto, camino, cabeceras={"X-Cerebro-Clave": None, "X-Cerebro-Firma": firmas.del_pedido(
        servidor.clave(), camino, time.time() - 5 * firmas.VIGENCIA)})
    ajena, _, _ = pedir(puerto, camino, cabeceras={"X-Cerebro-Clave": None,
                                                  "X-Cerebro-Firma": firmas.del_pedido("otra-clave", camino)})
    probar("el pedido va firmado en vez de llevar la clave; la firma de otro camino, vieja o de otra clave da 403",
           (bien, otro, vieja, ajena) == (200, 403, 403, 403), (bien, otro, vieja, ajena))
    import aprender
    guardado_aprendido = aprender.en_vivo() / aprender.ARCHIVO
    puesto = not guardado_aprendido.exists()
    if puesto:
        guardado_aprendido.write_text(json.dumps({"version": aprender.VERSION}), encoding="utf-8")
    respuestas = []
    try:
        for c in (camino, camino + "&sin=aprendido"):
            estado_c, cuerpo_c, _ = pedir(puerto, c, cabeceras={"X-Cerebro-Clave": None,
                                                             "X-Cerebro-Firma": firmas.del_pedido(servidor.clave(), c)})
            respuestas.append((estado_c, json.loads(cuerpo_c).get("sinAprendido") if estado_c == 200 else None))
    finally:
        if puesto:
            guardado_aprendido.unlink()
    probar("el servidor arma la pista sin lo aprendido cuando se lo pide el modo de comparación, y lo dice en la respuesta",
           respuestas == [(200, None), (200, True)], respuestas)
    con_clave, _, _ = pedir(puerto, "/apagar")
    con_firma_ajena, _, _ = pedir(puerto, "/apagar", cabeceras={"X-Cerebro-Firma": firmas.del_pedido(servidor.clave(),
                                                                                                    "/sobre")})
    probar("/apagar no se deja con la clave ni con la galleta (una página ajena no puede apagarlo), solo con su firma",
           (con_clave, con_firma_ajena) == (403, 403), (con_clave, con_firma_ajena))
    anotado.write_text(json.dumps({"puerto": puerto, "pid": os.getpid()}), encoding="utf-8")
    servidor.borrar_anotado()
    propio_borrado = not anotado.exists()
    anotado.write_text(json.dumps({"puerto": puerto, "pid": 1}), encoding="utf-8")
    servidor.borrar_anotado()
    probar("al apagarse borra servidor.json, solo si lo anotó él (no el de otro servidor)",
           propio_borrado and anotado.exists())
    anotado.unlink()


def revisar_apagado():
    class Falso:
        def __init__(self):
            self.apagado = threading.Event()

        def shutdown(self):
            self.apagado.set()

    with servidor.clientes_lock:
        guardados = list(servidor.clientes)
        servidor.clientes.clear()
    pestana = queue.Queue()
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            solo = Falso()
            threading.Thread(target=servidor.apagar_sin_pestanas, args=(solo, 0.3, 0.05), daemon=True).start()
            sin_pestanas = solo.apagado.wait(3)
            con = Falso()
            with servidor.clientes_lock:
                servidor.clientes.append(pestana)
            threading.Thread(target=servidor.apagar_sin_pestanas, args=(con, 0.3, 0.05), daemon=True).start()
            siguio = not con.apagado.wait(1)
            with servidor.clientes_lock:
                servidor.clientes.remove(pestana)
            despues = con.apagado.wait(3)
    finally:
        with servidor.clientes_lock:
            servidor.clientes[:] = [q for q in servidor.clientes if q is not pestana] + guardados
    probar("desde el plugin, se apaga solo cuando no queda ninguna pestaña, y no mientras haya una",
           sin_pestanas and siguio and despues, (sin_pestanas, siguio, despues))
