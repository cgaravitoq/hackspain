# Sistema de Credit Scoring de Salud de Tesorería
## Estado actual — 19 de septiembre de 2026

> Este documento describe únicamente lo que el código de este repositorio hace hoy,
> ejecutado contra el extracto real de datos en
> `/home/juan/Descargas/output_hackspain_data/output`. No describe planes ni
> funcionalidad futura. Todas las cifras de este documento, salvo que se indique lo
> contrario, proceden de una ejecución real de `run_scoring.py`, `run_alerts.py`,
> `run_forecast.py` y `copilot.py` contra ese extracto con la configuración actual
> (`src/config.yaml` v2.0.0, `alert_config.yaml` alerts-v1.0.0).
>
> **Nota sobre los artefactos versionados en el repositorio:** los ficheros bajo
> `results/companies/*.json` (incluidos `COMP_0216.json`, `COMP_0874.json`,
> `COMP_0114.json`) son un artefacto **antiguo**, generado con `rule_version:
> "v1.0.0"`, anterior a la introducción de `windows`, `comparison_horizons`,
> `drift_detection`, `component_summary` y `window_usage` en `score_engine.py`. No
> tienen los campos que exige el código actual (`validate_report` los rechazaría). El
> conjunto que sí corresponde al motor actual está en
> `results-v2-agent6-20260919/companies/*.json` y en `results/demo/copilot_*.txt`
> (generados con `rule_version: "v2.0.0-w3-h9"`). Se ha verificado que una ejecución
> nueva de `run_scoring.py` contra el extracto real reproduce exactamente
> `results-v2-agent6-20260919/companies/COMP_0216.json` (mismos `base_score`,
> `trajectory`, `component_summary`, `drift_detection`, etc.). El recorrido completo
> de la Sección 9 usa por tanto los datos del motor v2, que son los que el código
> actual produce.

---

### 1. Qué es este sistema

Es un motor determinista, basado en reglas, que calcula un índice de 0 a 100 de
"salud de tesorería" para cada empresa a partir de su historial de transacciones
bancarias, más una capa de alertas evidenciadas, una proyección condicional a 3
meses y un generador de informes en español que solo reordena y traduce hechos ya
calculados, sin inventar análisis. Resuelve el problema de dar visibilidad
explicable y trazable sobre el comportamiento de caja operativa reciente de una
empresa (entradas/salidas, devoluciones, comisiones, servicio de deuda) y su
tendencia, sin depender de un buró de crédito ni de datos externos.

Lo que **no** es, explícitamente:
- No es un score de un buró de crédito (no hay metodología FICO/Experian, ni
  comparación contra una población de resultados de préstamos).
- No es una probabilidad de impago calibrada. Nada aquí se ha validado contra
  resultados reales de repago o impago.
- No es un modelo de decisión de crédito probado ni asesoramiento financiero: es un
  prototipo de hackathon, pensado para demostrar scoring explicable sobre datos de
  transacciones reales.
- No usa machine learning para el score en sí: los cuatro componentes y sus pesos
  son una política declarada en `src/config.yaml`, no algo entrenado o ajustado a
  los datos. La única regresión del sistema es la lineal simple usada en el
  proyector a 3 meses (Sección 6), y ni siquiera esa decide el score observado.

---

### 2. Datos de entrada

**Ficheros leídos** (desde el directorio pasado en `--data-dir`, p. ej.
`/home/juan/Descargas/output_hackspain_data/output`):

- `transactions.csv` — la única fuente de eventos. Columnas usadas:
  `transaction_id`, `company_id`, `product_id`, `date`, `amount`, `category`
  (`src/data_pipeline.py:TRANSACTION_COLUMNS`). La columna de fecha de contabilización
  usada es `date`; la columna `value_date` del extracto **nunca se lee** porque llega
  hasta el año 2099 (comentario explícito en el código).
- `banking_products.csv` y `debt_products.csv` — de ambas solo se leen `product_id`
  y `currency`; se unen para construir un mapa `product_id -> currency` que decide
  qué transacciones son EUR.

**Columnas y su significado:**
- `transaction_id`: identificador único de la fila.
- `company_id`: empresa a la que pertenece la transacción.
- `product_id`: producto bancario/de deuda que originó el movimiento; determina la
  divisa por herencia (no hay columna de divisa en `transactions.csv`).
- `date`: fecha y hora de contabilización, formato `%Y-%m-%d %H:%M:%S`.
- `amount`: importe con signo (positivo entrada, negativo salida).
- `category`: categoría de la transacción; determina si es entrada operativa,
  salida operativa, devolución, comisión, deuda/interés o si se excluye.

**Volumen real (ejecución contra el extracto completo, 19-09-2026):**

| Magnitud | Valor |
|---|---|
| Transacciones leídas (`transactions.csv`) | 2.556.437 |
| Fechas no parseables | 0 |
| Importes no parseables | 0 |
| Excluidas por caer en el mes calendario final parcial (corte) | 9.242 |
| Excluidas por producto sin divisa resuelta (`excluded_unknown_product`) | 1.314 |
| Excluidas por divisa distinta de EUR (`excluded_non_eur`) | 248.099 |
| Excluidas por categoría sin uso (`"-"` o vacía) tras aplicar el resto de filtros (`excluded_no_category`) | 494.727 |
| Excluidas por otras categorías del filtro (`cash_withdrawal`, `pos_withdrawal`, `transfer`) (`excluded_other_category`) | 167.136 |
| **Incluidas en el cálculo de features mensuales** (`included`) | **1.635.919** |

La suma de todas las exclusiones más las incluidas más el corte reproduce
exactamente las 2.556.437 filas leídas (1.314 + 248.099 + 494.727 + 167.136 +
1.635.919 + 9.242 = 2.556.437).

**El problema del 24,87% sin categoría.** Contando *todo el sistema*, antes de
aplicar el filtro de divisa o de corte de fecha, `635.860` transacciones
(`no_category_system` en `src/data_pipeline.py`, calculado como
`category.isin({"-", ""})` sobre el fichero completo) tienen categoría vacía o el
literal `"-"`. Esto es el 24,872899% de 2.556.437 filas — la cifra que la auditoría
(`audit/data_audit.md`, línea 378) documenta como `635,860 (24.872899%)`. El sistema
**no infiere** una categoría para estas filas: las excluye de todos los componentes
del score (fila `excluded_no_category` en la tabla anterior cubre la parte de esas
635.860 filas que además es EUR y anterior al corte), pero **conserva el número
exacto** en:
- El campo `evidence_records.excluded_no_category` de cada informe de empresa
  (recuento específico de esa empresa).
- Una entrada literal en `limitations` de cada informe:
  `"635860 transactions system-wide have no usable category"` — el número es
  siempre el total del sistema, no el de la empresa, y así se advierte
  explícitamente en la traducción al español que usa el copiloto
  (`src/copilot.py:LIMITATION_PATTERNS`): *"635860 transacciones del conjunto del
  sistema carecen de categoría utilizable; no es el total de esta empresa."*

**Divisas manejadas:** únicamente EUR. La divisa se hereda del producto
(`banking_products.csv` / `debt_products.csv`), nunca se declara en la propia
transacción. Cualquier transacción cuyo producto no resuelva divisa
(`excluded_unknown_product`) o cuya divisa resuelta no sea `EUR`
(`excluded_non_eur`) se descarta sin conversión de ningún tipo. No hay lógica de
tipo de cambio en ningún punto del pipeline.

**Rango de fechas:** las transacciones del extracto van del 2024-09-01 al
2026-09-01 (hora 23:37:04). El corte de scoring (`default_cutoff`) es el primer día
del mes que contiene la fecha más reciente — `2026-09-01`, exclusivo — porque ese
mes calendario está incompleto (un solo día) en el extracto y contarlo como "mes
observado" distorsionaría cualquier ventana de 3 meses. Por tanto el último mes
efectivamente observable es `2026-08`.

---

### 3. Motor de scoring — cómo se calcula la puntuación

#### 3.1 Capa 1 — Puntuación base (0–100)

Cuatro componentes, cada uno normalizado mes a mes a una escala 0–100
(`src/score_engine.py:monthly_component_scores`):

