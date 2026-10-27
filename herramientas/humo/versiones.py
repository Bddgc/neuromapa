from humo.base import *


def revisar_historial(t):
    seccion("Historial de la memoria (nada de lo que se borre se pierde)")
    historial = importlib.import_module("historial")
    memoria = t / "memoria"
    nueva = memoria / "historial-prueba.md"
    suelta = memoria / "historial-prueba.txt"
    de_hoy_afuera = t / "ideas" / "zapallar-de-hoy.md"
    dato = "El riego del vivero arranca a las 06:15 en verano"

    def salida_de(funcion, *argumentos):
        texto = io.StringIO()
        with contextlib.redirect_stdout(texto):
            codigo = funcion(*argumentos)
        return codigo, texto.getvalue()

    def escribir(ruta, texto):
        ruta.write_text(texto, encoding="utf-8", newline="\n")

    borrar_carpeta(historial.CARPETA)
    sin_git = historial.hay_git
    historial.hay_git = lambda: False
    try:
        apagado = historial.linea_salud()
        probar("sin git el historial no rompe nada, no crea nada y --salud dice que está apagado y por qué",
               historial.guardar() is False and not historial.CARPETA.exists() and "apagado" in apagado
               and "git" in apagado, apagado)
    finally:
        historial.hay_git = sin_git
    if not historial.hay_git():
        saltear("historial de la memoria: sin git en el PATH, salteado")
        return
    carpeta = str(memoria.resolve())
    antes = sorted(os.listdir(memoria))
    try:
        primera = historial.guardar()
        repo = historial.repo_de(carpeta)
        probar("la primera vez guarda todas las notas de la memoria, en una carpeta aparte (la de la memoria no cambia)",
               primera and (repo / "HEAD").is_file() and adentro(t, repo) and sorted(os.listdir(memoria)) == antes
               and len(historial.versiones(carpeta)) == 1, (primera, repo, os.listdir(memoria)))
        permisos = importlib.import_module("permisos")
        abierta = t / "historial-abierta"
        abierta.mkdir(exist_ok=True)
        if os.name == "nt":
            subprocess.run(["icacls", str(abierta), "/grant", "*S-1-5-11:(OI)(CI)M"], capture_output=True, timeout=60)
        else:
            os.chmod(abierta, 0o777)
        propia, estado_propio = historial.CARPETA, historial.ESTADO
        historial.CARPETA, historial.ESTADO = abierta / "historial", abierta / "historial" / "estado.json"
        try:
            historial.guardar()
            ajenas = permisos.ajenos(historial.CARPETA, leer=True)
        finally:
            historial.CARPETA, historial.ESTADO = propia, estado_propio
        probar("la carpeta del historial (con copia de las notas) nace cerrada aunque la de arriba esté abierta: otras "
               "cuentas de la PC no la leen", bool(permisos.ajenos(abierta)) and ajenas == [], ajenas)
        probar("sin cambios no guarda otra versión", historial.guardar() is False and len(historial.versiones(carpeta)) == 1,
               historial.versiones(carpeta))
        escribir(nueva, f"# Prueba\n\nUna línea.\n{dato}\nOtra línea.\n")
        escribir(suelta, "no es una nota")
        historial.guardar()
        guardados = historial.git(carpeta, "ls-files") or ""
        probar("una nota nueva queda guardada; un archivo que no es .md, no",
               "historial-prueba.md" in guardados and "historial-prueba.txt" not in guardados, guardados)
        escribir(nueva, "# Prueba\n\nUna línea.\nOtra línea.\n")
        (repo / "index.lock").write_text("", encoding="utf-8")
        trabado = historial.guardar()
        (repo / "index.lock").unlink()
        codigo, dicho = salida_de(historial.main, "arranca a las 06:15")
        probar("si otro chat está guardando a la vez, no se traba ni pierde el cambio: lo guarda la próxima vez (acá, "
               "al buscar)", trabado is False and "se borró de historial-prueba.md" in dicho, (trabado, dicho))
        hallados = historial.hallazgos(carpeta, "ARRANCA a las 06:15")
        borrado = next((h for h in hallados if h["borrado"]), {})
        probar("buscando un texto (sin importar mayúsculas) dice cuándo apareció, cuándo se borró y qué renglón era",
               [h["que"] for h in hallados] == ["apareció en historial-prueba.md", "se borró de historial-prueba.md"]
               and borrado.get("renglones") == [f"4: {dato}"], hallados)
        probar("--historial \"texto\" lo cuenta, dice que hoy no está en ninguna nota y cómo ver la versión entera de antes",
               codigo == 0 and "se borró de historial-prueba.md. Lo que decía:" in dicho and dato in dicho
               and "Hoy no está en ninguna nota." in dicho
               and f'show {borrado.get("hash")}^:"historial-prueba.md"' in dicho, dicho)
        probar("la versión de antes se puede leer entera",
               dato in historial.contenido(carpeta, f'{borrado.get("hash")}^', "historial-prueba.md"), borrado)
        cuantas = len(historial.versiones(carpeta))
        nueva.unlink()
        respuesta = correr_hook("hook_guardar.py", json.dumps({"hook_event_name": "Stop", "session_id": "hi000001-x",
                                                               "cwd": str(t / "proyecto")}).encode("utf-8"),
                                CEREBRO_CONFIG=str(t / "config.json"), CLAUDE_PLUGIN_DATA="")
        del_hook = len(historial.versiones(carpeta)) - cuantas
        codigo, lista = salida_de(historial.main, "")
        probar("el hook de terminar cada respuesta guarda solo (acá, la nota borrada) y --historial muestra los cambios",
               respuesta.returncode == 0 and del_hook == 1 and "borró historial-prueba.md" in lista
               and "primera versión" in lista and "historial-prueba.md (+0 −1)" in lista,
               (respuesta.returncode, del_hook, lista))
        clave = memoria / "id_rsa.md"
        oculta = memoria / ".privado" / "nota.md"
        oculta.parent.mkdir(exist_ok=True)
        clave.write_text("clave de prueba", encoding="utf-8")
        oculta.write_text("nota oculta", encoding="utf-8")
        escribir(nueva, "# Prueba\n\nVuelve.\n")
        historial.guardar()
        seguidas = (historial.git(carpeta, "ls-files") or "").splitlines()
        probar("un archivo delicado por el nombre (id_rsa, .env, .ssh…) o una carpeta oculta no entran al historial, como "
               "no entran al mapa", "historial-prueba.md" in seguidas and "id_rsa.md" not in seguidas
               and not any(".privado" in s for s in seguidas), seguidas)
        historial.git(carpeta, "add", "-f", "--", "id_rsa.md")
        historial.git(carpeta, "commit", "-q", "-m", "se coló")
        escribir(nueva, "# Prueba\n\nVuelve otra vez.\n")
        historial.guardar()
        probar("si uno delicado ya estaba en el historial, sale en la versión siguiente",
               "id_rsa.md" not in (historial.git(carpeta, "ls-files") or ""), historial.git(carpeta, "ls-files"))
        candado = repo / "index.lock"
        candado.write_text("", encoding="utf-8")
        hace_rato = time.time() - historial.CANDADO_VIEJO - 60
        os.utime(candado, (hace_rato, hace_rato))
        escribir(nueva, "# Prueba\n\nCon candado viejo.\n")
        probar("un candado de git que quedó de una vez que cortaron el hook (más de 10 minutos) no traba el historial para "
               "siempre: se saca y guarda", historial.guardar() is True and not candado.exists(), candado.exists())
        presupuesto = historial.PRESUPUESTO
        historial.PRESUPUESTO = 0
        try:
            escribir(nueva, "# Prueba\n\nSin tiempo.\n")
            comienzo = time.perf_counter()
            sin_tiempo = historial.guardar()
            demora = time.perf_counter() - comienzo
        finally:
            historial.PRESUPUESTO = presupuesto
        probar("guardar tiene un tope de tiempo (así nunca pasa el del hook, que si no lo corta a mitad de camino); sin "
               "tiempo no hace nada y lo guarda la próxima vez",
               sin_tiempo is False and demora < 1 and historial.guardar() is True, (sin_tiempo, demora))
        grande = t / "historial-grande" / "memoria"
        (grande / ".papelera").mkdir(parents=True, exist_ok=True)
        escribir(grande / "inicio.md", "# Inicio\n")
        de_grande = str(grande.resolve())
        espera = historial.ESPERA
        historial.ESPERA = 120
        try:
            historial.guardar_carpeta(de_grande)
            for n in range(800):
                escribir(grande / f"nota-de-prueba-con-un-nombre-largo-{n:04}.md", f"# Nota {n}\n")
            muchas = historial.guardar_carpeta(de_grande)
            mensaje = (historial.git(de_grande, "log", "-1", "--format=%s") or "").strip()
            for n in range(800):
                escribir(grande / ".papelera" / f"nota-borrada-con-un-nombre-bastante-largo-{n:04}.md", f"# Borrada {n}\n")
            escribir(grande / "inicio.md", "# Inicio\n\nOtra.\n")
            ocultas = historial.guardar_carpeta(de_grande)
            seguidas = (historial.git(de_grande, "ls-files") or "").splitlines()
        finally:
            historial.ESPERA = espera
        probar("si cambian muchas notas de una vez (acá 800, como un --renombrar grande), el historial igual guarda: el "
               "mensaje nombra 20 y dice cuántas más, y las de una carpeta oculta salen de a tandas (antes la línea de "
               "comandos pasaba el tope de Windows y no guardaba nunca más)",
               muchas is True and ocultas is True and len(historial.versiones(de_grande)) == 3
               and mensaje.endswith("nombre-largo-0019.md y 780 más") and len(seguidas) == 801
               and not any(".papelera" in s for s in seguidas), (muchas, ocultas, mensaje[-80:], len(seguidas)))
        shutil.rmtree(historial.repo_de(de_grande), ignore_errors=True)
        shutil.rmtree(grande.parent, ignore_errors=True)
        escribir(nueva, "# Prueba\n\nCon git trabado.\n")
        clave_repo = repo.name
        (repo / "index.lock").write_text("", encoding="utf-8")
        try:
            historial.guardar()
            recien = historial.linea_salud()
            estado = json.loads(historial.ESTADO.read_text(encoding="utf-8"))
            anotada = estado.get("fallas", {}).get(clave_repo)
            estado.setdefault("fallas", {})[clave_repo] = int(time.time()) - 2 * 86400
            historial.ESTADO.write_text(json.dumps(estado), encoding="utf-8")
            trabada = historial.linea_salud()
        finally:
            (repo / "index.lock").unlink()
        destrabada = historial.linea_salud()
        sin_fallas = json.loads(historial.ESTADO.read_text(encoding="utf-8"))
        probar("si el historial lleva más de un día sin poder guardar, --salud lo avisa con el comando para ver qué le pasa "
               "a git; una falla de recién no avisa, y cuando vuelve a guardar el aviso se va solo (antes decía que andaba)",
               isinstance(anotada, int) and not recien.startswith("AVISO") and trabada.startswith("AVISO")
               and "no pude guardar ninguna versión nueva" in trabada and f'--git-dir="{repo}"' in trabada
               and not destrabada.startswith("AVISO") and "fallas" not in sin_fallas, (recien, trabada, destrabada))
        casa_falsa = t / "git-casa-falsa"
        ganchos = casa_falsa / "ganchos"
        ganchos.mkdir(parents=True, exist_ok=True)
        (ganchos / "pre-commit").write_text("#!/bin/sh\nexit 1\n", encoding="utf-8", newline="\n")
        (casa_falsa / ".gitconfig").write_text("[commit]\n\tgpgsign = true\n[gpg]\n\tprogram = gpg-que-no-existe\n[core]\n"
                                               f"\thooksPath = {ganchos.as_posix()}\n", encoding="utf-8")
        control = casa_falsa / "control"
        control.mkdir(exist_ok=True)
        casa_antes = os.environ.get("HOME")
        os.environ["HOME"] = str(casa_falsa)
        try:
            subprocess.run(["git", "-C", str(control), "init", "-q"], capture_output=True, timeout=30)
            (control / "a.txt").write_text("a", encoding="utf-8")
            subprocess.run(["git", "-C", str(control), "add", "a.txt"], capture_output=True, timeout=30)
            falla_normal = subprocess.run(["git", "-C", str(control), "-c", "user.name=x", "-c", "user.email=x@x",
                                           "commit", "-q", "-m", "x"], capture_output=True, timeout=30).returncode != 0
            escribir(nueva, "# Prueba\n\nCon firma obligatoria.\n")
            firmado = historial.guardar()
        finally:
            if casa_antes is None:
                os.environ.pop("HOME", None)
            else:
                os.environ["HOME"] = casa_antes
        probar("si el git de la persona obliga a firmar cada commit o tiene un hook que los frena, el historial interno igual "
               "guarda (sin pedir la clave de firma ni fallar en silencio); un commit normal con esa configuración falla",
               falla_normal and firmado is True, (falla_normal, firmado))
        corto = salida_de(historial.main, "ab")
        probar("buscar en el historial pide 3 letras o más (con una sola revisaba cada versión)",
               corto[0] == 2 and "3 letras" in corto[1], corto)
        salud = historial.linea_salud()
        probar("--salud cuenta las versiones y dice cómo buscar lo borrado", "versiones desde el" in salud
               and '--historial "texto"' in salud, salud)
        codigo, nada = salida_de(historial.main, "texto que nunca existió")
        probar("un texto que nunca estuvo lo dice claro", "no aparece en la memoria de hoy ni en su historial" in nada, nada)
        buscador = importlib.import_module("buscador")
        raices_antes = [list(f["raices"]) for f in historial.nucleo.FUENTES]
        escribir(nueva, "# Prueba\n\nEl riego nocturno del zapallar arranca a las 05:40.\n")
        historial.guardar()
        de_antes = max(historial.versiones(carpeta))
        while time.time() < de_antes + 1.05:
            time.sleep(0.05)
        escribir(nueva, "# Prueba\n\nEl riego nocturno del zapallar arranca a las 07:10.\n")
        escribir(de_hoy_afuera, "# Zapallar\n\nEl riego nocturno del zapallar se revisa a las 09:15.\n")
        historial.guardar()
        en_disco = sorted(os.listdir(memoria))
        cuando = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(de_antes))
        codigo, de_ese_dia = salida_de(historial.main_al, "riego nocturno zapallar", cuando, False)
        codigo_sobre, sobre_ese_dia = salida_de(historial.main_al, "riego nocturno zapallar", cuando, True)
        de_hoy = "\n".join(buscador.responder(buscador.desde_disco(guardado=False), "riego nocturno zapallar"))
        version = re.search(r'show ([0-9a-f]{7,}):"historial-prueba\.md"', de_ese_dia)
        probar("--buscar y --sobre con --al responden con la memoria como estaba ese día, sacada del historial: traen el "
               "dato de entonces y no el de hoy, con las rutas de la memoria de verdad y el comando para leer la nota "
               "entera de ese día; no mezclan los documentos de hoy de las otras fuentes, no cambian la memoria ni dejan "
               "la carpeta temporal puesta en las fuentes",
               codigo == 0 and codigo_sobre == 0 and "arranca a las 05:40" in de_ese_dia and "07:10" not in de_ese_dia
               and "arranca a las 05:40" in sobre_ese_dia and "07:10" not in sobre_ese_dia and "arranca a las 07:10" in de_hoy
               and "09:15" in de_hoy and "09:15" not in de_ese_dia + sobre_ese_dia
               and de_ese_dia.startswith(f"La memoria de {carpeta} como estaba el ")
               and str(Path(carpeta) / "historial-prueba.md") in de_ese_dia and "neuromapa-al-" not in de_ese_dia + sobre_ese_dia
               and version and "05:40" in historial.contenido(carpeta, version.group(1), "historial-prueba.md")
               and "Solo la memoria" in de_ese_dia and sorted(os.listdir(memoria)) == en_disco
               and [list(f["raices"]) for f in historial.nucleo.FUENTES] == raices_antes,
               (de_ese_dia[-900:], sobre_ese_dia[:500], de_hoy[:300]))
        fijo = time.mktime((2026, 10, 11, 12, 0, 0, 0, 0, -1))
        esperados = {"2026-10-06": "2026-10-06 23:59:59", "6/10": "2026-10-06 23:59:59", "6/10/26": "2026-10-06 23:59:59",
                     "6/10 18:30": "2026-10-06 18:30:59", "2026-10-06T18:30:15": "2026-10-06 18:30:15",
                     "25/12": "2025-12-25 23:59:59", "31/2": None, "mañana": None, "6/10 a la tarde": None, "": None}
        entendidos = {texto: (lambda m: time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(m)) if m else None)(
            historial.momento_de(texto, fijo)) for texto in esperados}
        probar("la fecha de --al va como 2026-10-06, 6/10 o «6/10 18:30»: sin hora es hasta el final de ese día, sin año es "
               "la última vez que pasó ese día, y lo que no es una fecha no se acepta", entendidos == esperados, entendidos)
        muy_antes = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(min(historial.versiones(carpeta)) - 86400))
        codigo_antes, dicho_antes = salida_de(historial.main_al, "riego", muy_antes, True)
        codigo_mala, dicho_mala = salida_de(historial.main_al, "riego", "mañana", True)
        codigo_suelta, dicho_suelta = cerebro_en(t, "--al", "6/10")
        codigo_consola, dicho_consola = cerebro_en(t, "--sobre", "riego nocturno zapallar", "--al", cuando)
        probar("una fecha de antes del historial dice desde cuándo hay versiones; una fecha mal escrita, o --al sin --sobre "
               "ni --buscar, lo dicen sin romperse; y por la consola responde igual",
               codigo_antes == 1 and "empieza el" in dicho_antes and codigo_mala == 2 and "no entendí la fecha" in dicho_mala
               and codigo_suelta == 2 and "--al va con --sobre" in dicho_suelta and codigo_consola == 0
               and "arranca a las 05:40" in dicho_consola and "07:10" not in dicho_consola
               and "Traceback" not in dicho_antes + dicho_mala + dicho_suelta + dicho_consola,
               (dicho_antes, dicho_mala, dicho_suelta, dicho_consola[:500]))
    finally:
        for ruta in (nueva, suelta, memoria / "id_rsa.md", de_hoy_afuera):
            if ruta.exists():
                ruta.unlink()
        shutil.rmtree(memoria / ".privado", ignore_errors=True)


