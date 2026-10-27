from humo.base import *


def revisar_dormir(t):
    seccion("Dormir (repasa las notas, propone arreglos y solo aplica los que se aprueban)")
    import dormir
    carpeta = str(nucleo.DATOS)
    login = t / "memoria" / "arreglo-login.md"
    claude_md = t / "proyecto" / "CLAUDE.md"
    originales = {r: r.read_bytes() for r in (login, claude_md)}
    renglones_login = medico.contar({"tipo": "lineas", "archivo": str(t / "proyecto" / "codigo" / "Login.cs")})[0]

    def salida_de(funcion, *argumentos):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            codigo = funcion(*argumentos)
        return codigo, buffer.getvalue()

    def pasada():
        cerebro = armar_cerebro(t)
        propuestas = dormir.pasada(cerebro, medico.revisar(cerebro))
        return dormir.guardar_pasada(carpeta, propuestas, time.time(), 0.1)

    try:
        claude_md.write_bytes(dormir.BOM + originales[claude_md].replace(b"\n", b"\r\n"))
        datos = pasada()
        lista = datos["propuestas"]
        linea = next((p for p in lista if p["tipo"] == "linea" and p["ruta"] == str(login)), None)
        cifra = next((p for p in lista if p["tipo"] == "cifra" and p["ruta"] == str(claude_md)), None)
        repetida = [p for p in lista if p["tipo"] == "mirar" and p["ruta"] == str(login) and "Login.cs:30" in p["texto"]]
        probar("la pasada propone Login.cs:30 → Login.cs:7 (el médico sabe la línea nueva) y 99 → los renglones de hoy "
               "en el CLAUDE.md, sin repetirlos en «para mirar»",
               linea is not None and (linea["viejo"], linea["nuevo"]) == ("Login.cs:30", "Login.cs:7")
               and cifra is not None and (cifra["viejo"], cifra["nuevo"]) == ("99", str(renglones_login))
               and not repetida and linea["memoria"] and not cifra["memoria"], lista)
        probar("la pasada no toca ninguna nota", login.read_bytes() == originales[login]
               and claude_md.read_bytes() == dormir.BOM + originales[claude_md].replace(b"\n", b"\r\n"))
        lineas = dormir.texto_lista(datos, "neuromapa", "Ana")
        probar("--propuestas muestra cada arreglo con el antes y el después, y cómo aplicarlo (lo decide Ana)",
               any("antes:" in x and "Login.cs:30" in x for x in lineas)
               and any("después:" in x and "Login.cs:7" in x for x in lineas)
               and any("--aplicar" in x and "Ana" in x for x in lineas), lineas)
        primero = dormir.aviso(carpeta, "sesion01", "neuromapa", "Ana", 1000)
        segundo = dormir.aviso(carpeta, "sesion02", "neuromapa", "Ana", 1001)
        probar("el aviso sale una sola vez por pasada, dice cómo verlos y que Neuromapa no toca las notas solo",
               bool(primero) and "--propuestas" in primero and "no toca las notas solo" in primero and segundo is None,
               (primero, segundo))
        probar("--salud cuenta las propuestas pendientes", "--propuestas" in (dormir.linea_salud(carpeta) or ""),
               dormir.linea_salud(carpeta))
        codigo, texto = salida_de(dormir.main_aplicar, f'{linea["numero"]},{cifra["numero"]}')
        nuevo_claude = claude_md.read_bytes()
        restan = {p["id"] for p in dormir.leer(carpeta)["propuestas"]}
        probar("--aplicar cambia solo ese pedazo del renglón, respeta el BOM y los fines de renglón de Windows, avisa que el "
               "archivo del proyecto quedó sin commit, y lo saca de la lista",
               codigo == 0 and "Login.cs:7" in login.read_text(encoding="utf-8")
               and "Login.cs:30" not in login.read_text(encoding="utf-8")
               and nuevo_claude.startswith(dormir.BOM) and b"\r\n" in nuevo_claude
               and nuevo_claude.count(b"\n") == nuevo_claude.count(b"\r\n")
               and f"tiene {renglones_login} renglones".encode() in nuevo_claude and "sin commit" in texto
               and linea["id"] not in restan and cifra["id"] not in restan, (codigo, texto))
        otra = pasada()["propuestas"]
        probar("después de aplicarlos, la pasada siguiente ya no los propone",
               not any(p["ruta"] in (str(login), str(claude_md)) and p["tipo"] != "mirar" for p in otra), otra)
        login.write_bytes(originales[login])
        claude_md.write_bytes(originales[claude_md])
        linea = next(p for p in pasada()["propuestas"] if p["tipo"] == "linea" and p["ruta"] == str(login))
        login.write_text(originales[login].decode("utf-8").replace("Login.cs:30", "Login.cs:30 o por ahí"),
                         encoding="utf-8", newline="\n")
        cambiada = login.read_bytes()
        codigo, texto = salida_de(dormir.main_aplicar, str(linea["numero"]))
        probar("si la nota cambió desde la pasada, --aplicar no la toca y lo dice",
               codigo == 1 and login.read_bytes() == cambiada and "cambió" in texto, texto)
        login.write_bytes(originales[login])
        linea = next(p for p in pasada()["propuestas"] if p["tipo"] == "linea" and p["ruta"] == str(login))
        mirar = next((p for p in dormir.leer(carpeta)["propuestas"] if p["tipo"] == "mirar"), None)
        rechazo = salida_de(dormir.main_aplicar, str(mirar["numero"])) if mirar else (None, "")
        codigo, texto = salida_de(dormir.main_descartar, str(linea["numero"]))
        despues = pasada()["propuestas"]
        probar("--descartar la saca y no vuelve en la pasada siguiente; una «para mirar» no se aplica sola",
               codigo == 0 and not any(p["id"] == linea["id"] for p in despues) and login.read_bytes() == originales[login]
               and (mirar is None or (rechazo[0] == 2 and "para mirar" in rechazo[1])), (texto, rechazo))
        login.write_text(originales[login].decode("utf-8").replace("`Login.cs:30` (`ValidarClave`)",
                                                                   "`Login.cs:30` (`ValidarClave`, que sigue en `:31`)"),
                         encoding="utf-8", newline="\n")
        ambiguas = pasada()["propuestas"]
        login.write_bytes(originales[login])
        probar("si el renglón cita otra línea del mismo archivo, el arreglo que sale de un nombre cercano queda «para "
               "mirar» (el nombre podía ser de la otra cita)",
               not any(p["tipo"] == "linea" and p["ruta"] == str(login) for p in ambiguas)
               and any(p["tipo"] == "mirar" and p["ruta"] == str(login) and "Login.cs:30" in p["texto"] for p in ambiguas),
               ambiguas)
        despertar = t / "despertar"
        despertar.mkdir()
        falso = despertar / "armar.py"
        falso.write_text("from pathlib import Path\nPath(__file__).with_name('durmio.txt').write_text('si')\n",
                         encoding="utf-8")
        ahora = time.time()
        primera, segunda = [dormir.despertar(str(despertar), str(falso), ahora) for _ in range(2)]
        for _ in range(100):
            if (despertar / "durmio.txt").exists():
                break
            time.sleep(0.1)
        probar("con el primer pedido del día larga la pasada de fondo una sola vez; con una pasada de hace menos de 20 h, no",
               primera and not segunda and (despertar / "durmio.txt").exists()
               and not dormir.despertar(carpeta, str(falso), time.time()), (primera, segunda))
    finally:
        for r, contenido in originales.items():
            r.write_bytes(contenido)
        for nombre in (dormir.ARCHIVO, dormir.ARCHIVO + ".lock", dormir.MARCA):
            try:
                os.remove(os.path.join(carpeta, nombre))
            except OSError:
                pass