| Componente | Fórmula mensual | Peso (`config.yaml`) |
|---|---|---|
| `inflow_outflow_ratio` | `ratio = inflow / outflow` (si `outflow=0` e `inflow>0`, `ratio` se fija al tope `RATIO_CAP=2.0`; si ambos son 0, `ratio=1.0`). `score = min(ratio/2.0, 1.0) * 100` | 0.40 |
| `chargeback_score` | `chargeback_rate = nº devoluciones / nº transacciones`. `score = (1 - min(chargeback_rate * 20, 1)) * 100` | 0.25 |
| `fee_score` | `fee_ratio = comisiones / volumen operativo total`. `score = (1 - min(fee_ratio * 10, 1)) * 100` | 0.20 |
| `debt_score` | `debt_interest_ratio = (repago deuda + intereses) / volumen operativo total`. `score = (1 - min(debt_interest_ratio * 5, 1)) * 100` | 0.15 |

`base_score` es la media ponderada de estos cuatro componentes sobre las **últimas
3 observaciones mensuales**, no sobre los últimos 3 meses de calendario: si una
empresa no tuvo ninguna transacción operativa EUR en, por ejemplo, marzo, ese mes
no existe como fila y la ventana de "3 meses" salta directamente al mes anterior con
datos. El código lo señala explícitamente con la limitación `"observations span
calendar gaps; windows use observed months without zero filling"` cuando detecta
huecos.

Un mes sin ninguna transacción **no se materializa nunca como fila de ceros**: no
existe en la tabla de features (`aggregate_monthly` solo agrupa transacciones que
existen). Un mes con transacciones que netean a cero sí se conserva como un cero
genuino. Esta distinción se aplica en `src/data_pipeline.py` y está documentada en
el docstring del módulo.

#### 3.2 Capa 2 — Trayectoria

Se comparan dos ventanas, ambas configurables en `config.yaml` mediante `windows` y
`comparison_horizons`. Con los valores actuales:

- Ventana primaria (`primary`): tamaño `windows.short = 3` meses observados
  recientes frente a los 3 meses observados inmediatamente anteriores.
- Ventana de deriva larga (`drift_detection`): tamaño `windows.long = 9` meses
  frente a los 9 anteriores (ver 3.5).
- Existe también una ventana `medium = 6` declarada en `config.yaml`, pero **no
  está asignada a ningún `comparison_horizon`** en la configuración actual (solo
  `primary` y `drift_detection` están mapeados), así que hoy no se usa en ningún
  cálculo.
- `min_months_for_window = 4`: hacen falta al menos 4 meses observados para que
  exista *cualquier* comparación (recent + al menos 1 mes de baseline); si no,
  `trajectory = "insufficient_data"`.

`delta = weighted(recent_average) - weighted(baseline_average)` (media ponderada
con los mismos pesos del `base_score`). Con el `delta` calculado:

- `delta > 2.0` (`thresholds.improving`) → `"improving"`
- `delta < -2.0` (`thresholds.deteriorating`) → `"deteriorating"`
- en cualquier otro caso → `"stable"`
- si no hay suficiente historial para construir el delta → `"insufficient_data"`

El umbral de 2.0 puntos es una política declarada: el comentario en
`config.yaml` la describe como "el cambio más pequeño que sobrevive a un mes
ruidoso dentro de una media de tres meses"; no es un valor ajustado
estadísticamente.

#### 3.3 Capa 3 — Persistencia

`_persistence()` repite la misma comparación (mismo tamaño de ventana `primary`)
un "trimestre" atrás en el calendario de meses observados: toma los 3 meses justo
antes de la ventana `baseline` actual como su propia ventana "recent", y los 3
antes de esos como su "baseline", y calcula la misma dirección. Si esa dirección
anterior **coincide** con la dirección actual → `"confirmed"`; si no coincide, o no
hay suficiente historial para repetir la comparación, o la dirección actual ya era
`"stable"`/`"insufficient_data"` → `"unconfirmed"`.

Esto es lo que impide que un solo mes malo dispare una "deterioración": para que
`persistence == "confirmed"` la misma tendencia (mejora o deterioro) tiene que
verse en dos comparaciones consecutivas de 3 meses, no en una sola. El propio motor
documenta la limitación de este diseño en cada informe cuando aplica:
`"persistence windows share the baseline quarter; the two comparisons are
consecutive endpoints, not independent samples"` — es decir, las dos comparaciones
comparten el trimestre intermedio, así que la confirmación es evidencia
corroborante, no dos muestras estadísticamente independientes.

`persistence == "confirmed"` es la única condición bajo la que la Capa 2 puede
mover el score final; `"unconfirmed"` implica ajuste `0.0` aunque haya un `delta`
distinto de cero.

#### 3.4 Capa 4 — Confianza

Calculada en `_confidence()`:
- `months_available`: número total de meses observados de esa empresa (filas en la
  tabla de features).
- `months_complete`: cuántos de esos meses tuvieron al menos `complete_month = 10`
  transacciones (umbral declarado, `"not validated"` según su propio comentario en
  `config.yaml`: la auditoría no encontró un mes-empresa completo verificado contra
  el que calibrarlo).
- `coverage_pct = months_complete / months_available`, redondeado a 2 decimales.
- `currency_scope`: siempre `"EUR_only"`.

Esta capa **nunca resta puntos al score**: solo describe cuánta evidencia hay
detrás del número. Se usa exclusivamente como entrada de una alerta
(`LOW_COVERAGE`, Sección 5) y como contexto informativo en los informes.

#### 3.5 Detección de deriva a largo plazo

`drift_detection` repite la misma mecánica de la Capa 2 pero con la ventana larga
(`windows.long = 9` meses recientes contra 9 anteriores) en vez de la primaria.
Vive en paralelo a la trayectoria primaria y **no sustituye** el `trajectory`
principal: es una segunda lectura, con horizonte más largo, del mismo delta
ponderado.

Se emite un campo `drift_alert` (a nivel del informe de empresa, no solo de la
alerta) únicamente cuando la trayectoria primaria es `"stable"` o `"improving"`
**pero** la trayectoria de deriva larga es `"deteriorating"`: ese es el caso en el
que un lector que solo mirara los últimos 3 meses vería una imagen sana mientras
el horizonte de 9 meses ya muestra deterioro. Si la trayectoria primaria ya es
`"deteriorating"`, no hace falta un `drift_alert` adicional porque la Capa 2 ya lo
está señalando.

#### 3.6 Score final

```
raw_adjustment = clamp(delta, -max_adjustment, +max_adjustment)   si persistence == "confirmed"
raw_adjustment = 0.0                                              si persistence == "unconfirmed"

final_score = clamp(base_score + raw_adjustment, 0, 100)
trajectory_adjustment = final_score - base_score   (recalculado tras el clip a [0,100])
```

`max_adjustment = 10` (`config.yaml`): un trimestre confirmado nunca puede mover el
score en más de 10 puntos, "de forma que una tendencia confirmada no pueda mover a
una empresa más de un nivel por sí sola" (comentario del fichero de configuración).

`base_score` y `trajectory_adjustment` se exportan **siempre por separado** (nunca
solo el `final_score`) porque son evidencia de naturaleza distinta: el primero
describe el nivel absoluto reciente; el segundo, si ese nivel viene subiendo o
bajando de forma confirmada. Mezclarlos en un único número impediría distinguir
"empresa sana y estable" de "empresa mediocre pero mejorando con fuerza confirmada",
que pueden terminar con el mismo `final_score`.

---

### 4. Parámetros configurables

**`src/config.yaml` (política de scoring, versión `v2.0.0`):**

