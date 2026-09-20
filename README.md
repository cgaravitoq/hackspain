# X Ray: radiografía de salud financiera dentro de Embat

X Ray mide, explica y anticipa la salud financiera de cada empresa de una cartera a partir de sus movimientos bancarios, sus facturas y su deuda.
Cada empresa recibe cada mes un **score de 0 a 100** y un estado en lenguaje llano (*sana*, *mejorando*, *estable*, *torciéndose*, *cayendo* o *no evaluable*), junto con los motivos que lo explican, lo que ha cambiado desde el mes anterior, la acción que conviene tomar y un mapa de quién mueve dinero con quién.
Todo se consulta desde un panel web con la apariencia de Embat, se pregunta en español a **TellMe**, el asistente integrado, y se exporta como informe PDF redactado para quien lo va a leer.

Proyecto construido en 36 horas por un equipo de cinco personas para [HackSpain 2026](https://hackspain.com) (Madrid, 18-20 de septiembre), en el reto de Embat.
Los datos de la demo son sintéticos: ninguna conclusión se refiere a empresas reales.

## Pruébalo

| Entorno | Panel web | Servidor MCP |
|---|---|---|
| Producción | <https://hackspain-web.carlos-garavito.workers.dev> | `https://hackspain-agent.carlos-garavito.workers.dev/mcp` |
| Staging | <https://hackspain-web-staging.carlos-garavito.workers.dev> | `https://hackspain-agent-staging.carlos-garavito.workers.dev/mcp` |

Pulsa *Empezar*, elige un rol y entra.
No hace falta cuenta ni contraseña.

## Qué problema resuelve

Quien gestiona una cartera de cientos de empresas no puede revisar cada cuenta bancaria, cada factura y cada préstamo todos los meses.
Los problemas se detectan tarde: cuando la caja ya está en negativo, cuando una cuota de deuda ha dejado de pagarse o cuando una empresa arrastra a las demás de su grupo.

X Ray convierte esos datos en una lectura mensual por empresa:

- **Un número y un estado**, para ordenar la cartera de un vistazo y distinguir a quien está mal pero mejorando de quien está bien pero cayendo.
- **Una explicación con cifras**, para no fiarse de una caja negra: qué pesa en el score, en qué periodo y con qué evidencia.
- **Una acción**, para saber qué hacer y en qué módulo de Embat hacerlo.
- **Alertas** cuando una empresa cambia de estado, ordenadas de peor a mejor.
- **Un grafo de relaciones** que muestra los flujos entre empresas inferidos de los datos: cajas comunes, quién financia a quién y a qué empresas se está expuesto.
- **Un informe por rol** y **un asistente** que responde solo con datos que existen.

## Recorrido en cinco minutos

1. **Entra.** La página inicial presenta el producto; *Empezar* (o *Login*) lleva a la pantalla **¿Con qué rol quieres entrar?**
2. **Elige tu rol.** **Tesorero** (cliente: sigue la caja de su propia empresa), **Financiero** (equipo Embat: toda la cartera, comparador, grafo e informes) o **Ventas** (equipo Embat: prioriza clientes por salud financiera con el contexto listo para la conversación). El rol decide qué ves y cómo te habla el producto.
3. **Aterriza en la Radiografía** de una empresa, en la pestaña **Informe**. Financiero y Ventas tienen arriba el buscador *Buscar entre N empresas*; el Tesorero ve solo su empresa.
4. **Busca una empresa** por nombre (*Talleres Ribera*) o por identificador (*COMP_0176*). Con *Comparar* añades hasta tres empresas al mismo gráfico.
5. **Lee las cuatro tarjetas**: *Score* con estado y variación mensual, *Δ 3 meses*, *Δ 6 meses* y *Alertas del mes* de toda la cartera. Debajo, **Evolución del score** con rango *6M / 12M / 24M*, el marcador *hoy*, los meses con alerta señalados y una proyección por tendencia a tres meses.
6. **Profundiza en las pestañas** *Informe*, *Acción*, *Por qué*, *Qué cambió* y *Grupo*.
7. **Pregunta a TellMe** desde el pie de la barra lateral: qué empresas han empeorado, cómo está un grupo, compara dos empresas, exporta un informe o si una empresa puede asumir un pedido.
8. **Abre el Grafo** (Analítica → Grafo, solo equipo Embat) para ver las relaciones entre empresas, filtrarlas y saltar desde cualquier nodo a su radiografía.
9. **Exporta el informe completo** en PDF desde la pestaña Informe o pidiéndoselo a TellMe.

## Funcionalidades

### Score y estado mensual

El score compara los cobros operativos frente a los pagos de los últimos tres meses y lo ajusta por comisiones, devoluciones y momento de la tendencia.
El estado resume la trayectoria; la etiqueta de **evidencia** (alta, media, baja) indica cuánto fiarse del dato según los meses observados y el volumen de movimientos.
Una empresa con menos de tres meses observados aparece como *no evaluable*.

### Radiografía

Vista principal de cada empresa: cabecera con identificador, mes, meses observados y nivel de evidencia; las cuatro tarjetas de KPIs; el gráfico de evolución con comparador; y las pestañas de detalle.

### Informe por rol

Redactado automáticamente para el rol activo, con un titular, el score y párrafos bajo cabeceras distintas según quién lo lee:

| Rol | Cabeceras del informe |
|---|---|
| Tesorero | Qué ha cambiado · Qué podemos esperar · Ten en cuenta · Qué conviene revisar |
| Financiero | Por qué tiene esta puntuación · Cómo interpretar los próximos meses · Hasta dónde llega esta lectura · Qué comprobar antes de decidir |
| Ventas | Qué explica su situación · Qué podemos esperar · Ten en cuenta · Cómo abordar la conversación |

El texto pasa un control automático: cada cifra debe existir en los datos y no puede hablar de solvencia, crédito, impago o fraude.
Si el redactor falla el control, se muestra una versión determinista construida directamente de las cifras.
*Exportar informe completo* abre el PDF con todas las secciones y la tabla de escenario de tendencia a tres meses (base, favorable, adverso).
La primera generación de un informe puede tardar entre 20 y 40 segundos.

### Acción, Por qué y Qué cambió

*Acción* es una frase con lo que conviene hacer y dónde hacerlo dentro de Embat, por ejemplo *Abrir la previsión de tesorería a 13 semanas y revisar los pagos comprometidos*, o *Sin acción: mantener el seguimiento mensual* cuando la empresa está sana.
*Por qué* lista los factores que explican el score con su peso en puntos, la cifra observada y el periodo, los eventos activos (*E1 Tensión de caja: tres meses pagando más de lo que cobra*) y la ficha de evidencia.
*Qué cambió* muestra qué componentes han subido o bajado el score respecto al mes anterior.

### Grupo, comparador y alertas

Para las empresas de un grupo, la pestaña *Grupo* muestra todas sus hermanas con score, estado y cuota de la deuda del grupo, y avisa cuando el grupo está en tensión.
El comparador superpone hasta tres empresas en el gráfico, alineadas por mes; se activa desde el buscador, desde el grupo o pidiéndoselo a TellMe.
Las alertas son las empresas cuyo estado ha cambiado en el último mes, ordenadas de peor a mejor y con el factor que explica cada cambio; alimentan la tarjeta *Alertas del mes*, los puntos rojos del gráfico, el buscador y TellMe.

### Grafo de relaciones

Cada nodo es una empresa, coloreada por su estado y con tamaño proporcional a sus relaciones; un halo marca el grupo al que pertenece.
Cada línea es una relación de uno de tres tipos:

| Tipo | Qué significa | Cómo se detecta |
|---|---|---|
| **Pago inferido** | Una empresa parece haber pagado a otra: reconstruye historial de pagos, no una deuda | Un cargo en la cuenta de A coincide, al céntimo y con pocos días de diferencia, con un abono en la cuenta de B, de forma repetida (*espejo bancario*); o una factura emitida por A aparece como factura de compra en B (*espejo de facturas*) |
| **Obligación abierta** | Una empresa debe hoy un saldo a otra a través del banco interno del grupo | Dos líneas de crédito del *In-house bank* con saldos espejo (+N / −N) dentro del mismo grupo |
| **Contraparte compartida** | Dos empresas operan con los mismos proveedores o clientes externos: sugiere vínculo comercial, no un pago entre ellas | Mismo identificador de contraparte en movimientos de ambas |

Cada relación lleva un **subtipo** (caja común, financiación de línea de crédito, nóminas o impuestos por cuenta de otra, pago comercial, traspaso de cartera de clientes, etc.), una **confianza** (alta, media, baja) según cuántas coincidencias la respaldan y si se corrobora en dos fuentes, y un **ámbito** (intragrupo o intergrupo).
En pantalla se filtra por tipo, confianza mínima, ámbito, grupo, estado y nombre (*Ver aisladas* muestra las empresas sin relaciones), se pasa el ratón por nodos y líneas para ver su evidencia, y un clic abre la tarjeta de la empresa con *Ver gráfico* hacia su radiografía.

Sirve para localizar la tesorería central de un grupo, ver quién financia a quién, detectar servicios compartidos, medir la exposición a una empresa que está cayendo y descubrir vínculos entre grupos que no aparecen en ninguna estructura declarada.
Toda relación es **inferida**: el producto nunca la presenta como obligación verificada ni confirma la identidad de la contraparte, y así lo indica en cada tooltip.
Cuando falta evidencia la respuesta correcta es "relación no determinable", y TellMe está instruido para decirlo.

### TellMe, el asistente

Chat en español que responde con cifras y periodos de los datos cargados, nunca inventados, en tres o cuatro frases.
Al abrirse resume el mes y ofrece sugerencias según el rol.
Sabe dar el score de una empresa, explicarlo, decir qué cambió, comparar hasta tres empresas (la pantalla añade sus líneas al gráfico), listar alertas, describir un grupo, contar las relaciones de una empresa y exportar su informe.
Ante *¿Puedo aceptar un pedido de 50.000 € con un 30 % de anticipo?* prepara un borrador con los importes y fechas indicados y compara la operación con la caja histórica de la empresa como escenario de continuidad; nunca reserva dinero, presta ni aprueba nada.
Cada respuesta muestra primero la herramienta que ha usado (*alerts*, *compare*, *relations*...) para que se vea de dónde salen los datos.
Ventas recibe respuestas sin lenguaje interno de riesgo.

### Acceso para otros agentes (MCP)

Las capacidades de TellMe se exponen como servidor MCP en `/mcp` (Streamable HTTP, sin estado) con las herramientas `score`, `explain`, `what_changed`, `group_map`, `compare`, `alerts`, `simulate`, `report`, `relations` y `simulate_commitment`.
Cualquier cliente MCP puede conectarse a la URL de la tabla de arriba.

### Backtest

Medida de la capacidad predictiva de las alertas sobre grupos reservados que no se usaron al calibrar, con sus huecos de datos y etapas.
Disponible en `/api/backtest`.

## Roles

| Rol | Qué ve | Para qué |
|---|---|---|
| **Tesorero** (cliente) | Su empresa: radiografía, informe y TellMe | Entender su situación y actuar dentro de Embat |
| **Financiero** (equipo Embat) | Toda la cartera, buscador, comparador, grafo | Priorizar dónde profundizar y detectar exposiciones |
| **Ventas** (equipo Embat) | Toda la cartera y grafo; informes y respuestas sin lenguaje de riesgo | Llegar a cada conversación con el contexto listo |

Las entradas *Inicio, Conectividad, Transacciones, Tesorería y previsiones, Contabilidad, Pagos* y *Automatización* de la barra lateral reproducen el menú de Embat y están marcadas como *Próximamente*.

## Cómo está hecho

Todo corre en Cloudflare desde una sola cuenta, TypeScript de punta a punta y Bun como único gestor de paquetes.

- **Pipeline** (`pipeline/`): Python 3.13 con polars y pandas. Lee los CSV de Embat, calcula el score de cada empresa y mes, detecta alertas, infiere las relaciones y ejecuta el backtest. Escribe artefactos JSON validados con los mismos esquemas Zod que usa el resto del producto.
- **Agente** (`apps/agent/`): Worker con [Hono](https://hono.dev). Sirve la API desde D1 (una fila por empresa con la serie completa como JSON), genera los informes por rol, los pasa por un control de calidad, los renderiza a PDF con Browser Rendering, ejecuta TellMe sobre Workers AI (`@cf/deepseek-ai/deepseek-v4-flash-0731`) con el AI SDK y expone el servidor MCP.
- **Web** (`apps/web/`): Vue 3 + Vite con tokens de diseño de Embat, desplegada como assets estáticos de su propio Worker. Solo habla con `/api/*`, que el Worker reenvía al agente por service binding: un único origen y sin CORS.
- **Contratos** (`packages/shared/`): esquemas Zod y tipos compartidos entre pipeline, agente y web. Se valida en cada frontera y se confía en el código interno.

```
apps/agent/       Hono Worker: API, informes, TellMe, MCP
apps/web/         Vue 3 + Vite, assets estáticos de un Worker que proxya /api al agente
packages/shared/  Esquemas Zod y tipos compartidos
pipeline/         Scorer en Python (uv + polars): score, alertas, relaciones, backtest
.agents/skills/   Skills del equipo para Claude Code, Codex, OpenCode y Cursor
```

## Puesta en marcha

### Requisitos

- [Bun](https://bun.sh) 1.4 (`packageManager` en `package.json` fija la versión exacta).
- [uv](https://docs.astral.sh/uv/) y Python 3.13 o superior, solo para calcular los scores.
- Una cuenta de Cloudflare con `wrangler login` hecho para TellMe y la exportación a PDF, que usan bindings remotos de Workers AI y Browser Rendering. El resto, incluido `bun run verify`, funciona sin conexión.

### Instalación

```bash
bun install
cp apps/agent/.dev.vars.example apps/agent/.dev.vars
```

`TYPESAFE_API_KEY` en `apps/agent/.dev.vars` activa el control de calidad del informe; sin ella el informe se genera igual y el control se marca como no disponible.

### Cargar los datos

X Ray parte de siete CSV exportados de Embat: `companies`, `groups`, `banking_products`, `transactions`, `invoices`, `debt_products` y `balances`.
Colócalos en `pipeline/data` (gitignorado) y calcula scores y relaciones:

```bash
cd pipeline
uv run xray score --data data --out artifacts
uv run xray relations --data data --out artifacts
cd ..
bun --filter @hackspain/agent load -- --local
```

`score` escribe `companies.json`, `alerts.json`, `groups.json`, `backtest.json`, `meta.json` y `scores/<id>.json`; `relations` escribe `relations.json`.
`load` valida los artefactos con los esquemas compartidos, aplica las migraciones y carga la D1 local.

### Arrancar

```bash
bun run dev
```

Agente en <http://localhost:8787>, web en <http://localhost:5173> con `/api` proxyado.
Abre la web, pulsa *Empezar*, elige un rol y entra.

### Comprobar

```bash
curl http://localhost:8787/health
curl "http://localhost:8787/companies?limit=5"
bun run verify
```

### Comandos

| Comando | Qué hace |
|---|---|
| `bun run dev` | `wrangler dev` para el agente y `vite` para la web, en paralelo |
| `bun run verify` | Todo lo que ejecuta CI, en el mismo orden: formato, lint, typecheck, tests y deploy en seco |
| `bun run test` | Vitest por workspace; los tests del agente corren dentro de workerd y nunca tocan la red |
| `cd pipeline && uv run pytest` | Tests del pipeline |
| `bun --filter @hackspain/agent load -- --env staging` | Carga los artefactos en la D1 de staging |

## API

Todas las rutas se sirven desde el agente y, en la web, bajo `/api`.

- `GET /health`, `/meta`, `/backtest`, `/graph`.
- `GET /companies?state&group_id&limit`, `/companies/:id`, `/companies/:id/explain`, `/companies/:id/relations`, `/companies/:id/simulate`, `/companies/:id/commitment-context`.
- `GET /companies/:id/report`, `/companies/:id/report.html`, `/companies/:id/report.pdf`.
- `GET /compare`, `/groups/:id`, `/alerts?kind&limit`.
- `POST /chat` transmite la respuesta de TellMe con el AI SDK.
- `ALL /mcp` sirve el servidor MCP.

## Límites

- El extracto de HackSpain es sintético y su diccionario de datos no documenta el significado de `payment_date` ni un libro de asignación factura a movimiento, así que las ejecuciones sobre él no validan nada sobre empresas reales.
- El score mide flujos operativos, no solvencia: el producto no habla de crédito, impago ni fraude, y el control de calidad del informe lo impide.
- Las relaciones del grafo son inferidas de coincidencias entre datos; no son obligaciones verificadas ni identidades confirmadas.
- La evaluación de compromisos es una simulación que requiere revisión humana.

## Para el equipo

1. Toma una issue de Linear y muévela a In Progress; el webhook crea `hsp-<n>-<slug>` desde `staging`.
2. `git fetch origin && git checkout hsp-<n>-<slug>` y trabaja en commits pequeños con Conventional Commits.
3. Abre una PR a `staging`; CI en verde y una aprobación. El squash merge despliega staging.
4. El owner promociona `staging` a `main` por PR; el merge despliega producción.

Los deploys corren en GitHub Actions con `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID` como secretos del repositorio y terminan con un smoke test de `/health`.
Las migraciones de D1 no las aplica el deploy: se ejecutan a mano con `wrangler d1 migrations apply`.
Invariantes, convenciones y detalles: [`AGENTS.md`](AGENTS.md).
