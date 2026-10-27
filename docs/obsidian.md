# Neuromapa y Obsidian

No compiten: la diferencia es **quién los usa**. Obsidian es un cuaderno para que vos escribas y leas tus notas.
Neuromapa trabaja con la memoria de Claude mientras Claude trabaja: muestra qué nota lee cada chat, avisa cuando una
nota quedó vieja y, si prendés el contexto automático, le acerca a Claude la nota justa en cada pedido.

Se pueden usar juntos sobre la misma carpeta, porque la memoria de Claude Code ya es lo que Obsidian sabe abrir:
archivos Markdown con un encabezado YAML y `[[enlaces]]` entre notas.

## Abrir la memoria de Claude Code en Obsidian

1. Buscá la carpeta de la memoria de tu proyecto: `~/.claude/projects/<proyecto>/memory/` (en Windows,
   `C:\Users\<tu usuario>\.claude\projects\<proyecto>\memory\`). Adentro están `MEMORY.md` y una nota por tema.
2. En Obsidian, elegí «Abrir carpeta como bóveda» («Open folder as vault») y marcá esa carpeta. En Mac, las carpetas
   que empiezan con punto no se ven en el selector: con Cmd + Mayús + punto aparecen.
3. Listo. Los `[[enlaces]]` funcionan porque Claude Code le pone a cada nota el mismo nombre que a su archivo, y
   `MEMORY.md` se ve como una nota índice, con sus enlaces comunes de Markdown.

Desde entonces, en el mapa de Neuromapa cada nota de esa carpeta tiene un botón **Abrir en Obsidian**, al lado de
«Copiar» en su panel, para pasar a editarla a mano. La primera vez, el navegador pregunta si querés abrir Obsidian.
Sale en las notas de cualquier carpeta que sea una bóveda (que tenga `.obsidian`).

Los cambios que hace Claude aparecen solos en Obsidian: se pone al día cuando otro programa toca un archivo de la
bóveda.

## Qué te da cada uno

| | Obsidian | Neuromapa |
|---|---|---|
| Para quién | Para vos: escribir, leer y navegar tus notas | Para Claude, y para que vos veas lo que hace |
| Qué muestra | Las notas, sus enlaces, el grafo y lo que enlaza a cada nota | Lo mismo como un cerebro, más qué lee y edita cada chat en vivo y qué notas se usan juntas |
| Qué revisa | — | El médico: enlaces a notas que ya no existen, memorias que el índice no lista, encabezados incompletos y notas que ya no entran en una lectura; con tus proyectos cargados, también citas `archivo:línea` corridas y commits que no existen |
| Qué le da a Claude | Nada: Claude no se entera de que existe | La búsqueda `sobre`, los avisos y, si lo prendés, el contexto automático |

## Cuidados

- **La carpeta `.obsidian`.** Obsidian guarda sus opciones en una carpeta `.obsidian` adentro de la bóveda, o sea
  adentro de la memoria. No molesta: Neuromapa lee solo los `.md` que están sueltos en la carpeta de la memoria, su
  historial de versiones saltea las carpetas ocultas, y una bóveda sumada como fuente tampoco se lee por dentro de
  `.obsidian`.
- **No muevas notas a subcarpetas.** Con la configuración de fábrica, Neuromapa lee la carpeta de la memoria sin
  subcarpetas: una nota que metas en una carpeta deja de verse en el mapa y en la búsqueda.
- **Al cambiarle el nombre a una nota,** Obsidian puede arreglar solo los enlaces de las otras notas y los de
  `MEMORY.md` (opción «Automatically update internal links»). Lo que no cambia es el `name:` del encabezado, que
  tiene que ser igual al nombre del archivo: cambialo a mano. Si te olvidás, el médico te lo marca.
- **El encabezado, mejor en modo fuente.** Las notas de Claude Code suelen llevar el tipo adentro de `metadata:`, y el
  panel de propiedades de Obsidian no maneja propiedades anidadas. Para ver y tocar el encabezado, usá el modo fuente
  («Source mode»), que lo muestra como texto.
- **Una nota creada en Obsidian** necesita lo mismo que las de Claude para que Claude la encuentre: el encabezado con
  `name`, `description` y el tipo, y un renglón en `MEMORY.md` que diga cuándo abrirla. Si falta algo, el médico lo
  avisa (`/neuromapa:salud`).
- **De a uno por nota.** Si editás una nota a mano mientras un chat la está cambiando, uno de los dos puede pisar al
  otro. Si pasa, `neuromapa --historial "texto"` busca el renglón perdido en las versiones guardadas (hace falta git).
- **Lo que suba Obsidian ya no es local.** Neuromapa no manda tus notas a ningún lado. Si prendés Obsidian Sync,
  Obsidian Publish o un plugin de la comunidad sobre esa bóveda, tu memoria sale de tu computadora por ese camino.

## Si ya tenés una bóveda de Obsidian

También sirve al revés: tu bóveda puede entrar al mapa como una fuente más del `config.json` (campo `fuentes`, con su
carpeta en `raices`; con `recursivo` en `true` lee también las subcarpetas). Ojo: al escribir `fuentes` dejan de
usarse las de fábrica, así que hay que listar también la memoria de Claude Code. Por ejemplo:

```json
{
  "fuentes": [
    {"id": "memoria", "nombre": "Memoria", "color": "#E64980", "memoria": true, "foco": true,
     "raices": ["~/.claude/projects/<proyecto>/memory"]},
    {"id": "boveda", "nombre": "Mi bóveda", "color": "#228BE6", "foco": true, "huerfanas": false,
     "raices": [{"ruta": "~/Documentos/Mi bóveda", "recursivo": true}]}
  ]
}
```

`"foco": true` es lo que hace que Claude reciba notas de la bóveda en la pista de cada pedido y en `--sobre`. Sin
eso, la bóveda se ve en el mapa pero solo se busca si lo pedís (`--sobre "tema" --todo`). Si la bóveda es grande y
sus notas les ganan el lugar a las de la memoria, `"peso_busqueda"` por debajo de 1 (por ejemplo, 0.7) la hace pesar
menos. [Cómo funciona](como-funciona.md) explica cada campo y [demo/config.json](../demo/config.json) es un ejemplo
más completo. Neuromapa no cambia las notas de la bóveda por su cuenta.

### Qué entiende de una bóveda

- **Los `[[enlaces]]` en las tres formas que escribe Obsidian** (la opción «Formato de enlace nuevo»): solo el nombre
  (`[[Nota]]`), la ruta desde la raíz de la bóveda (`[[Carpeta/Nota]]`) y la ruta relativa a la nota
  (`[[../Carpeta/Nota]]`). También con otro texto (`[[Nota|alias]]`), a un título (`[[Nota#Título]]`) o a un bloque
  (`[[Nota#^id]]`), incrustados (`![[Nota]]`) y en las propiedades del encabezado.
- **Los enlaces de Markdown** (`[texto](Nota.md)`, si apagaste «Usar [[Wikilinks]]»), en las mismas tres formas: el
  nombre solo, la ruta desde la raíz de la bóveda (con o sin `/` adelante) y la relativa; con o sin `.md`, y con los
  espacios codificados (`Mi%20nota.md`).
- **Si un enlace sirve para dos notas,** gana la que está en la raíz de la bóveda, como en Obsidian: `[[Plan]]` va a
  `Plan.md` de la raíz aunque haya otro `Plan.md` en una carpeta. Si ninguna está en la raíz, gana la que está en la
  misma carpeta que la nota que enlaza o, si el enlace lleva carpeta, la que está en esa ruta desde la raíz. Si no se
  puede decidir, el mapa lo muestra en Salud, en «Menciones ambiguas», y no como enlace roto. Obsidian, en ese caso,
  abre una de las dos sin avisar (probado con Obsidian 1.14: `[[Vivero/Plan]]`, con `Proyectos/Vivero/Plan` y
  `Archivo/Vivero/Plan`, abrió la de `Archivo`). Mirá esa lista: un enlace así puede estar llevándote a la nota vieja.
- **Los adjuntos no son notas:** `![[foto.png]]`, un PDF o un `.canvas` no cuentan como enlaces rotos, aunque el
  archivo no exista (Neuromapa no revisa los adjuntos).
- **Lo que está en código no es un enlace,** igual que en Obsidian: una nota que explica cómo se enlaza, con ejemplos
  entre comillas invertidas o en un bloque, no da avisos.
- **Nada de una carpeta con punto entra,** como en Obsidian, que no las muestra: ni `.obsidian`, ni la papelera
  `.trash` (lo que borrás no vuelve al mapa como si estuviera vivo), ni las versiones viejas que Syncthing guarda en
  `.stversions`, aunque tengas tu propia lista `podar`. Se cuenta desde la raíz de la bóveda: una bóveda adentro de
  una carpeta con punto, como la memoria de Claude bajo `~/.claude`, entra igual.
- **Las plantillas no entran.** La carpeta que elegiste en las opciones del plugin de plantillas de Obsidian
  («Settings → Templates → Template folder location»; Obsidian la guarda en `.obsidian/templates.json`) y la de
  Templater (`.obsidian/plugins/templater-obsidian/data.json`) cuentan como excluidas, aunque no estén en la lista:
  sus notas, con títulos como `{{title}}`, no entran al mapa ni a la búsqueda, y un enlace a ellas no sale como roto.
  Si cambiás la carpeta, el mapa se rearma solo. Lo que es sintaxis de plantilla (`[[{{date}}]]`,
  `[[<% tp.date.now() %>]]`) tampoco cuenta como enlace en ninguna otra nota.
- **Las copias de conflicto.** Si Obsidian Sync, Dropbox o Syncthing dejan una copia de conflicto al lado de una nota
  (`Nota (Conflicted copy …).md`, `Nota.sync-conflict-….md`), el médico la avisa y dice cuál es la buena: juntá lo
  que sirva en esa y borrá la copia. Mientras tanto, en la memoria, un `[[enlace]]` lleva a la buena, porque manda el
  nombre del archivo (como en Obsidian) aunque la copia tenga el mismo `name:`.
- **Lo que excluiste en Obsidian tampoco entra.** Neuromapa lee la lista de archivos excluidos de la bóveda
  («Settings → Files and links → Excluded files»; Obsidian la guarda en `.obsidian/app.json`): cada carpeta o
  archivo de la lista, contado desde la raíz de la bóveda, y cada expresión entre barras (`/borrador/`). Los dibujos
  de Excalidraw (`.excalidraw.md`) tampoco entran: por dentro son datos del dibujo, no texto. Un enlace a algo que
  quedó afuera no sale como roto, porque en Obsidian sigue andando. Si cambiás la lista, el mapa se rearma solo.
- **Los alias y las etiquetas.** Neuromapa lee las propiedades como las guarda Obsidian (una lista, un valor por
  renglón). Los `aliases:` cuentan como otros nombres de la nota: `--sobre` y la pista la encuentran por ellos.
  Las etiquetas salen de `tags:` y de los `#tema` del texto (fuera de código); también ayudan a encontrar la nota, se
  ven en su panel y arman un filtro «Etiquetas» en la columna del mapa, como el de Grupos. Fuera de una bóveda, y en la
  memoria de Claude aunque la abras como bóveda, un `#algo` suelto en el texto no cuenta como etiqueta (ahí suelen ser
  colores o anclas), pero `tags:` en el encabezado sí.

Lo que todavía no hace: las etiquetas no unen notas en el mapa (son un filtro) y los `.canvas` no se leen. Un alias no
sirve como destino de un enlace: cuando elegís un alias, Obsidian escribe `[[Nota|alias]]`, y esa forma sí anda. Si
le cambiaste el nombre a la carpeta de configuración (la opción para usar otra en vez de `.obsidian`), Neuromapa no
encuentra la lista de archivos excluidos ni saltea esa carpeta: sumala a `podar` en `config.json`.
Escribir `podar` reemplaza la lista de fábrica, así que repetila entera: `node_modules`, `.git`, `.next`, `dist`,
`bin`, `obj`, `.claude`, `__pycache__`, `.venv`, `venv`, `.obsidian` y `.trash`.

### Los avisos del médico con una bóveda grande

El médico está pensado para la memoria de Claude. En una bóveda con diarios, notas crudas y archivo, el aviso «Ninguna
nota la nombra… Claude no la va a encontrar sola» sale por cientos de notas que están bien así. Para eso:

- **`"huerfanas": false` en la fuente** (como en el ejemplo): sus notas no dan ese aviso, no cuentan en «N de M notas no
  se alcanzan» y no aparecen entre las huérfanas de Salud. Siguen sirviendo de camino para llegar a otras notas.
- **`"registro": true` en una fuente de diarios o actas:** sus enlaces rotos no se marcan, porque nombran cosas que ya
  cambiaron.
- **`"historico": true` en una fuente de archivo:** el médico no les revisa rutas, enlaces ni anclas, porque son viejas
  a propósito.

Si algo de tu bóveda no se lee bien, abrí un issue: estas mejoras salieron de los issues
[#2](https://github.com/lumiel777/neuromapa/issues/2) y [#3](https://github.com/lumiel777/neuromapa/issues/3), que
reportó iwoyeri con una bóveda de 1.068 notas.