| Parámetro | Valor actual | Qué controla | Cómo cambiarlo de forma segura |
|---|---|---|---|
| `version` | `"v2.0.0"` | Sello de versión grabado en `rule_version` de cada informe. | Incrementar siempre que se cambie cualquier valor de esta tabla; los informes viejos y nuevos quedan distinguibles. |
| `windows.short` | 3 | Tamaño (en meses observados) de la ventana primaria de trayectoria. | Entero positivo; `min_months_for_window` debe seguir siendo coherente con el nuevo tamaño. |
| `windows.medium` | 6 | Declarado pero no referenciado por ningún `comparison_horizon` actual. | Sin efecto mientras no se asigne a `primary` o `drift_detection`. |
| `windows.long` | 9 | Tamaño de la ventana de detección de deriva. | Igual que `short`; cambia cuántos meses hacen falta para evaluar `drift_detection`. |
| `comparison_horizons.primary` | `short` | Qué ventana define `trajectory`/`persistence`/`trajectory_adjustment`. | Debe seguir apuntando a una clave existente en `windows`. |
| `comparison_horizons.drift_detection` | `long` | Qué ventana define `drift_detection`/`drift_alert`. | Igual. |
| `evaluation_frequency` | `monthly` | Única frecuencia soportada; el código lanza `ValueError` con cualquier otro valor. | No cambiar sin reescribir `score_engine.py`. |
| `min_months_for_window` | 4 | Mínimo de meses observados para que exista cualquier comparación de trayectoria. | Entero ≥ 2; validado en `Config.__post_init__`. |
| `weights.inflow_outflow_ratio` | 0.40 | Peso del componente de flujo en `base_score`. | Los 4 pesos deben sumar exactamente 1.0 (tolerancia 1e-9) y ser no negativos; `load_config` lo valida al cargar. |
| `weights.chargeback_score` | 0.25 | Peso del componente de devoluciones. | Igual. |
| `weights.fee_score` | 0.20 | Peso del componente de comisiones. | Igual. |
| `weights.debt_score` | 0.15 | Peso del componente de servicio de deuda. | Igual. |
| `thresholds.improving` | 2.0 | Umbral de delta por encima del cual la trayectoria es `improving`. | Debe permanecer positivo. |
| `thresholds.deteriorating` | -2.0 | Umbral de delta por debajo del cual la trayectoria es `deteriorating`. | Debe permanecer negativo. |
| `thresholds.complete_month` | 10 | Mínimo de transacciones para que un mes cuente como "completo" en `confidence`. | Entero ≥ 1; declarado como no validado contra ningún patrón real. |
| `thresholds.max_adjustment` | 10 | Tope absoluto del ajuste de trayectoria. | Debe estar en `(0, 10]`. |
| `categories.*` | Listas de categorías por bucket (operativas, devoluciones, comisiones, deuda, excluidas) | Documentación de qué categoría alimenta qué componente; también fija el filtro duro de fila en `data_pipeline.py`. | Cambiar esto cambia qué se considera actividad "operativa" para **todas** las empresas: tratar como cambio de política de scoring, no como cosmético, y re-ejecutar todo el lote. |

**`alert_config.yaml` (política de alertas, versión `alerts-v1.0.0`):**

| Parámetro | Valor actual | Qué controla | Cómo cambiarlo de forma segura |
|---|---|---|---|
| `severity_order` | `[HIGH, MEDIUM, LOW, INFO]` | Orden de clasificación de alertas en la salida agregada. | Debe coincidir exactamente con esa lista; el validador lo compara literal. |
| `rules.DETERIORATION_CONFIRMED.trajectory` | `deteriorating` | Condición categórica que dispara la alerta. | Debe ser uno de los 4 valores válidos de `trajectory`. |
| `rules.DETERIORATION_CONFIRMED.persistence` | `confirmed` | Segunda condición categórica. | Debe ser `confirmed` o `unconfirmed`. |
| `rules.DRIFT_DETECTED.delta_threshold` | -2.0 | Umbral del delta de `drift_alert` por debajo del cual se dispara. | Debe ser negativo. |
| `rules.INSUFFICIENT_DATA.min_months_threshold` | 4 | Nº mínimo de meses de `confidence.months_available`; por debajo, se dispara. | Entero ≥ 0. |
| `rules.STALE_DATA.max_age_months` | 3 | Nº máximo de meses de antigüedad de `latest_observed_month` respecto a `scoring_date`; por encima, se dispara. | Entero ≥ 0. |
| `rules.LOW_COVERAGE.coverage_threshold` | 0.5 | Umbral de `confidence.coverage_pct` por debajo del cual se dispara. | Número en `[0, 1]`. |
| `rules.SCORE_FLOOR.score_threshold` | 40 | Umbral de `final_score` por debajo del cual se dispara. | Número en `[0, 100]`. |

Cada severidad (`HIGH`/`MEDIUM`/`LOW`/`INFO`) está fijada por tipo de alerta en el
propio código (`SEVERITIES` en `src/alerts.py`) y `validate_config` obliga a que el
YAML declare exactamente esa severidad para cada regla; no se puede reasignar una
severidad distinta sin tocar el código.

**Proyección (`src/forecaster.py`, sin fichero YAML propio):** `min_months` por
defecto es 12 y `validate_min_months` impide bajar de ese valor aunque se pase por
`--min-months`; es un piso "duro" en el código, no una opción de configuración.

---

### 5. Sistema de alertas automáticas

Las alertas se evalúan sin recalcular el score (`src/alerts.py:evaluate_batch`),
leyendo exclusivamente los informes de empresa ya escritos por `run_scoring.py`.
Cada alerta detectada lleva su propia evidencia (`evidence`, lista de punteros JSON
al campo exacto del informe que la disparó), de modo que cada alerta es trazable al
byte.

| Alerta | Severidad | Condición exacta del disparo | Campo del JSON que la dispara | Significado en español llano |
|---|---|---|---|---|
| `DETERIORATION_CONFIRMED` | HIGH | `trajectory == "deteriorating"` **y** `persistence == "confirmed"` | `/trajectory`, `/persistence` | La empresa lleva dos comparaciones trimestrales seguidas empeorando: no es un mes suelto. |
| `DRIFT_DETECTED` | MEDIUM | Existe `drift_alert` (es decir, la trayectoria reciente es estable/mejora pero la ventana de 9 meses ya deteriora) **y** su `delta < -2.0` | `/drift_alert/delta`, `/drift_detection/delta`, `/drift_detection/periods_compared` | Los últimos 3 meses parecen bien, pero mirando 9 meses la salud de tesorería ya viene cayendo. |
| `INSUFFICIENT_DATA` | INFO | `confidence.months_available < 4` | `/confidence/months_available` | No hay suficiente historial para calcular ninguna trayectoria fiable. Es informativo, no una señal de riesgo. |
| `STALE_DATA` | MEDIUM | `scoring_date` menos `latest_observed_month` (en meses de calendario) `> 3` | `/latest_observed_month`, `/scoring_date` | El dato más reciente de la empresa tiene más de 3 meses de antigüedad respecto a la fecha de evaluación: el score describe actividad pasada, no salud actual. |
| `LOW_COVERAGE` | LOW | `confidence.coverage_pct < 0.5` | `/confidence/coverage_pct` | Menos de la mitad de los meses disponibles tienen actividad suficiente (≥10 transacciones) para considerarse "completos". |
| `SCORE_FLOOR` | HIGH | `final_score < 40` | `/final_score` | El índice de salud de tesorería está por debajo del umbral configurado como suelo de atención. |

Cuando una alerta no se puede evaluar (p. ej. `drift_detection` ausente o
`coverage_pct` nulo porque la empresa no tiene score), se registra como
"diagnóstico" (`status: "unevaluable"`) en vez de omitirse en silencio.

**Resultado real de la última ejecución** (`run_alerts.py` contra el extracto
completo, fecha de generación `2026-09-19`):

| Tipo de alerta | Severidad | Recuento |
|---|---|---|
| `DETERIORATION_CONFIRMED` | HIGH | 87 |
| `DRIFT_DETECTED` | MEDIUM | 266 |
| `INSUFFICIENT_DATA` | INFO | 139 |
| `STALE_DATA` | MEDIUM | 75 |
| `LOW_COVERAGE` | LOW | 331 |
| `SCORE_FLOOR` | HIGH | 4 |
| **Total HIGH** | | 91 |
| **Total MEDIUM** | | 341 |
| **Total LOW** | | 331 |
| **Total INFO** | | 139 |
| **Total, todas las alertas** | | **902** |

(1.286 empresas evaluadas en total; una empresa puede acumular varias alertas.)

---

### 6. Predicción a 3 meses

#### 6.1 Requisitos mínimos de datos

`validate_min_months()` en `src/forecaster.py` impone un piso duro: **al menos 12
meses operativos EUR observados**, y el valor no puede bajar de 12 aunque se pida
por CLI (`ValueError` inmediato). Por debajo de 12, `forecast_status =
"insufficient_data"`: no se calcula ningún escenario, método ni MAE; el JSON de
salida deja `scenarios`, `method_per_component` y `baseline_vs_regression`
explícitamente vacíos/`null`, nunca rellenos con ceros. El campo `reason` explica
la cuenta exacta, p. ej. `"11 observed EUR operational months; 12 required; 1
months missing"`.

Con 12 a 17 meses: `forecast_status = "low_confidence"`, `confidence = "low"`. Con
18 meses o más: `forecast_status = "ok"`, `confidence = "medium"`. El código nunca
produce un nivel de confianza "alto": el máximo declarado es `"medium"`.

