# X Ray — radiografía de salud financiera dentro de Embat

X Ray mide, explica y anticipa la salud financiera de las empresas de una cartera a partir de sus movimientos bancarios, sus facturas y su deuda. Cada empresa recibe cada mes un **score de 0 a 100** y un estado en lenguaje llano (*sana*, *mejorando*, *estable*, *torciéndose*, *cayendo* o *no evaluable*), junto con los motivos que lo explican, lo que ha cambiado desde el mes anterior, la acción que conviene tomar y un mapa de quién mueve dinero con quién.

Todo se consulta desde un panel web con la apariencia de Embat, se pregunta en español a **TellMe**, el asistente integrado, y se exporta como informe PDF redactado para quien lo va a leer.

Proyecto construido en 36 horas por un equipo de cinco personas para [HackSpain 2026](https://hackspain.com) (Madrid, 18-20 de septiembre). Los datos de la demo son sintéticos: ninguna conclusión se refiere a empresas reales.

## Qué problema resuelve

Quien gestiona una cartera de cientos de empresas no puede revisar cada cuenta bancaria, cada factura y cada préstamo todos los meses. Los problemas se detectan tarde: cuando la caja ya está en negativo, cuando una cuota de deuda ha dejado de pagarse o cuando una empresa arrastra a las demás de su grupo.

X Ray convierte esos datos en una lectura mensual por empresa:

- **Un número y un estado**, para ordenar la cartera de un vistazo y distinguir a quien está mal pero mejorando de quien está bien pero cayendo.
- **Una explicación con cifras**, para no fiarse de una caja negra: qué pesa en el score, en qué periodo y con qué evidencia.
- **Una acción**, para saber qué hacer y en qué módulo de Embat hacerlo.
- **Alertas** cuando una empresa cambia de estado, ordenadas de peor a mejor.
- **Un grafo de relaciones** que muestra los flujos entre empresas inferidos de los datos, para ver cajas comunes, quién financia a quién y a qué empresas se está expuesto.
- **Un informe por rol** y **un asistente** que responde solo con datos que existen.

## Cómo se usa: recorrido típico

1. **Entra.** La página inicial presenta el producto; el botón *Empezar* (o *Login*) lleva a la pantalla **¿Con qué rol quieres entrar?**
2. **Elige tu rol.** Tres tarjetas: **Tesorero** (cliente: sigue la caja de su propia empresa), **Financiero** (equipo Embat: ve toda la cartera, compara, recorre el grafo y prepara informes) y **Ventas** (equipo Embat: prioriza clientes por salud financiera con el contexto listo para la conversación). El rol decide qué ves y cómo te habla el producto. Para cambiar de rol se vuelve a la pantalla de entrada.
3. **Aterriza en la Radiografía** de una empresa, en la pestaña **Informe**. Financiero y Ventas tienen arriba el buscador *Buscar entre N empresas*; el Tesorero ve solo su empresa.
4. **Busca una empresa** por nombre (*Talleres Ribera*) o por identificador (*COMP_0176*). Cada resultado muestra su estado y variación del mes si tiene alerta. Con *Comparar* añades hasta tres empresas al mismo gráfico.
5. **Lee las cuatro tarjetas**: *Score* con su estado y variación frente al mes anterior, *Δ 3 meses*, *Δ 6 meses* y *Alertas del mes* de toda la cartera. Debajo, **Evolución del score** con rango *6M / 12M / 24M*, el marcador *hoy*, los meses con alerta señalados y una proyección por tendencia a tres meses con su rango.
6. **Profundiza en las pestañas**: *Informe*, *Acción*, *Por qué*, *Qué cambió* y *Grupo* (si la empresa pertenece a uno).
7. **Pregunta a TellMe** desde el pie de la barra lateral: qué empresas han empeorado, cómo está un grupo, compara dos empresas, exporta un informe o si una empresa puede asumir un pedido.
8. **Abre el Grafo** (Analítica → Grafo, solo equipo Embat) para ver las relaciones entre empresas, filtrarlas y saltar desde cualquier nodo a su radiografía.
9. **Exporta el informe completo** en PDF desde la pestaña Informe o pidiéndoselo a TellMe.
10. **Carga datos nuevos** (Analítica → *Cargar datos*, solo equipo Embat) cuando llegue un extracto nuevo de Embat: los ficheros se suman a los anteriores y la pantalla indica si el score ya los refleja.

## Funcionalidades

### Score y estado mensual

El score compara los cobros operativos frente a los pagos de los últimos tres meses y lo ajusta por comisiones, devoluciones y momento de la tendencia. El estado resume la trayectoria; la etiqueta de **evidencia** (alta, media, baja) indica cuánto fiarse del dato según los meses observados y el volumen de movimientos. Una empresa con menos de tres meses observados aparece como *no evaluable*.

### Radiografía

Vista principal de cada empresa: cabecera con identificador, mes, meses observados y nivel de evidencia; las cuatro tarjetas de KPIs; el gráfico de evolución con comparador; y las pestañas de detalle.

### Informe por rol

Redactado automáticamente para el rol activo, con un titular, el score y párrafos bajo cabeceras distintas según quién lo lee:

| Rol | Cabeceras del informe |
|---|---|
| Tesorero | Qué ha cambiado · Qué podemos esperar · Ten en cuenta · Qué conviene revisar |
| Financiero | Por qué tiene esta puntuación · Cómo interpretar los próximos meses · Hasta dónde llega esta lectura · Qué comprobar antes de decidir |
| Ventas | Qué explica su situación · Qué podemos esperar · Ten en cuenta · Cómo abordar la conversación |

El texto pasa un control automático: cada cifra debe existir en los datos y no puede hablar de solvencia, crédito, impago o fraude. Si el redactor falla el control, se muestra una versión determinista construida directamente de las cifras. En pantalla se ve el resumen; *Exportar informe completo* abre el PDF con todas las secciones y la tabla de escenario de tendencia a tres meses (base, favorable, adverso). La primera generación de un informe puede tardar entre 20 y 40 segundos.

### Acción

Una frase con lo que conviene hacer y dónde hacerlo dentro de Embat, por ejemplo *Abrir la previsión de tesorería a 13 semanas y revisar los pagos comprometidos*, o *Sin acción: mantener el seguimiento mensual* cuando la empresa está sana.

### Por qué

Los factores que explican el score con su peso en puntos, la cifra observada y el periodo (*Cobros 0 € frente a pagos 31.884 € en 2026-06 a 2026-08*), los eventos activos (*E1 Tensión de caja: tres meses pagando más de lo que cobra*) y la ficha de evidencia: ventana, transacciones, porcentaje sin categoría, fuentes usadas, facturas vencidas y versión de la regla.

### Qué cambió

Qué componentes han subido o bajado el score respecto al mes anterior, para localizar el origen de una variación.

### Grupo

Para las empresas de un grupo: todas sus hermanas con score, estado y cuota de la deuda del grupo, la deuda total y un aviso cuando el grupo está en tensión. Desde aquí se salta a la radiografía de cualquiera de ellas.

### Comparador

Hasta tres empresas superpuestas en el gráfico, alineadas por mes. Se activa desde el buscador, desde el grupo o pidiéndoselo a TellMe. Con más de una empresa el detalle se oculta hasta volver a una sola.

### Alertas

Empresas cuyo estado ha cambiado en el último mes, ordenadas de peor a mejor y con el factor que explica cada cambio. Hay tres tipos: empeoran, mejoran y se recuperan. Alimentan la tarjeta *Alertas del mes*, los puntos rojos del gráfico, el buscador y las respuestas de TellMe.

### Grafo de relaciones

El grafo dibuja las empresas de la cartera y los vínculos entre ellas que se deducen de los datos. Cada nodo es una empresa, coloreada por su estado y con tamaño proporcional a sus relaciones; un halo de color marca el grupo al que pertenece. Cada línea es una relación de uno de tres tipos:

| Tipo | Qué significa | Cómo se detecta |
|---|---|---|
| **Pago inferido** | Una empresa parece haber pagado a otra: reconstruye historial de pagos, no una deuda | Un cargo en la cuenta de A coincide, al céntimo y con pocos días de diferencia, con un abono en la cuenta de B, de forma repetida (*espejo bancario*); o una factura emitida por A aparece como factura de compra en B (*espejo de facturas*) |
| **Obligación abierta** | Una empresa debe hoy un saldo a otra a través del banco interno del grupo | Dos líneas de crédito del *In-house bank* con saldos espejo (+N / −N) dentro del mismo grupo (*espejo de deuda*) |
| **Contraparte compartida** | Dos empresas operan con los mismos proveedores o clientes externos: sugiere vínculo comercial, no un pago entre ellas | Mismo identificador de contraparte en movimientos de ambas |

Cada relación lleva además un **subtipo** que dice de qué tipo de flujo se trata: *caja común* (barrido de saldos, típico del cash pooling), *financiación de línea de crédito*, *nóminas por cuenta de otra*, *impuestos por cuenta de otra*, *transferencia de fondos*, *pago comercial*, *otros flujos*, *factura de venta y compra*, *línea de banco interno*, *traspaso de cartera de clientes* (una empresa deja de operar con diez o más contrapartes justo cuando otra empieza) y *proveedor o cliente compartido*.

Cada relación tiene una **confianza** (*alta*, *media*, *baja*) según cuántas coincidencias la respaldan, si se corrobora en dos fuentes y si es dentro del grupo o entre grupos; las coincidencias entre grupos distintos exigen condiciones más estrictas. Las contrapartes compartidas son siempre de confianza baja salvo el traspaso de cartera. El **ámbito** distingue *intragrupo* de *intergrupo*.

Qué se puede hacer en la pantalla:

- **Filtrar** por tipo, confianza mínima, ámbito, grupo, estado de la empresa y nombre, y decidir si se muestran las empresas sin relaciones (*Ver aisladas*). El contador *N empresas, M relaciones* se actualiza con cada filtro.
- **Moverse**: acercar, alejar y restablecer la vista; las empresas más conectadas llevan su nombre rotulado.
- **Pasar el ratón** por un nodo (nombre, grupo, número de relaciones, score y estado) o por una línea (origen → destino, tipo y subtipo, confianza, número de coincidencias, ámbito, importe y periodo, evidencia).
- **Hacer clic** en una empresa para abrir su tarjeta con la lista de relaciones visibles y el botón *Ver gráfico*, que lleva a su radiografía.

Para qué sirve:

- Localizar la **tesorería central** de un grupo: la empresa con halo grueso que concentra los pagos inferidos de tipo *caja común*.
- Ver **quién financia a quién** dentro de un grupo mediante obligaciones abiertas y financiación de línea.
- Detectar **servicios compartidos** (nóminas o impuestos pagados por otra sociedad).
- Medir la **exposición** a una empresa que está cayendo: filtrar por estado *cayendo* y mirar con quién mueve dinero.
- Descubrir vínculos **entre grupos** distintos que no aparecen en ninguna estructura declarada.

Qué no afirma el grafo. Toda relación es **inferida**; el producto nunca la presenta como obligación verificada ni confirma la identidad de la contraparte, y así lo indica en cada tooltip (*inferida, identidad del proveedor sin confirmar*). Un pago inferido reconstruye el pasado; solo una obligación abierta describe un saldo pendiente, y aun así es un espejo de saldo, no un contrato. Compartir contraparte o grupo no es un pago. Tener una relación no implica riesgo de impago. Cuando falta evidencia la respuesta correcta es "relación no determinable", y TellMe está instruido para decirlo.

### TellMe, el asistente

Chat en español que responde con cifras y periodos de los datos cargados, nunca inventados, en tres o cuatro frases. Al abrirse resume el mes (*2026-08: 258 alertas, 153 empresas empeoran y 72 se recuperan*) y ofrece sugerencias según el rol. Sabe:

- Dar el **score** de una empresa, **explicar** por qué, decir **qué cambió** y desde cuándo.
- **Comparar** hasta tres empresas: la pantalla añade sus líneas al gráfico.
- Listar **alertas** (qué empresas han empeorado o se han recuperado) y describir un **grupo**.
- Contar las **relaciones** de una empresa, recordando siempre que son inferidas.
- **Exportar el informe** de una empresa: devuelve el enlace al PDF y la pantalla se sitúa en esa empresa.
- Evaluar un **compromiso**: ante *¿Puedo aceptar un pedido de 50.000 € con un 30 % de anticipo?* prepara un borrador con los importes y fechas que le has dado y, una vez confirmados, compara la operación con la caja histórica de la empresa como escenario de continuidad. Nunca reserva dinero, presta ni aprueba nada; es una simulación que requiere revisión humana. El formulario de revisión en pantalla está desactivado en esta versión.

Cada respuesta muestra primero la herramienta que ha usado (*alerts*, *compare*, *relations*…) para que se vea de dónde salen los datos. Ventas recibe respuestas sin lenguaje interno de riesgo.

### Cargar datos

Entrada de la barra lateral para el equipo Embat (Financiero y Ventas). Permite arrastrar o elegir los CSV de un extracto nuevo de Embat: `companies`, `groups`, `banking_products`, `transactions`, `invoices`, `debt_products` y `balances`. El sistema reconoce cada fichero por su nombre, comprueba que tiene las columnas necesarias y guarda el lote.

**Los datos son aditivos**: cada subida se suma a las anteriores; nada se borra ni se sustituye. La pantalla muestra el historial de lotes (fecha, ficheros, filas) y un aviso de estado: *Pendiente de recalcular* cuando hay datos subidos posteriores al último cálculo del score, o *Score al día* cuando el cálculo ya los incluye. El recálculo lo ejecuta un operador (ver *Actualizar los datos* más abajo); en cuanto termina, el aviso cambia solo.

### Acceso para otros agentes (MCP)

Las capacidades de TellMe (score, explicación, qué cambió, mapa de grupo, comparación, alertas, relaciones, simulación, compromisos e informe) se exponen como servidor MCP en `/mcp`, para conectarlas a otros asistentes.

### Backtest

Medida de la capacidad predictiva de las alertas sobre grupos reservados que no se usaron al calibrar, con sus huecos de datos y etapas. Disponible en `/api/backtest`.

### En preparación

Las entradas *Inicio, Conectividad, Transacciones, Tesorería y previsiones, Contabilidad, Pagos* y *Automatización* de la barra lateral reproducen el menú de Embat y están marcadas como *Próximamente*.

## Roles

| Rol | Qué ve | Para qué |
|---|---|---|
| **Tesorero** (cliente) | Su empresa: radiografía, informe y TellMe | Entender su situación y actuar dentro de Embat |
| **Financiero** (equipo Embat) | Toda la cartera, buscador, comparador, grafo, carga de datos | Priorizar dónde profundizar y detectar exposiciones |
| **Ventas** (equipo Embat) | Toda la cartera, grafo, carga de datos; informes y respuestas sin lenguaje de riesgo | Llegar a cada conversación con el contexto listo |

## Puesta en marcha

### Requisitos

- [Bun](https://bun.sh) 1.4
- [uv](https://docs.astral.sh/uv/) y Python 3.13 o superior, solo para calcular los scores
- Una cuenta de Cloudflare con `wrangler` autenticado para TellMe, el control del informe y la exportación a PDF; el resto funciona sin conexión

### Instalación

```bash
bun install
cp apps/agent/.dev.vars.example apps/agent/.dev.vars
```

Para activar el control de calidad del informe, rellena `TYPESAFE_API_KEY` en `apps/agent/.dev.vars`.

### Cargar los datos por primera vez

X Ray parte de siete CSV exportados de Embat: `companies`, `groups`, `banking_products`, `transactions`, `invoices`, `debt_products` y `balances`. Colócalos en `pipeline/data` y calcula scores y relaciones:

```bash
cd pipeline
uv run xray score --data data --out artifacts
uv run xray relations --data data --out artifacts
cd ..
bun --filter @hackspain/agent load -- --local
```

### Arrancar

```bash
bun run dev
```

Abre <http://localhost:5173>. Pulsa *Empezar*, elige un rol y entra.

### Comprobar

```bash
curl http://localhost:8787/health
curl "http://localhost:8787/companies?limit=5"
```

### Actualizar los datos

Cuando el equipo suba extractos nuevos desde *Cargar datos*, un operador descarga todo lo acumulado, recalcula y recarga:

```bash
bun --filter @hackspain/agent pull -- --url http://localhost:8787 --out ../../pipeline/data
cd pipeline
uv run xray score --data data --out artifacts
uv run xray relations --data data --out artifacts
cd ..
bun --filter @hackspain/agent load -- --local
```

El comando `pull` une todos los lotes en los siete CSV (una sola cabecera por fichero). Contra staging o producción, sustituye `--url` por la dirección del agente desplegado y `--local` por `--env staging`. Al terminar, la pantalla *Cargar datos* pasa a *Score al día*.

## Preguntas frecuentes

**¿De dónde sale el score?**
De los movimientos bancarios, las facturas y la deuda de cada empresa en una ventana de tres meses. La pestaña *Por qué* muestra cada factor con su cifra y su periodo.

**¿Por qué una empresa aparece como "no evaluable"?**
Porque no tiene al menos tres meses observados o no hay suficientes movimientos en la ventana. La evidencia baja avisa de lo mismo cuando el dato existe pero es frágil.

**¿Las relaciones del grafo son deudas reales?**
No. Se infieren de movimientos que se reflejan entre dos empresas. Sirven para entender la estructura y detectar exposiciones, no como prueba de una obligación.

**¿TellMe puede inventarse cifras?**
Está instruido para responder solo con lo que devuelven sus herramientas y para decir que un dato no está disponible. Los informes pasan además un control de coherencia con las cifras.

**¿El informe es una evaluación crediticia?**
No. Es un índice orientativo de salud de tesorería, así lo indica el propio PDF, y no constituye una evaluación de solvencia ni una previsión.

**He subido datos y el score no cambia.**
Es lo esperado: la subida guarda los ficheros y el score se recalcula con el comando de *Actualizar los datos*. Hasta entonces la pantalla *Cargar datos* marca *Pendiente de recalcular*.