def revisar_dormir_claude(t):
    seccion("Dormir con Claude (los «ya resuelto» y las notas que se contradicen, con tope de gasto y sin gastar acá)")
    import dormir
    import dormir_claude
    carpeta = str(nucleo.DATOS)
    memoria = t / "memoria"
    nota_a, nota_b, pendiente = memoria / "pase-precio.md", memoria / "pase-tienda.md", memoria / "pendiente-pase.md"
    repo = t / "repo-pase"
    opciones = {"tope_usd_por_dia": 1.0, "modelo": "sonnet"}
    llamadas = []

    def salida_de(funcion, *argumentos):
        buffer = io.StringIO()
        with contextlib.redirect_stdout(buffer):
            codigo = funcion(*argumentos)
        return codigo, buffer.getvalue()

    def git(*argumentos):
        return subprocess.run(["git", "-C", str(repo)] + list(argumentos), check=True, capture_output=True, text=True,
                              timeout=30).stdout.strip()

    def responder_pares(pedido):
        salida = []
        for bloque in pedido.split("\n\nPar ")[1:]:
            numero = int(bloque.split("\n", 1)[0])
            if "PrecioPase" not in bloque:
                salida.append({"par": numero, "choca": False, "renglon_a": 0, "renglon_b": 0, "vigente": "no_se",
                               "por_que": ""})
                continue
            lados = bloque.split("\nB: ", 1)
            hallados = [re.search(r"^(\d+): .*USD (4|10)\b", lado, re.M) for lado in lados]
            salida.append({"par": numero, "choca": True, "renglon_a": int(hallados[0].group(1)),
                           "renglon_b": int(hallados[1].group(1)), "vigente": "a" if hallados[0].group(2) == "10" else "b",
                           "por_que": "Una dice que el pase cuesta USD 4 y la otra USD 10."})
        return {"pares": salida}

    def fuera_del_pasaje(pedido):
        return {"pares": [dict(r, renglon_a=r["renglon_a"] + 500) if r["choca"] else r
                          for r in responder_pares(pedido)["pares"]]}

    def falso(resuelto, gasto=0.04, error=None, se_pasa=False, pares=None):
        def llamar_a(pedido, esquema, tope, herramientas="", carpetas=(), turnos=3):
            llamadas.append({"pedido": pedido, "tope": tope, "herramientas": herramientas, "carpetas": tuple(carpetas)})
            if error:
                return {"error": error, "gasto": 0.0, "parar": True}
            if se_pasa:
                return {"tope": True, "gasto": tope}
            if "veredicto" in esquema["properties"]:
                return {"respuesta": resuelto, "gasto": gasto}
            return {"respuesta": (pares or responder_pares)(pedido), "gasto": gasto}
        return llamar_a

    try:
        repo.mkdir()
        (repo / "pase.py").write_text("def precio():\n    return 4\n", encoding="utf-8", newline="\n")
        git("init", "-q")
        git("add", "-A")
        git("-c", "user.name=prueba", "-c", "user.email=prueba@example.invalid", "commit", "-q", "-m", "primera")
        (repo / "pase.py").write_text("def precio():\n    return 10\n", encoding="utf-8", newline="\n")
        (repo / "clave.pem").write_text("SECRETO-PEM-HUMO\n", encoding="utf-8", newline="\n")
        git("add", "-A")
        git("-c", "user.name=prueba", "-c", "user.email=prueba@example.invalid", "commit", "-q", "-m",
            "Pase: el precio queda en USD 10")
        sha = git("rev-parse", "--short", "HEAD")
        (repo / "LEEME.md").write_text("precio() devuelve 10\n", encoding="utf-8", newline="\n")
        nota_a.write_text("# Precio del pase\n\nEl `PrecioPase` de `pase_tienda.ts` cobra USD 4.\n", encoding="utf-8",
                          newline="\n")
        nota_b.write_text("# Tienda\n\nHoy `PrecioPase` en `pase_tienda.ts` cobra USD 10 a todos.\n", encoding="utf-8",
                          newline="\n")
        pendiente.write_text("# Pendiente\n\n- Falta arreglar el precio del pase\n  en `pase.py`.\n- Otra cosa.\n",
                             encoding="utf-8", newline="\n")
        cerebro = armar_cerebro(t)
        item = {"ruta": str(pendiente), "linea": 3, "memoria": True, "proyecto": "", "tipo": "mirar",
                "regla": "yaResuelto", "arreglo": "",
                "texto": f"Puede que ya esté resuelto: el commit {sha} (1/1) «Pase: el precio queda en USD 10» es "
                         "posterior a este renglón y toca lo mismo. El renglón dice «Falta arreglar el precio».",
                "numero": 1}
        item["id"] = dormir.identificar(item)
        bien = {"veredicto": "resuelto", "archivo": "pase.py", "linea": 2, "texto": "return 10",
                "por_que": "precio() ya devuelve 10."}
        ahora = time.time()
        r1 = dormir_claude.revisar(cerebro, [item], {}, opciones, ahora, llamar_a=falso(bien), repos=[str(repo)])
        marca = r1["reemplazos"].get(item["id"]) or {}
        pedido = llamadas[0]["pedido"] if llamadas else ""
        probar("un «ya resuelto» que Claude comprueba con una línea del código de hoy se vuelve un arreglo para aplicar "
               "(una marca con el día y el commit, al final del párrafo y no en medio de la oración)",
               marca.get("tipo") == "marca" and f"(`{sha}`)" in marca.get("nuevo", "") and "✅ Resuelto el" in marca["nuevo"]
               and "pase.py:2" in marca.get("porque", "") and marca.get("linea") == 4
               and marca.get("antes") == "  en `pase.py`.", marca)
        probar("a Claude le llegan el renglón, el commit y sus cambios, pero no el contenido de un archivo sensible, y "
               "solo puede leer (Read, Grep, Glob) en ese repositorio",
               "Falta arreglar el precio" in pedido and "return 10" in pedido and "SECRETO-PEM-HUMO" not in pedido
               and "sensible" in pedido and llamadas[0]["herramientas"] == "Read,Grep,Glob"
               and llamadas[0]["carpetas"] == (str(repo),), llamadas[:1])
        chocan = r1["nuevas"]
        choque = chocan[0] if len(chocan) == 1 else {}
        probar("dos notas que dan otro precio para lo mismo salen «para mirar», en la que parece vieja y con la otra al lado",
               choque.get("regla") == "contradiccion" and choque.get("ruta") == str(nota_a)
               and choque.get("otra", {}).get("ruta") == str(nota_b) and "USD 4" in choque.get("antes", "")
               and "USD 10" in choque["otra"].get("antes", "") and "Parece al día lo de allá" in choque.get("texto", ""),
               chocan)
        ultima = r1["memo"]["ultima"]
        probar("lleva la cuenta de lo gastado por día y de lo que revisó",
               abs(r1["memo"]["gasto"][dormir_claude.hoy(ahora)] - 0.04 * len(llamadas)) < 1e-9
               and ultima["resueltos"] == 1 and ultima["pares"] >= 1 and ultima["faltan"] == 0 and ultima["chocan"] == 1,
               r1["memo"]["gasto"])
        antes = len(llamadas)
        r2 = dormir_claude.revisar(cerebro, [item], r1["memo"], opciones, ahora + 60, llamar_a=falso(bien),
                                   repos=[str(repo)])
        probar("lo que ya revisó no lo vuelve a preguntar (no gasta) y lo vuelve a proponer igual",
               len(llamadas) == antes and r2["reemplazos"].get(item["id"], {}).get("tipo") == "marca"
               and [p["ruta"] for p in r2["nuevas"]] == [str(nota_a)], len(llamadas) - antes)
        negada = {k: dict(v, por_que="Hablan de lo mismo, así que no es contradicción.") if v.get("choca") else v
                  for k, v in r1["memo"]["pares"].items()}
        guardada = dormir_claude.revisar(cerebro, [item], dict(r1["memo"], pares=negada), opciones, ahora + 60,
                                         llamar_a=falso(bien), repos=[str(repo)])
        tras_guardada = len(llamadas)

        def responder_negando(pedido):
            return {"pares": [dict(r, por_que="Una dice 4 y la otra 10, pero no es claro que hablen de lo mismo.")
                              if r["choca"] else r for r in responder_pares(pedido)["pares"]]}
        nueva = dormir_claude.revisar(cerebro, [item], {}, opciones, ahora, llamar_a=falso(bien, pares=responder_negando),
                                      repos=[str(repo)])
        probar("si la explicación de Claude misma dice que no chocan (o que no está claro), no sale, tampoco si ya estaba "
               "revisado, y no se vuelve a preguntar",
               not guardada["nuevas"] and tras_guardada == antes and not nueva["nuevas"] and any(v.get("dudoso") for v in nueva["memo"]["pares"].values()),
               (guardada["nuevas"], nueva["nuevas"]))
        fuente = next(f for f in nucleo.FUENTES if f["id"] == "memoria")
        fuente["anclas_resumidas"] = True
        try:
            de_registro = dormir_claude.candidatos(cerebro)
        finally:
            fuente.pop("anclas_resumidas", None)
        probar("las notas de un informe de auditoría (fuente con anclas_resumidas) no se comparan: anotan cómo estaba "
               "todo el día que se escribieron", not any("PrecioPase" in " ".join(c["pa"]["renglones"]) for c in de_registro),
               len(de_registro))
        for nombre, respuesta in (("un texto que no está en esa línea",
                                   dict(bien, texto="return 99")),
                                  ("un archivo sensible", dict(bien, archivo="clave.pem", linea=1, texto="SECRETO-PEM-HUMO")),
                                  ("un archivo fuera del repositorio", dict(bien, archivo=str(nota_b), linea=3,
                                                                            texto="cobra USD 10 a todos")),
                                  ("un documento (.md), aunque esté en el repositorio",
                                   dict(bien, archivo="LEEME.md", linea=1, texto="precio() devuelve 10"))):
            r = dormir_claude.revisar(cerebro, [item], {}, opciones, ahora, llamar_a=falso(respuesta), repos=[str(repo)])
            anotada = r["reemplazos"].get(item["id"]) or {}
            probar(f"si la prueba de Claude es {nombre}, no se cree: queda «para mirar» con «no lo pudo comprobar»",
                   anotada.get("tipo") == "mirar" and anotada.get("claude", {}).get("veredicto") == "no_se", anotada)
        r = dormir_claude.revisar(cerebro, [item], {}, opciones, ahora, llamar_a=falso(bien, pares=fuera_del_pasaje),
                                  repos=[str(repo)])
        probar("si Claude cita un renglón que no está en el pasaje que se le mostró, el choque no se cree",
               not r["nuevas"] and any(v.get("dudoso") for v in r["memo"]["pares"].values()), r["nuevas"])
        antes = len(llamadas)
        gastado = {"gasto": {dormir_claude.hoy(ahora): 0.98}}
        r = dormir_claude.revisar(cerebro, [item], gastado, opciones, ahora, llamar_a=falso(bien), repos=[str(repo)])
        probar("con el tope del día gastado no pregunta nada y dice cuánto falta",
               len(llamadas) == antes and r["memo"]["ultima"]["faltan"] >= 1 and not r["nuevas"], r["memo"]["ultima"])
        antes = len(llamadas)
        r = dormir_claude.revisar(cerebro, [item], {}, opciones, ahora, llamar_a=falso(bien, error="sin sesión"),
                                  repos=[str(repo)])
        probar("si Claude Code falla, se frena en la primera pregunta y lo anota",
               len(llamadas) - antes == 1 and r["memo"]["ultima"]["error"] == "sin sesión", len(llamadas) - antes)
        r = dormir_claude.revisar(cerebro, [item], {}, opciones, ahora, llamar_a=falso(bien, se_pasa=True),
                                  repos=[str(repo)])
        probar("si una pregunta llega a su tope de gasto, lo cuenta como gastado, no lo anota como error y no da nada por "
               "revisado", r["memo"]["ultima"]["error"] is None and r["memo"]["gasto"][dormir_claude.hoy(ahora)] > 0
               and not r["memo"]["resueltos"] and item["id"] not in r["reemplazos"], r["memo"]["ultima"])
        probar("Claude no puede leer archivos sensibles (claves, .env, los de «sensibles»), con reglas que valen en "
               "cualquier carpeta", {"Read(//**/*.pem)", "Read(//**/.env)", "Read(//**/.env.*)", "Read(//**/.ssh/**)"}
               <= set(dormir_claude.negadas()), dormir_claude.negadas()[:6])
        appdata = t / "appdata"
        for version in ("2.1.9", "2.1.10"):
            (appdata / "Claude" / "claude-code" / version / "abc123").mkdir(parents=True)
            (appdata / "Claude" / "claude-code" / version / "abc123" / "claude.exe").write_bytes(b"")
        guardado = {k: os.environ.get(k) for k in ("APPDATA", "NEUROMAPA_CLAUDE")}
        quien = dormir_claude.shutil.which
        try:
            os.environ["APPDATA"] = str(appdata)
            os.environ.pop("NEUROMAPA_CLAUDE", None)
            dormir_claude.shutil.which = lambda nombre: None
            hallado = dormir_claude.buscar_claude()
        finally:
            dormir_claude.shutil.which = quien
            for k, v in guardado.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
        probar("encuentra el claude.exe de la app de escritorio (en una subcarpeta) y elige la versión más nueva",
               hallado is not None and Path(hallado).parts[-3] == "2.1.10", hallado)
        dormir.guardar_pasada(carpeta, [dict(item)], time.time(), 0.1, True)
        mientras = dormir.aviso(carpeta, "sesion11", "neuromapa", "Ana")
        datos = dormir.guardar_sueno(carpeta, r1)
        despues = dormir.aviso(carpeta, "sesion12", "neuromapa", "Ana")
        lista = datos["propuestas"]
        memo = dormir.memo_de(carpeta)
        probar("lo ya revisado se guarda aparte (el aviso de cada pedido lee un archivo chico) y se vuelve a leer igual",
               set(datos["claude"]) == {"ultima"} and memo.get("pares") == r1["memo"]["pares"]
               and memo.get("resueltos") == r1["memo"]["resueltos"], sorted(datos["claude"]))
        probar("el aviso espera a que Claude termine y sale una vez con todo, contando lo que encontró Claude; la marca "
               "conserva el número y el choque va al final",
               mientras is None and bool(despues) and "los encontró Claude" in despues
               and [(p["numero"], p["tipo"]) for p in lista] == [(1, "marca"), (2, "mirar")] and "sonando" not in datos,
               (mientras, despues, [(p["numero"], p["tipo"]) for p in lista]))
        lineas = dormir.texto_lista(datos, "neuromapa", "Ana")
        probar("--propuestas muestra la marca con el antes y el después, el choque con los dos renglones y lo gastado",
               any("después:" in x and "✅ Resuelto el" in x for x in lineas) and any("acá:" in x and "USD 4" in x for x in lineas)
               and any("allá:" in x and "USD 10" in x for x in lineas) and any("Revisión con Claude" in x for x in lineas),
               lineas)
        codigo, texto = salida_de(dormir.main_aplicar, "1")
        probar("--aplicar agrega la marca al final del párrafo y no toca nada más",
               codigo == 0 and pendiente.read_text(encoding="utf-8")
               == f"# Pendiente\n\n- Falta arreglar el precio del pase\n  en `pase.py`. ✅ Resuelto el "
                  f"{r1['memo']['resueltos'][next(iter(r1['memo']['resueltos']))]['dia']} (`{sha}`).\n- Otra cosa.\n",
               (codigo, texto))
        probar("en una fila de tabla la marca va adentro de la última celda",
               dormir.con_marca("| a | b |", " ✅ X.") == "| a | b ✅ X. |" and dormir.con_marca("texto ", " ✅ X.")
               == "texto ✅ X.")
        salida_de(dormir.main_descartar, "2")
        dormir.guardar_pasada(carpeta, [], time.time(), 0.1, True)
        otra = dormir.guardar_sueno(carpeta, r1)["propuestas"]
        probar("un choque descartado no vuelve en la pasada siguiente", not any(p.get("regla") == "contradiccion" for p in otra),
               otra)
        revisar_de_verdad = dormir_claude.revisar
        try:
            dormir_claude.revisar = lambda *a, **k: 1 / 0
            pasada = dormir.guardar_pasada(carpeta, [], time.time(), 0.1, True)
            roto = dormir.sonar(cerebro, carpeta, opciones, pasada, time.time())
        finally:
            dormir_claude.revisar = revisar_de_verdad
        probar("si la revisión con Claude se rompe, lo anota y el aviso no se queda esperando",
               "sonando" not in roto and "falló" in (roto["claude"]["ultima"].get("error") or "")
               and dormir.memo_de(carpeta).get("pares") == r1["memo"]["pares"], roto.get("claude"))
    finally:
        for nota in (nota_a, nota_b, pendiente):
            try:
                nota.unlink()
            except OSError:
                pass
        borrar_carpeta(repo)
        for nombre in (dormir.ARCHIVO, dormir.ARCHIVO + ".lock", dormir.MARCA, dormir.MEMO):
            try:
                os.remove(os.path.join(carpeta, nombre))
            except OSError:
                pass