En la ejecución real contra el extracto completo (`run_forecast.py`, umbral por
defecto de 12 meses): de 1.286 informes de empresa, 746 cumplen el umbral operativo
(de 1.167 con `final_score` calculado); el resultado final por empresa fue
`insufficient_data`: 540, `low_confidence`: 169, `ok`: 577.

#### 6.2 Método de predicción

Por cada uno de los 4 componentes normalizados, `fit_component()`:
1. Reserva los últimos 3 meses observados como conjunto de *held-out* (no se usan
   para entrenar el modelo que se compara).
2. Ajusta una **regresión lineal simple** (mínimos cuadrados, `numpy.linalg.lstsq`)
   sobre los meses anteriores a esos 3, usando el ordinal de mes calendario como
   variable explicativa, y predice esos 3 meses reservados.
3. Calcula una **línea base ingenua** ("naive"): la media constante de los 3 meses
   justo antes del bloque reservado (es decir, los meses `[-6:-3]`).
4. Compara el MAE (error absoluto medio) de cada método contra los 3 valores reales
   reservados. **Gana el de menor MAE; en caso de empate, gana la línea naive.**
5. Con el método ganador ya elegido, reentrena (regresión) o recalcula (media de
   los últimos 3 meses reales, esta vez del historial completo) para producir la
   predicción real de los 3 meses futuros (`t+1`, `t+2`, `t+3` desde `scoring_date`).

Esta comparación de solo 3 observaciones reservadas **selecciona** el método, no lo
**valida**: así lo dice literalmente una de las limitaciones exportadas
(`"Linear regression is a candidate method; only three held-out observations are
used for method selection, not validation"`).

Los pesos usados para combinar los 4 componentes proyectados en un score son
**exactamente los mismos** `config.weights` que en el score observado
(`inflow_outflow_ratio 0.40 / chargeback_score 0.25 / fee_score 0.20 / debt_score
0.15`): no hay recalibración de pesos entre lo observado y lo proyectado, y esto
también se declara como limitación explícita.

#### 6.3 Tres escenarios

Para cada componente se calcula `historical_std` (desviación estándar muestral,
`ddof=1`, de todo el historial observado de ese componente). Los tres escenarios
son perturbaciones aditivas sobre la predicción base, recortadas a `[0, 100]`:

- **Base:** la predicción del método ganador (regresión o naive), sin perturbar.
- **Favorable:** `predicción_base + historical_std` por componente.
- **Adverso:** `predicción_base - historical_std` por componente.

`historical_std` es una desviación estándar histórica del propio componente, **no**
un intervalo de confianza estadístico ni un percentil calibrado: los escenarios son
"perturbaciones de entrada, no límites de probabilidad calibrados", según la
limitación exportada literalmente. Cada mes proyectado de cada escenario se
reintroduce en el mismo motor de score (`score_component_history`) junto al
historial real, de modo que el `final_score`, `trajectory` y `persistence`
proyectados salen del mismo cálculo que un mes observado real habría producido —
pero siguen siendo condicionales, no observaciones.

El sistema **no afirma**:
- Que estos escenarios sean intervalos de probabilidad calibrados.
- Que el ajuste no lineal del motor (recorte a `[0,100]`, el propio umbral de
  trayectoria) preserve el orden entre escenarios (`adverso < base < favorable`)
  en todos los casos — se declara explícitamente que puede no hacerlo.
- Que las proyecciones representen saldos de caja o probabilidades de impago: son
  únicamente componentes normalizados 0–100.

#### 6.4 Limitaciones de la predicción

Las siguientes limitaciones están codificadas literalmente en
`FORECAST_LIMITATIONS` (`src/forecaster.py`) y se añaden a **todos** los informes
de proyección, traducidas por el copiloto (`src/copilot.py:EXACT_LIMITATIONS`):

- "El método no está validado externamente."
- "Los índices proyectados usan los mismos pesos que los observados, sin
  recalibración."
- "Los escenarios favorable y adverso se basan en la desviación estándar
  histórica, no en un modelo causal."
- "La regresión lineal es un método candidato; solo tres observaciones reservadas
  seleccionan el método, no lo validan."
- "Se proyectan componentes normalizados, no saldos de caja ni probabilidades de
  impago."
- "No se modela la estacionalidad: no hay ajuste estacional ni predictor
  estacional estimado."
- "Los escenarios modifican las entradas, no son límites de probabilidad
  calibrados; los ajustes no lineales del motor pueden cambiar el orden de sus
  índices."
- "Las ventanas usan todo el historial observado original más las proyecciones
  explícitas; no hay meses puente ocultos ni relleno con ceros; las filas
  proyectadas no son evidencia observada."

Además, según el caso concreto de cada empresa, el forecaster añade limitaciones
dinámicas (también verbatim, traducidas igual): historial corto (12–17 meses,
confianza baja), huecos de calendario en las observaciones operativas, historial
operativo desactualizado, meses objetivo demasiado lejos del último mes operativo,
selección del método naive por empate o mejor MAE, y recorte de componentes al
intervalo `[0, 100]`.

---

### 7. Copiloto de advisory

**Entrada:** exactamente dos ficheros JSON por empresa —
`results/companies/<company_id>.json` (el informe de score, con `rule_version`
que debe empezar por `v2.` y debe incluir `alerts`, generado por `run_scoring.py` +
`run_alerts.py`) y `results/forecasts/<company_id>.json` (generado por
`run_forecast.py`). `load_artifacts()` exige que ambos existan, que no sean enlaces
simbólicos, que estén dentro del directorio de resultados indicado, y que pasen
`validate_artifacts()`: una comprobación cruzada exhaustiva (mismos
`company_id`/`scoring_date`/`rule_version`/`data_cutoff`/`latest_observed_month`
en ambos, pesos consistentes, ventanas consistentes, alertas con evidencia que
apunta a valores reales del propio informe, etc.). Si algo no cuadra, el copiloto
falla con `CopilotError` en vez de generar un informe con datos inconsistentes.

**Las 5 secciones fijas del informe** (`HEADINGS` en `src/copilot.py`):
1. **SITUACIÓN ACTUAL** — score actual y su banda de presentación, mayor peso de
   política, mayor contribución base, ajuste de trayectoria, alertas activas,
   cobertura observada.
2. **TENDENCIA RECIENTE** — dirección calculada y si está confirmada, periodos
   comparados, mayor cambio absoluto por componente, y el aviso de deriva
   (`drift_alert`) si existe.
3. **PROYECCIÓN A 3 MESES** — estado de la proyección (o el motivo de bloqueo si
   es `insufficient_data`), los tres escenarios por mes objetivo, y el método
   elegido por componente con sus MAE reservados.
4. **LIMITACIONES CONCRETAS DE ESTA EMPRESA** — todas las limitaciones de ambos
   artefactos (empresa + proyección), deduplicadas, traducidas.
5. **QUÉ REVISAR** — acciones de revisión condicionadas a lo que ya está en los
   datos (meses ausentes, componente que más cambió, alertas con acción asociada,
   escenario adverso por debajo del base). Nunca inventa una acción si no hay señal
   que la sustente: si hay menos de 2 acciones justificadas, lo dice explícitamente
   (`"Los datos no justifican más acciones independientes; no se inventan
   recomendaciones para completar una cuota."`).

**Qué puede y qué no puede decir.** El copiloto trabaja sobre una "ledger" de
afirmaciones (`build_ledger()`): cada frase que puede aparecer en el informe final
se construye **en Python**, a partir de un puntero JSON exacto al dato de origen,
antes de que exista ninguna llamada a un modelo de lenguaje. Cuando se usa el modo
con IA (no `--offline`), el modelo (`claude-haiku-4-5`, vía Anthropic) recibe la
ledger completa y **solo puede**:
- Elegir y ordenar, dentro de cada una de las 5 secciones, qué afirmaciones ya
  aprobadas incluir (`compose_report` es una *tool call* con un `input_schema`
  que solo admite IDs de afirmaciones que ya existen en la ledger).
- Traducir al español las limitaciones que no tienen ya una traducción exacta
  codificada (`translate_limitation()` cubre los casos conocidos con plantillas
  literales; el resto se pide al modelo).