def revisar_vigencia(t):
    seccion("Qué dato cambió y cuándo (--cambios y el aviso de --sobre)")
    historial = importlib.import_module("historial")
    vigencia = importlib.import_module("vigencia")
    buscador = importlib.import_module("buscador")
    if not historial.hay_git():
        saltear("qué dato cambió y cuándo: sin git en el PATH, salteado")
        return
    memoria = t / "memoria"
    carpeta = str(memoria.resolve())
    nota = memoria / "vigencia-prueba.md"
    archivo = memoria / "vigencia-archivo.md"
    manguera = "La manguera vieja del invernadero se guardó en el galpón del fondo."

    def cuerpo(revisada, minutos, bomba, dia, punto, litros, otras):
        cabeza = frontmatter("vigencia-prueba", f"Riego del invernadero de prueba, revisado el {revisada} de octubre", "project")
        return (f"{cabeza}# Invernadero de prueba\n\nEl invernadero riega los tomates durante {minutos} minutos\n"
                f"por turno en verano. La bomba del invernadero quedó **{bomba}** después del cambio de filtro.\n"
                f"El caudal del invernadero se midió el {dia} con el balde grande.\n"
                f"El sensor de humedad del invernadero se limpia con un trapo seco{punto}\n"
                f"{otras[0]}\n## Otra parte\n\nEl tractor del fondo carga {litros} litros de gasoil en el tanque.\n{otras[1]}")

    def escribir(ruta, texto):
        ruta.write_text(texto, encoding="utf-8", newline="\n")

    def salida_de(funcion, *argumentos):
        texto = io.StringIO()
        with contextlib.redirect_stdout(texto):
            codigo = funcion(*argumentos)
        return codigo, texto.getvalue()

    def sobre(consulta, anotar=buscador.cambios_del_historial):
        indice = buscador.desde_disco(guardado=False)
        return "\n".join(buscador.responder(indice, consulta, True, anotar=anotar))

    def renglon_de(texto):
        return nota.read_text(encoding="utf-8").split("\n").index(texto) + 1

    try:
        escribir(nota, cuerpo(3, 28, "SIN PROBAR", "3/10", ";", 40, (
            manguera + "\n", "El galpón del fondo tiene una gotera sobre la mesa de trabajo.\n"
            "Los plantines de albahaca del invernadero pasan al cantero dos.\n")))
        historial.guardar()
        escribir(nota, cuerpo(9, 45, "PROBADA", "9/10", ".", 60, (
            "", "Sobre la mesa de trabajo quedó una caja del galpón del fondo.\n"
            "Los plantines de albahaca del invernadero pasan al cantero dos (los regó Ana).\n")))
        escribir(archivo, f"# Archivo del invernadero\n\n{manguera}\n")
        historial.guardar()
        datos = vigencia.cambios_de(carpeta, "vigencia-prueba.md")
        clases = sorted((e["clase"], e["antes"].split(" ")[1]) for e in datos["eventos"])
        mudada = next((e for e in datos["eventos"] if e["clase"] == vigencia.MUDADA), {})
        probar("comparando dos versiones de una nota separa lo que cambió de verdad: el número, el estado, la fecha, lo "
               "que se amplió y lo que se borró (aunque haya una frase nueva con las mismas palabras en otro orden); lo "
               "que se mudó tal cual a otra nota va aparte, con su destino; y no cuentan un cambio de puro signo (un punto "
               "por un punto y coma) ni el del encabezado de la nota",
               clases == [("ampliada", "plantines"), ("borrada", "galpón"), ("estado", "bomba"), ("fecha", "caudal"),
                          ("mudada", "manguera"), ("numero", "invernadero"), ("numero", "tractor")]
               and mudada.get("a") == "vigencia-archivo.md" and len(datos["versiones"]) == 2, clases)
        turno = "El turno de la {} riega el cantero uno con la manguera verde."
        de_dos = vigencia.comparar(f"# Turnos\n\n{turno.format('mañana')}\n{turno.format('tarde')}\n",
                                   f"# Turnos\n\n{turno.format('noche')}\n", {})
        probar("una frase nueva es la versión nueva de una sola frase vieja: si dos se parecen a ella, la otra cuenta "
               "como borrada", sorted(e["clase"] for e in de_dos) == ["borrada", "otras"], de_dos)
        escribir(nota, nota.read_text(encoding="utf-8").replace("durante 45 minutos", "durante 50 minutos"))
        historial.guardar()
        codigo, dicho = salida_de(vigencia.main, "vigencia-prueba")
        version = re.search(r'show ([0-9a-f]{7,})\^:"vigencia-prueba\.md"', dicho)
        de_45 = "El invernadero riega los tomates durante 45 minutos por turno en verano."
        probar("--cambios NOTA lo cuenta de lo más nuevo a lo más viejo: qué decía antes y qué pasó a decir, cuál sigue "
               "así hoy, cuántas frases se mudaron y adónde (sin mostrarlas como cambio), y el comando para leer la nota "
               "entera de antes",
               codigo == 0 and dicho.startswith("Cambios de vigencia-prueba.md según el historial: 3 versiones de la nota")
               and "6 frases reescritas (1 de estado, 3 de número, 1 de fecha o commit, 1 ampliada) y 1 borrada." in dicho
               and f"antes decía:  «{de_45}»" in dicho
               and f"pasó a decir: «{de_45.replace('45', '50')}» (así sigue hoy)" in dicho
               and f"pasó a decir: «{de_45}»\n" in dicho and dicho.index("durante 50 minutos") < dicho.index("durante 28")
               and "1 frase se mudó tal cual a otra nota y no cuenta como cambio: 1 a vigencia-archivo.md el " in dicho
               and "manguera" not in dicho and "trapo seco" not in dicho
               and "decía: «El galpón del fondo tiene una gotera sobre la mesa de trabajo.»" in dicho
               and version and "45 minutos" in historial.contenido(carpeta, version.group(1) + "^", "vigencia-prueba.md"),
               dicho)
        tope = vigencia.TOPE_EVENTOS
        vigencia.TOPE_EVENTOS = 2
        try:
            _, cortado = salida_de(vigencia.main, "vigencia-prueba")
            _, entero = salida_de(vigencia.main, str(nota), True)
        finally:
            vigencia.TOPE_EVENTOS = tope
        probar("muestra los últimos cambios y dice cuántos quedan; con --todo salen todos; la nota se puede pasar por su "
               "nombre o por su ruta", "… y 5 cambios más antiguos: con --todo salen todos." in cortado
               and "durante 50 minutos" in cortado and "SIN PROBAR" not in cortado and "SIN PROBAR" in entero
               and "más antiguos" not in entero and "Hoy esa nota no existe" not in entero, cortado)
        largo = " ".join(f"palabra{n}" for n in range(40))
        recorte = vigencia.recortes(f"{largo} y al final vale 10 pesos por kilo.", f"{largo} y al final vale 20 pesos por kilo.")
        probar("si la frase es larga y lo que cambió está al final, el recorte empieza cerca del cambio y lo muestra",
               recorte[0].startswith("…") and "vale 10 pesos" in recorte[0] and "vale 20 pesos" in recorte[1]
               and len(recorte[0]) <= vigencia.LARGO_CITA + 2, recorte)
        filas = vigencia.resumen_de(carpeta, 2)
        mia = next((f for f in filas if f[1] == "vigencia-prueba.md"), None)
        _, lista = salida_de(vigencia.main, "")
        probar("--cambios sin nota dice qué notas cambiaron en los últimos días y cuánto; en un plazo sin cambios lo dice",
               mia is not None and mia[2:] == (6, 1)
               and "vigencia-prueba.md: 6 frases reescritas y 1 borrada; lo último, el " in lista
               and "--cambios NOTA" in lista and vigencia.resumen_de(carpeta, 2, time.time() + 30 * 86400) == []
               and "Ningún dato" in vigencia.texto_resumen(carpeta, 2, [])[0], (filas, lista))
        de_50 = "El invernadero riega los tomates durante 50 minutos"
        con_aviso = sobre("invernadero riega tomates")
        aviso = f"(línea {renglon_de(de_50)}); antes decía: «{de_45}»"
        sin_aviso = sobre("invernadero riega tomates", None)
        del_motor = buscador.desde_disco(guardado=False).sobre("invernadero riega tomates", buscador.ALCANCE)
        codigo_sobre, por_consola = cerebro_en(t, "--sobre", "invernadero riega tomates")
        probar("--sobre avisa debajo de lo que manda a leer si el renglón citado cambió: cuándo, en qué línea y qué decía "
               "antes; solo por la consola (el resultado del buscador, que es lo que usan la pista automática y la app, "
               "no lo trae) y sin avisar de lo que cambió en renglones que la consulta no cita",
               "cambió el " in con_aviso and aviso in con_aviso and "antes decía" not in sin_aviso
               and not any("cambios" in p for p in del_motor["leerPrimero"])
               and "40 litros" not in con_aviso and "SIN PROBAR" not in con_aviso
               and codigo_sobre == 0 and aviso in por_consola, (con_aviso[-900:], por_consola[-500:]))
        de_estado = sobre("bomba invernadero filtro")
        de_fecha = sobre("caudal invernadero balde")
        de_ampliada = sobre("plantines albahaca cantero")
        probar("avisa cuando cambió el estado, un número o las palabras; no cuando solo cambió una fecha o se le agregó "
               "algo al final",
               "antes decía: «La bomba del invernadero quedó SIN PROBAR después del cambio de filtro.»" in de_estado
               and "antes decía" not in de_fecha and "antes decía" not in de_ampliada
               and "vigencia-prueba.md" in de_fecha and "vigencia-prueba.md" in de_ampliada,
               (de_estado[-500:], de_fecha[-400:], de_ampliada[-400:]))
        por_tramo, presupuesto = vigencia.CAMBIOS_POR_TRAMO, vigencia.PRESUPUESTO_AVISO
        try:
            dos = sobre("invernadero")
            vigencia.CAMBIOS_POR_TRAMO = 1
            uno = sobre("invernadero")
            vigencia.CAMBIOS_POR_TRAMO, vigencia.PRESUPUESTO_AVISO = por_tramo, 0
            sin_tiempo = sobre("invernadero riega tomates")
        finally:
            vigencia.CAMBIOS_POR_TRAMO, vigencia.PRESUPUESTO_AVISO = por_tramo, presupuesto
        probar("el aviso tiene tope: dos cambios por tramo, primero el más nuevo, y un tope de tiempo (sin tiempo, --sobre "
               "responde igual, sin el aviso)", dos.count("antes decía") == 2 and uno.count("antes decía") == 1
               and aviso in uno and "antes decía" not in sin_tiempo and "vigencia-prueba.md" in sin_tiempo,
               (dos[-700:], uno[-400:]))
        guardada = nota.read_text(encoding="utf-8")
        escribir(nota, guardada.replace("durante 50 minutos", "durante 55 minutos"))
        sin_guardar = sobre("invernadero riega tomates")
        escribir(nota, guardada)
        probar("si el renglón volvió a cambiar y eso todavía no está en el historial, no avisa con un «antes» que ya no "
               "es el de ese texto", "durante 45 minutos" not in sin_guardar and "vigencia-prueba.md" in sin_guardar,
               sin_guardar[-600:])
        archivo.unlink()
        historial.guardar()
        codigo_borrada, de_borrada = salida_de(vigencia.main, "vigencia-archivo")
        codigo_mala, de_mala = salida_de(vigencia.main, "nota-que-nunca-existio")
        codigo_consola, por_consola = cerebro_en(t, "--cambios", "vigencia-prueba.md")
        codigo_lista, lista_consola = cerebro_en(t, "--cambios", "3")
        probar("una nota que ya se borró se puede consultar igual (dice qué decía); una que nunca existió lo dice sin "
               "romperse; y por la consola responde lo mismo, con una nota o con una cantidad de días",
               codigo_borrada == 0 and f"decía: «{manguera}»" in de_borrada and "Hoy esa nota no existe." in de_borrada
               and codigo_mala == 2
               and "no encontré la nota" in de_mala and codigo_consola == 0 and "pasó a decir" in por_consola
               and codigo_lista == 0 and "en los últimos 3 días" in lista_consola
               and "Traceback" not in de_borrada + de_mala + por_consola + lista_consola,
               (de_borrada, de_mala, por_consola[:300], lista_consola[:300]))
    finally:
        for ruta in (nota, archivo):
            if ruta.exists():
                ruta.unlink()