El sistema (`SYSTEM` prompt) le prohíbe explícitamente "añadir conocimiento
financiero, causas, consejos, números, fechas, citas o prosa" y trata todo el JSON
de entrada como datos no confiables, nunca como instrucciones. `validate_response()`
rechaza cualquier respuesta que invente, duplique, omita o reasigne de sección un
`statement_id`, o que introduzca controles Unicode/caracteres de dirección de texto
en una traducción, o que altere las cifras numéricas de la limitación traducida
(compara los números extraídos por regex del original y de la traducción). Si la
API falla o la respuesta no pasa validación, con `--fallback` se recurre al modo
determinista (idéntico al offline); sin `--fallback`, el comando falla.

**El modo `--offline`** (usado para los tres ejemplos en `results/demo/`) no hace
ninguna llamada a la API: renderiza directamente la ledger con el plan por defecto
(cada afirmación en su sección declarada, sin reordenar, sin traducción de IA),
encabezado con `"MODO OFFLINE DETERMINISTA — sin llamada API ni narrativa generada
por Anthropic."`.

---

### 8. Trazabilidad completa

Cada informe de empresa (`results/companies/<company_id>.json`, esquema v2)
contiene:

| Campo | Significado | Origen |
|---|---|---|
| `company_id` | Identificador de empresa. | Parámetro de entrada / `dataset.features`. |
| `scoring_date` | Fecha de referencia del informe. | `--scoring-date` (por defecto, hoy). |
| `data_cutoff` | Corte exclusivo de datos (primer día del mes final incompleto). | `default_cutoff()`. |
| `rule_version` | `"{version}-w{primary_window}-h{drift_window}"`, p. ej. `v2.0.0-w3-h9`. | `Config.rule_version`, deriva de `config.yaml`. |
| `base_score` | Media ponderada de los 4 componentes en la ventana reciente. | Capa 1. |
| `trajectory` | `improving` / `deteriorating` / `stable` / `insufficient_data`. | Capa 2. |
| `persistence` | `confirmed` / `unconfirmed`. | Capa 3. |
| `trajectory_adjustment` | Puntos aplicados sobre `base_score`. | Capa 3 + tope ±10. |
| `final_score` | `base_score + trajectory_adjustment`, recortado a [0,100]. | Sección 3.6. |
| `signals` | Por componente: `change` (delta bruto recent−baseline) y `contribution` (puntos que aportó al ajuste final, reescalados si el ajuste se recortó). | `score_component_history`. |
| `periods_compared.recent` / `.baseline` | Los meses ISO exactos usados en la comparación primaria. | Capa 2. |
| `primary_delta` | El delta ponderado sin redondear ni recortar. | Capa 2. |
| `latest_observed_month` | Último mes con datos, en formato `YYYY-MM`. | `months[-1]`. |
| `component_summary.<componente>.{weight, recent_average, base_contribution}` | Peso de política, media normalizada reciente, y su contribución (`weight * recent_average`) al `base_score`. | Capa 1, exportado en v2. |
| `window_usage.{primary, drift_detection}` | Tamaño configurado vs. meses realmente usados a cada lado, y si hubo `fallback_used` (ventana acortada por falta de historial). | Capa 2 / 3.5. |
| `drift_detection` | Estado (`ok`/`insufficient_data`), delta, trayectoria y periodos de la ventana larga. | Capa 3.5. |
| `drift_alert` | Presente solo si la trayectoria primaria es sana pero la larga deteriora por debajo del umbral. | Capa 3.5. |
| `confidence.{months_available, months_complete, coverage_pct, currency_scope}` | Evidencia de cantidad/calidad de historial. | Capa 4. |
| `evidence_records.{count, date_range, excluded_*}` | Nº de transacciones que alimentaron el score, su rango de fechas, y cuántas de las de *esta empresa* se excluyeron y por qué. | `score_company()`. |
| `alerts` | Lista de alertas disparadas, cada una con su propia evidencia (`pointer`/`value`) apuntando a un campo exacto de este mismo JSON. | `run_alerts.py`, añadido tras el scoring. |
| `limitations` | Lista de avisos en texto llano, en inglés en el artefacto crudo, aplicables específicamente a esta empresa y a esta ejecución. | Acumulada en `score_engine.py` y `data_pipeline.py`. |

Cada score, por tanto, se puede rastrear hasta: el conjunto exacto de meses
comparados (`periods_compared`), el número exacto de transacciones detrás de esos
meses (`evidence_records.count`), y el peso y contribución exactos de cada
componente (`component_summary`). Nada se computa "por arte" sin dejar un campo
correspondiente en el JSON.

---

### 9. Flujo completo — ejemplo real (`COMP_0216`, mejora confirmada)

Todos los números de esta sección proceden de una ejecución real del pipeline
contra `/home/juan/Descargas/output_hackspain_data/output`, que reproduce byte a
byte `results-v2-agent6-20260919/companies/COMP_0216.json` y el texto de
`results/demo/copilot_COMP_0216.txt`.

**PASO 1 — Carga de datos**

`build_dataset()` lee las 2.556.437 filas de `transactions.csv`. Para `COMP_0216`
en particular, la tabla de exclusiones (`dataset.exclusions.loc["COMP_0216"]`) da:

- `excluded_unknown_product`: 0
- `excluded_non_eur`: 0
- `excluded_no_category`: 3.430
- `excluded_other_category`: 146 (`cash_withdrawal`/`pos_withdrawal`/`transfer`)

Es decir, todas las transacciones de `COMP_0216` son EUR y de producto conocido;
solo se descartan por categoría sin uso o excluida. El `evidence_records.count`
final del informe es **2.105** transacciones, cubriendo `2026-03` a `2026-08`
(la ventana usada para las comparaciones de trayectoria, no todo el historial).

**PASO 2 — Agregación mensual**

`aggregate_monthly()` produce 20 filas (meses observados) para `COMP_0216`, de
`2025-01` a `2026-08` (`confidence.months_available = 20`). Extracto real de la
tabla de features (columnas seleccionadas):

| Mes | Entradas op. | Salidas op. | Devoluciones | Transacciones | Comisiones | Repago deuda + intereses |
|---|---:|---:|---:|---:|---:|---:|
| 2026-03 | 196.516,83 € | 222.821,55 € | 0 | 252 | 1.501,98 € | 540.566,42 € |
| 2026-04 | 84.511,14 € | 319.365,30 € | 0 | 338 | 1.579,19 € | 157.889,67 € |
| 2026-05 | 126.169,26 € | 282.011,53 € | 2 | 319 | 1.356,60 € | 68.861,28 € |
| 2026-06 | 89.301,08 € | 361.253,98 € | 0 | 389 | 2.213,74 € | 14.520,18 € |
| 2026-07 | 264.121,75 € | 422.906,73 € | 0 | 397 | 2.342,12 € | 63.208,81 € |
| 2026-08 | 540.823,98 € | 527.534,83 € | 0 | 410 | 2.737,40 € | 60.360,75 € |

Todos los 20 meses tienen ≥10 transacciones, de ahí `months_complete = 20` y
`coverage_pct = 1.0` (100%).

**PASO 3 — Cálculo del score base**

Con las fórmulas de la Sección 3.1, el motor calcula, para cada mes, los 4
componentes normalizados (por ejemplo, agosto de 2026:
`inflow_outflow_ratio=51,26`, `chargeback_score=100,00`, `fee_score=97,44`,
`debt_score=71,75`). Promediando la ventana reciente (`2026-06, 2026-07, 2026-08`):

| Componente | Media reciente | Peso | Contribución (`weight × recent_average`) |
|---|---:|---:|---:|
| `inflow_outflow_ratio` | 31,6155 | 0,40 | 12,6462 |
| `chargeback_score` | 100,0000 | 0,25 | 25,0000 |
| `fee_score` | 96,3718 | 0,20 | 19,2744 |
| `debt_score` | 69,8785 | 0,15 | 10,4818 |
| **`base_score`** | | | **67,4024 ≈ 67,4** |

Esto coincide exactamente con `component_summary` y `base_score: 67.4` del JSON.

**PASO 4 — Trayectoria y persistencia**

- Ventana reciente: `2026-06, 2026-07, 2026-08`.
- Ventana baseline: `2026-03, 2026-04, 2026-05`.
- Media ponderada de la baseline: 54,64. `primary_delta = 67,40 − 54,64 ≈ 12,76`
  (el JSON registra `primary_delta: 12.759444545466295`).
- `12,76 > 2,0` → `trajectory = "improving"`.
- La persistencia repite la misma comparación un trimestre atrás
  (`2025-12…2026-02` vs `2025-09…2025-11`, aproximadamente) y encuentra la misma
  dirección de mejora → `persistence = "confirmed"`.

**PASO 5 — Ajuste final**

```
raw_adjustment = clamp(12.76, -10, 10) = 10.0     (persistence == "confirmed")
final_score    = clamp(67.4 + 10.0, 0, 100) = 77.4
trajectory_adjustment = 77.4 - 67.4 = 10.0
```

`base_score = 67.4`, `trajectory_adjustment = +10.0`, `final_score = 77.4` — los
tres valores exactos del JSON.

**PASO 6 — Alertas**

`COMP_0216` **no** dispara `DETERIORATION_CONFIRMED` (su trayectoria es de mejora,
no de deterioro) ni `SCORE_FLOOR` (77,4 > 40) ni `LOW_COVERAGE` (cobertura 100%) ni
`INSUFFICIENT_DATA` (20 meses ≥ 4) ni `STALE_DATA` (último mes observado, agosto de
2026, está a 1 mes de la fecha de scoring, por debajo del umbral de 3). Sí dispara
`DRIFT_DETECTED` (MEDIUM): aunque los últimos 3 meses mejoran, la ventana de 9
meses (`2025-12…2026-08` vs `2025-03…2025-11`) da un delta de `-13,918647`, por
debajo del umbral `-2.0` — la trayectoria reciente y la de largo plazo cuentan
historias distintas.

**PASO 7 — Predicción**

`COMP_0216` tiene 20 meses operativos EUR (≥18) → `confidence = "medium"`,
`forecast_status = "ok"`. Método elegido por componente (por MAE reservado más
bajo): `inflow_outflow_ratio` → naive (MAE naive 14,52 < MAE regresión 20,80),
`chargeback_score` → regresión (MAE 0 vs 4,18), `fee_score` → regresión (MAE 0,81
vs 0,85), `debt_score` → naive (MAE naive 64,66 < MAE regresión 69,74).

| Mes objetivo | Escenario base | Escenario favorable | Escenario adverso |
|---|---:|---:|---:|
| 2026-10 | 69,4 | 73,9 | 63,5 |
| 2026-11 | 80,2 | 89,4 | 58,4 |
| 2026-12 | 67,4 | 91,2 | 49,7 |

**PASO 8 — Copiloto**

Salida real de `python copilot.py --company-id COMP_0216 --results-dir
results-v2-agent6-20260919 --offline` (idéntica a
`results/demo/copilot_COMP_0216.txt`):

```
MODO OFFLINE DETERMINISTA — sin llamada API ni narrativa generada por Anthropic.

1. SITUACIÓN ACTUAL

Empresa COMP_0216; fecha 2026-09-19; reglas v2.0.0-w3-h9. [company:/company_id] [company:/scoring_date] [company:/rule_version]
Índice actual: 77.4/100; banda medio-alto. Banda descriptiva de presentación, no validada: [0,20) bajo, [20,40) medio-bajo, [40,60) medio, [60,80) medio-alto, [80,100] alto. Es un índice de salud de tesorería, no una probabilidad de impago validada ni una categoría de riesgo crediticio. Una banda alta no equivale a una alerta HIGH. [company:/final_score]
Mayor peso de política: inflow_outflow_ratio, 0.4. El mayor peso no implica la mayor contribución efectiva. [company:/component_summary/inflow_outflow_ratio/weight] [company:/component_summary/chargeback_score/weight] [company:/component_summary/fee_score/weight] [company:/component_summary/debt_score/weight]
Mayor contribución base (incluye empates): índice de devoluciones (chargeback_score); peso 0.25, media normalizada 100, contribución 25 puntos. Es el producto de peso y media, no una explicación causal. [company:/component_summary/inflow_outflow_ratio/weight] [company:/component_summary/inflow_outflow_ratio/recent_average] [company:/component_summary/inflow_outflow_ratio/base_contribution] [company:/component_summary/chargeback_score/weight] [company:/component_summary/chargeback_score/recent_average] [company:/component_summary/chargeback_score/base_contribution] [company:/component_summary/fee_score/weight] [company:/component_summary/fee_score/recent_average] [company:/component_summary/fee_score/base_contribution] [company:/component_summary/debt_score/weight] [company:/component_summary/debt_score/recent_average] [company:/component_summary/debt_score/base_contribution]
Ajuste de trayectoria separado: 10 puntos; las contribuciones de signals pertenecen a este ajuste, no al score base. [company:/trajectory_adjustment] [company:/signals]
MEDIUM — señal configurada: deterioro en la comparación larga (DRIFT_DETECTED). Valor disparador: -13.918647356475269; umbral: -2.0. No identifica por sí solo una causa empresarial. [company:/alerts/0/severity] [company:/alerts/0/alert_type] [company:/alerts/0/trigger_value] [company:/alerts/0/threshold_used]
Cobertura observada: 20 meses completos de 20 meses disponibles (100%). No es la confianza de la proyección ni su número de meses operativos elegibles. [company:/confidence/months_complete] [company:/confidence/months_available] [company:/confidence/coverage_pct]

2. TENDENCIA RECIENTE

Tendencia calculada: mejora; persistencia confirmada. Esto describe los datos observados, no el escenario futuro. [company:/trajectory] [company:/persistence]
Comparación real: 3 meses observados recientes (2026-06, 2026-07, 2026-08) frente a 3 de referencia (2026-03, 2026-04, 2026-05). No se rellenan huecos del calendario. [company:/periods_compared/recent] [company:/periods_compared/baseline] [company:/window_usage/primary]
Mayor cambio absoluto (incluye empates): índice de servicio de deuda sube, +64.6623 puntos normalizados. No son euros ni un porcentaje bruto de comisiones o devoluciones. [company:/signals/0/component] [company:/signals/0/change] [company:/signals/1/component] [company:/signals/1/change] [company:/signals/2/component] [company:/signals/2/change] [company:/signals/3/component] [company:/signals/3/change]
Aunque la comparación reciente está estable o mejora, la comparación larga se deteriora: delta -13.91864736 puntos. Recientes: 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07, 2026-08; referencia: 2025-03, 2025-04, 2025-05, 2025-06, 2025-07, 2025-08, 2025-09, 2025-10, 2025-11. Configuración: 9 meses por lado; reales: 9 y 9. [company:/trajectory] [company:/drift_alert/delta] [company:/drift_alert/periods_compared] [company:/drift_alert/window_months] [company:/drift_alert/fallback_used]

3. PROYECCIÓN A 3 MESES

20 meses operativos elegibles; confianza media, no alta. Son proyecciones condicionales de componentes, no promesas ni intervalos de probabilidad. [forecast:/forecast_status] [forecast:/observed_operational_months] [forecast:/confidence] [forecast:/metric_units]
Escenario base, 2026-10: índice 69.4; trayectoria proyectada: mejora (condicional, no alerta observada). [forecast:/forecast_months/0] [forecast:/scenarios/base/scores/0] [forecast:/scenarios/base/score_details/0/trajectory]
Escenario base, 2026-11: índice 80.2; trayectoria proyectada: mejora (condicional, no alerta observada). [forecast:/forecast_months/1] [forecast:/scenarios/base/scores/1] [forecast:/scenarios/base/score_details/1/trajectory]
Escenario base, 2026-12: índice 67.4; trayectoria proyectada: estable (condicional, no alerta observada). [forecast:/forecast_months/2] [forecast:/scenarios/base/scores/2] [forecast:/scenarios/base/score_details/2/trajectory]
Escenario favorable, 2026-10: índice 73.9; trayectoria proyectada: mejora (condicional, no alerta observada). [forecast:/forecast_months/0] [forecast:/scenarios/favorable/scores/0] [forecast:/scenarios/favorable/score_details/0/trajectory]
Escenario favorable, 2026-11: índice 89.4; trayectoria proyectada: mejora (condicional, no alerta observada). [forecast:/forecast_months/1] [forecast:/scenarios/favorable/scores/1] [forecast:/scenarios/favorable/score_details/1/trajectory]
Escenario favorable, 2026-12: índice 91.2; trayectoria proyectada: mejora (condicional, no alerta observada). [forecast:/forecast_months/2] [forecast:/scenarios/favorable/scores/2] [forecast:/scenarios/favorable/score_details/2/trajectory]
Escenario adverso, 2026-10: índice 63.5; trayectoria proyectada: mejora (condicional, no alerta observada). [forecast:/forecast_months/0] [forecast:/scenarios/adverse/scores/0] [forecast:/scenarios/adverse/score_details/0/trajectory]
Escenario adverso, 2026-11: índice 58.4; trayectoria proyectada: estable (condicional, no alerta observada). [forecast:/forecast_months/1] [forecast:/scenarios/adverse/scores/1] [forecast:/scenarios/adverse/score_details/1/trajectory]
Escenario adverso, 2026-12: índice 49.7; trayectoria proyectada: deterioro (condicional, no alerta observada). [forecast:/forecast_months/2] [forecast:/scenarios/adverse/scores/2] [forecast:/scenarios/adverse/score_details/2/trajectory]
índice de entradas/salidas: media constante de las últimas tres observaciones de entrenamiento (naive); MAE reservado de regresión 20.80396164 y naive 14.52021053 puntos normalizados. Se elige el menor MAE; los empates eligen naive. Solo tres observaciones reservadas seleccionan el método, no constituyen validación externa. Periodos reservados: 2026-06, 2026-07, 2026-08. [forecast:/method_per_component/inflow_outflow_ratio] [forecast:/baseline_vs_regression/inflow_outflow_ratio] [forecast:/backtest_periods]
índice de devoluciones: regresión lineal; MAE reservado de regresión 0 y naive 4.179728318 puntos normalizados. Se elige el menor MAE; los empates eligen naive. Solo tres observaciones reservadas seleccionan el método, no constituyen validación externa. Periodos reservados: 2026-06, 2026-07, 2026-08. [forecast:/method_per_component/chargeback_score] [forecast:/baseline_vs_regression/chargeback_score] [forecast:/backtest_periods]
índice de comisiones: regresión lineal; MAE reservado de regresión 0.8135717391 y naive 0.8490624569 puntos normalizados. Se elige el menor MAE; los empates eligen naive. Solo tres observaciones reservadas seleccionan el método, no constituyen validación externa. Periodos reservados: 2026-06, 2026-07, 2026-08. [forecast:/method_per_component/fee_score] [forecast:/baseline_vs_regression/fee_score] [forecast:/backtest_periods]
índice de servicio de deuda: media constante de las últimas tres observaciones de entrenamiento (naive); MAE reservado de regresión 69.73982872 y naive 64.66230254 puntos normalizados. Se elige el menor MAE; los empates eligen naive. Solo tres observaciones reservadas seleccionan el método, no constituyen validación externa. Periodos reservados: 2026-06, 2026-07, 2026-08. [forecast:/method_per_component/debt_score] [forecast:/baseline_vs_regression/debt_score] [forecast:/backtest_periods]

4. LIMITACIONES CONCRETAS DE ESTA EMPRESA

Se excluye la categoría transfer: no se distingue entre transferencias internas y externas. [company:/limitations/0] [forecast:/limitations/0]
635860 transacciones del conjunto del sistema carecen de categoría utilizable; no es el total de esta empresa. [company:/limitations/1] [forecast:/limitations/1]
El umbral de mes completo es 10 transacciones; no está validado. [company:/limitations/2] [forecast:/limitations/2]
Corte de scoring 2026-09-01: se excluye el último mes parcial; no se puntúa como un mes corto. [company:/limitations/3] [forecast:/limitations/3]
Las categorías de liquidación e inversión cuentan como evidencia, pero no alimentan ningún componente; la auditoría no pudo acreditar su carácter operativo. [company:/limitations/4] [forecast:/limitations/4]
Solo se consideran importes de productos denominados en EUR; no hay conversión de divisas ni actividad en otras monedas. [company:/limitations/5] [forecast:/limitations/5]
Las ventanas de persistencia comparten la ventana de referencia; las comparaciones son puntos consecutivos, no muestras independientes. [company:/limitations/6] [forecast:/scenarios/base/score_details/1/limitations/1] [forecast:/scenarios/favorable/score_details/1/limitations/1] [forecast:/scenarios/favorable/score_details/2/limitations/1] [forecast:/limitations/6]
Medias de componentes, contribuciones base y señales se exportan con cuatro decimales; las contribuciones concuerdan con la base sin redondear con tolerancia de 0.001 puntos; los deltas conservan la precisión de cálculo para los umbrales de dirección. [company:/limitations/7] [forecast:/scenarios/base/score_details/0/limitations/1] [forecast:/scenarios/base/score_details/1/limitations/2] [forecast:/scenarios/base/score_details/2/limitations/1] [forecast:/scenarios/favorable/score_details/0/limitations/1] [forecast:/scenarios/favorable/score_details/1/limitations/2] [forecast:/scenarios/favorable/score_details/2/limitations/2] [forecast:/scenarios/adverse/score_details/0/limitations/1] [forecast:/scenarios/adverse/score_details/1/limitations/1] [forecast:/scenarios/adverse/score_details/2/limitations/1] [forecast:/limitations/7]
Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/scenarios/base/score_details/0/limitations/0] [forecast:/scenarios/base/score_details/1/limitations/0] [forecast:/scenarios/base/score_details/2/limitations/0] [forecast:/scenarios/favorable/score_details/0/limitations/0] [forecast:/scenarios/favorable/score_details/1/limitations/0] [forecast:/scenarios/favorable/score_details/2/limitations/0] [forecast:/scenarios/adverse/score_details/0/limitations/0] [forecast:/scenarios/adverse/score_details/1/limitations/0] [forecast:/scenarios/adverse/score_details/2/limitations/0]
El método no está validado externamente. [forecast:/limitations/8]
Los índices proyectados usan los mismos pesos que los observados, sin recalibración. [forecast:/limitations/9]
Los escenarios favorable y adverso se basan en la desviación estándar histórica, no en un modelo causal. [forecast:/limitations/10]
La regresión lineal es un método candidato; solo tres observaciones reservadas seleccionan el método, no lo validan. [forecast:/limitations/11]
Se proyectan componentes normalizados, no saldos de caja ni probabilidades de impago. [forecast:/limitations/12]
No se modela la estacionalidad: no hay ajuste estacional ni predictor estacional estimado. [forecast:/limitations/13]
Los escenarios modifican las entradas, no son límites de probabilidad calibrados; los ajustes no lineales del motor pueden cambiar el orden de sus índices. [forecast:/limitations/14]
Las ventanas usan todo el historial observado original más las proyecciones explícitas; no hay meses puente ocultos ni relleno con ceros; las filas proyectadas no son evidencia observada. [forecast:/limitations/15]
Último mes operativo 2026-08; los meses objetivo 2026-10, 2026-11, 2026-12 están [2, 3, 4] meses de calendario después; los meses intermedios no son observaciones. [forecast:/limitations/16]
inflow_outflow_ratio: se seleccionó la media de referencia porque su MAE reservado no supera el de regresión; los empates seleccionan esa media. [forecast:/limitations/17]
debt_score: se seleccionó la media de referencia porque su MAE reservado no supera el de regresión; los empates seleccionan esa media. [forecast:/limitations/18]
Escenario condicional base, 2026-10: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/19]
Escenario condicional base, 2026-11: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/20]
Escenario condicional base, 2026-12: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/21]
Escenario condicional favorable, 2026-10: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/22]
Escenario condicional favorable, 2026-11: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/23]
Escenario condicional favorable, 2026-12: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/24]
Escenario condicional adverso, 2026-10: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/25]
Escenario condicional adverso, 2026-11: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/26]
Escenario condicional adverso, 2026-12: Hay huecos en el calendario; las ventanas usan meses observados sin rellenar ausencias con ceros. [forecast:/limitations/27]
Se recortaron componentes al intervalo [0, 100]; provenance.clipping detalla los recortes de evaluación y proyección por componente. [forecast:/limitations/28]

5. QUÉ REVISAR

Verifique los registros de índice de servicio de deuda en los periodos recientes 2026-06, 2026-07, 2026-08 frente a 2026-03, 2026-04, 2026-05; esto ya está pasando en los datos observados, pero no determina su causa. [company:/periods_compared] [company:/signals/3]
Revise por separado los periodos de la comparación larga que activan el drift; no los sustituya por la tendencia reciente. Es una señal observada, no una proyección. [company:/alerts/0]
Verifique los supuestos y componentes del escenario adverso frente al base: esto podría pasar si se cumple este escenario; no constituye una alerta de deterioro observado. [forecast:/scenarios/adverse/scores/2] [forecast:/scenarios/base/scores/2] [forecast:/historical_std_per_component]
```

---

### 10. Cómo ejecutar el sistema completo

Con el entorno virtual activado (`source .venv/bin/activate`, dependencias en
`requirements.txt`: `pandas==3.0.6`, `PyYAML==6.0.1`):

```bash
# 1. Calcular scores para todas las empresas
python run_scoring.py \
  --data-dir /home/juan/Descargas/output_hackspain_data/output \
  --output-dir ./results

# 2. Generar alertas evidenciadas (no recalcula el score)
python run_alerts.py --results-dir ./results

# 3. Calcular proyecciones a 3 meses (requiere snapshot v2 del paso 1+2)
python run_forecast.py \
  --data-dir /home/juan/Descargas/output_hackspain_data/output \
  --results-dir ./results

# 4. Explicación en texto llano de una empresa (sin IA)
python explain.py --company-id COMP_0216 --results-dir ./results

# 5. Resumen ejecutivo del portfolio completo
python explain_all.py --results-dir ./results

# 6. Informe de advisory en español, con o sin IA
python copilot.py --company-id COMP_0216 --results-dir ./results --offline
# (sin --offline, exige ANTHROPIC_API_KEY en el entorno; --fallback degrada
#  a modo determinista si la respuesta de la API no pasa validación)
```

No existe un `copilot.py` en la raíz con parámetros distintos de los descritos: es
un fino envoltorio de CLI sobre `src/copilot.py` (`load_artifacts` +
`generate_report`).

---

### 11. Lo que el sistema NO hace

- No analiza el detalle intradía o el orden temporal de las transacciones dentro
  de un mes: todo se agrega a nivel mensual.
- No usa `invoices.csv` ni `debt_schedule_config.csv` (facturas o calendario de
  deuda) para nada: la reconstrucción de historial se basa únicamente en
  `transactions.csv`.
- No maneja multi-divisa: solo EUR (`currency_scope: EUR_only`), sin conversión de
  tipo de cambio en ningún punto.
- No calcula ni afirma calcular una probabilidad de impago: el `final_score` es un
  índice de salud de tesorería de presentación, explícitamente "no validado" según
  la propia política del sistema (`PRESENTATION_POLICY` en `src/copilot.py`).
- No valida sus proyecciones contra un resultado real posterior (no hay backtesting
  contra verdad de terreno externa; el único "backtest" es interno, sobre 3 meses
  reservados del propio historial, y solo sirve para elegir método, no para
  validarlo).
- La categoría `transfer` se excluye siempre por ser ambigua (no se puede saber si
  es interna o externa a la empresa).
- El 24,87% de las transacciones del sistema (635.860 de 2.556.437) no tienen
  categoría utilizable y quedan fuera de todos los componentes del score.
- Las categorías de liquidación (`cash_settlement`, `pos_settlement`,
  `cash_settlements`) y de inversión (`investment_deployment`,
  `investment_return`) cuentan como evidencia de actividad pero **no alimentan
  ningún componente**: la auditoría no pudo acreditar que sean operativas.
- El umbral de "mes completo" (10 transacciones) y el umbral de materialidad de
  trayectoria (2,0 puntos) son convenciones declaradas, no calibradas contra
  ningún resultado real verificado.
- No ajusta estacionalidad: agosto y diciembre se señalan como meses
  potencialmente estacionales cuando caen en una ventana con deterioro, pero el
  score no se corrige por ello.
- Las dos comparaciones que confirman persistencia comparten un trimestre
  intermedio: no son muestras estadísticamente independientes, solo evidencia
  corroborante.
- El motor nunca produce un nivel de confianza de proyección "alto": el máximo es
  `"medium"` (18+ meses); por debajo de 12 meses no hay proyección en absoluto.
- El copiloto de IA nunca puede añadir una cifra, causa o recomendación que no
  esté ya en la ledger construida en Python a partir de los JSON de origen; toda
  su libertad se limita a ordenar y, en casos concretos, traducir texto ya
  aprobado.

---

### 12. Estructura de ficheros

```
credit-scoring/
├── README.md                          Documentación de uso original del proyecto (en inglés).
├── requirements.txt                   Dependencias exactas: pandas==3.0.6, PyYAML==6.0.1.
├── alert_config.yaml                  Política de alertas (severidades y umbrales), versión alerts-v1.0.0.
├── run_scoring.py                     CLI: calcula el score de todas las empresas y escribe results/companies/*.json.
├── run_alerts.py                      CLI: evalúa alertas sobre informes ya escritos, sin recalcular el score.
├── run_forecast.py                    CLI: calcula la proyección a 3 meses por empresa.
├── copilot.py                         CLI: genera el informe de advisory en español para una empresa.
├── explain.py                         CLI: explicación en texto llano de una empresa (sin IA).
├── explain_all.py                     CLI: resumen ejecutivo del portfolio completo.
│
├── src/
│   ├── __init__.py                    Marca `src` como paquete Python.
│   ├── data_pipeline.py               Carga transactions.csv, aplica el filtro de divisa/categoría y agrega a features mensuales.
│   ├── config.yaml                    Política de scoring (pesos, umbrales, ventanas), versión v2.0.0.
│   ├── score_engine.py                Las 4 capas del motor de score (base, trayectoria, persistencia, confianza) más detección de deriva.
│   ├── alerts.py                      Evaluación de alertas evidenciadas y validación de contratos de informe.
│   ├── forecaster.py                  Proyección a 3 meses (regresión/naive, escenarios, validación de contrato).
│   ├── explainer.py                   Renderiza un informe de empresa o un resumen de portfolio en texto llano (sin IA).
│   └── copilot.py                     Construcción de la ledger de evidencia, prompt a Claude, validación de la respuesta y renderizado final en español.
│
├── tests/
│   ├── test_score_engine.py           Tests del motor de score (capas 1–4, deriva).
│   ├── test_alerts.py                 Tests de reglas de alertas y validación de contrato.
│   ├── test_forecaster.py             Tests de la proyección (gate de meses, MAE, escenarios).
│   ├── test_copilot.py                Tests de la ledger, validación de artefactos y del informe renderizado.
│   └── test_parametric_scoring.py     Tests parametrizados adicionales del motor de score.
│
├── agents/                            Notas de diseño internas por "agente"/fase de construcción del sistema.
│   ├── AGENT1_data_audit.md
│   ├── AGENT2_research.md
│   ├── AGENT3_score_engine.md
│   ├── AGENT4_traceability.md
│   ├── AGENT5_cli_validation.md
│   ├── AGENT6_parametric_scoring.md
│   ├── AGENT7_alerts.md
│   ├── AGENT8_forecasting.md
│   └── AGENT9_advisory_copilot.md
│
├── audit/
│   └── data_audit.md                  Auditoría exhaustiva y literal del extracto de datos original (recuentos, nulos, divisas, categorías).
│
├── research/
│   └── github_references.md           Notas de referencias externas consultadas durante el diseño.
│
├── results/                           Salida de una ejecución de ejemplo del pipeline (formato antiguo v1.0.0 en companies/*.json).
│   ├── scores.json                    Array con todos los informes de empresa de esa ejecución.
│   ├── summary_20260919.txt           Resumen ejecutivo de portfolio de esa ejecución.
│   ├── alerts_20260919.json           Alertas agregadas de esa ejecución.
│   ├── companies/                     Un JSON por empresa (rule_version "v1.0.0", sin window_usage/drift_detection).
│   └── demo/                          Tres informes de copiloto de ejemplo (modo offline), generados contra datos v2.
│       ├── copilot_COMP_0216.txt      Caso de mejora confirmada.
│       ├── copilot_COMP_0874.txt      Caso de deterioro confirmado.
│       └── copilot_COMP_0114.txt      Caso de deterioro confirmado con cobertura baja.
│
├── results-v2-agent6-20260919/        Salida completa del motor v2 actual (rule_version "v2.0.0-w3-h9"), la que reproduce el código de hoy.
│   ├── scores.json
│   ├── summary_20260919.txt
│   ├── alerts_20260919.json
│   ├── companies/                     Un JSON por empresa con el esquema completo descrito en la Sección 8.
│   └── forecasts/                     Un JSON de proyección a 3 meses por empresa.
│
├── .venv/                             Entorno virtual Python local (no versionable en un proyecto real; presente en este entorno de trabajo).
└── .pytest_cache/, src/__pycache__/, tests/__pycache__/   Caché de herramientas, sin contenido relevante.
```
