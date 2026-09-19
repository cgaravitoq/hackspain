# Relaciones entre empresas — Investigación desde cero
## Fecha: 2026-09-19

Investigación del contenido completo, no de una muestra de filas. Datos originales: `/home/juan/Descargas/output_hackspain_data/output`. Puntuaciones: `/home/juan/hackspain/credit-scoring/results-v2-agent6-20260919/companies/`. El diccionario se leyó antes de analizar las tablas; sus definiciones se reproducen al final. El dataset es **sintético**.

**Conclusión principal:** existe pertenencia explícita empresa→grupo y solo **2 pares de empresas con contrapartes estructuradas compartidas**. No hay pagos, facturas, cuentas, préstamos ni garantías identificables entre dos `COMP_…`. Las menciones textuales amplían enormemente el grafo, pero **una mención no prueba que esa entidad sea el pagador, beneficiario, cliente o proveedor de la operación**.

Los recuentos de pares son pares no ordenados de empresas distintas, salvo donde se indica empresa→grupo. Se comparan identificadores completos, sin emparejar sufijos numéricos. Los campos vacíos nunca crean relaciones. Los pesos cuentan entidades compartidas distintas, no euros ni número de operaciones. Las capas pueden solaparse: no se deben sumar sus pares como si fueran relaciones independientes.

### HALLAZGO 1 — Pertenencia explícita a un grupo, no propiedad entre empresas
- Fichero fuente: `companies.csv` (1.286 filas) y `groups.csv` (250 filas).
- Columnas implicadas: `companies.company_id`, `companies.group_id` → `groups.group_id`; `groups.n_companies_in_sample` confirma el tamaño observado.
- Número de pares de empresas: **0 vínculos empresa→empresa explícitos**. Hay **1.286 vínculos empresa→grupo**. Se pueden contar **5.846 pares de co-miembros**, pero estos son una proyección de pertenencia, no una tabla de relaciones societarias directas.
- Direccional: sí, **empresa→grupo**. Compartir grupo es simétrico como propiedad derivada, no identifica cuál empresa posee a cuál.
- Significado económico: pertenencia al mismo grupo empresarial según el diccionario; no se conoce la matriz legal, porcentaje de participación ni garantías intragrupo.
- Usable para grafo: **sí**, como grafo bipartito o contenedor de grupo. No se exportan cliques de co-miembros como aristas empresariales directas.
- Ejemplo concreto: `COMP_0158 → GROUP_0001`, `COMP_0853 → GROUP_0001` y `COMP_0939 → GROUP_0001`. No existe una fila que diga `COMP_0158 → COMP_0853`.

Las **1.286 empresas tienen grupo** y todos los grupos resuelven: **0 empresas sin grupo**, 0 claves duplicadas de empresa o grupo y 0 discrepancias entre `n_companies_in_sample` y el recuento real. Hay **179 grupos con varias empresas**, que reúnen **1.215 empresas**, y **71 grupos de una sola empresa**, con 71 empresas. Una empresa sola en la muestra no equivale a una empresa jurídicamente independiente; por ejemplo, `COMP_1053 → GROUP_0002`.

La relación es **grupo 1→N empresas / empresa N→1 grupo**, no muchos-a-muchos. `groups.csv` no contiene `company_id`, ni identifica una matriz: el enlace está en `companies.csv`. Tamaño real de grupo: mínimo **1**, mediana **3**, máximo **22**; el diccionario indica 1–24 y mediana 2, por lo que en este punto prevalece el fichero.

### HALLAZGO 2 — Transacciones con contraparte, pero sin contraparte identificable como empresa de la muestra
- Fichero fuente: `transactions.csv`, **2.556.437 filas**, **1.286 empresas**.
- Columnas implicadas: `company_id`, `counterparty_id`, `amount`, `category`, `product_id`, `description`.
- Número de pares de empresas: **0** por coincidencia exacta de `counterparty_id` con `companies.company_id`.
- Direccional: no puede asignarse A→B entre empresas identificadas. El diccionario sí define importe negativo como salida y positivo como entrada respecto a la empresa de la fila.
- Significado económico: movimientos de una empresa frente a contrapartes anonimizadas. No existe tabla de correspondencia `COUNTERPARTY_… → COMP_…`.
- Usable para grafo: **no** como pago entre dos empresas de la muestra; sí para empresa–contraparte y para la relación de contrapartes compartidas del hallazgo 4.
- Ejemplo concreto: transacción `03a15fa458d766b1352ca54a9578cdcc`, `COMP_1062`, contraparte `COUNTERPARTY_00001`, importe `371`. Ese ID no coincide con `COMP_0001`; no se puede equiparar su identidad por el sufijo numérico.

`counterparty_id` está informado en **250.778 filas** y vacío en **2.305.659**. Hay **47.796 IDs de contraparte distintos**. No existen columnas adicionales `recipient_id`, `beneficiary_id`, `client_id` o `supplier_id`: el esquema completo está en el inventario.

Hay **152.102 filas con `category=transfer`**, de las cuales **3.219** tienen contraparte estructurada y **10.688** contienen alguna mención `COUNTERPARTY_…`; **0** resuelven a otra empresa. Por ejemplo, la transacción `031ab6668c35c6a43678d10d5105edcb`, de `COMP_1271`, por `-28933.19`, tiene categoría `transfer` y contraparte vacía. No se deducen transferencias interempresa por coincidencia de fecha/importe o por la palabra “transfer”.

Lista solicitada `(company_A, company_B, transaction_count, total_amount)`: **vacía, 0 filas**, guardada como `direct_transaction_pairs.csv` con cabecera. No es una suma de importe cero: no hay pares identificables que agregar.

### HALLAZGO 3 — Facturas/documentos con contraparte, pero sin empresa contraparte resoluble
- Fichero fuente: `invoices.csv`, **897.894 filas**, **785 empresas**.
- Columnas implicadas: `company_id`, `counterparty_id`, `operation_id`, `document_type`, `amount`, `currency`, `concept`.
- Número de pares de empresas: **0 pares directos** y **0 pares de contrapartes estructuradas compartidas dentro de facturas**.
- Direccional: no identificable entre dos empresas. El diccionario llama a la contraparte “supplier/customer”, pero no hay columna de rol y no documenta una regla de signo para distinguir esos papeles en facturas.
- Significado económico: documentos ERP propios de cada empresa, no una red cliente→proveedor reconstruible entre empresas de la muestra.
- Usable para grafo: **no** como arista de factura entre empresas; sí como incidencia empresa–contraparte y al cruzar contrapartes con transacciones.
- Ejemplo concreto: documento `00229f2507386496cf94639ebac785f3`: `COMP_0556`, `COUNTERPARTY_47797`, `amount=-720`, `currency=SEK`, `accounting_currency=DKK`. No hay empresa `COUNTERPARTY_47797` en `companies.csv`.

Hay **886.437 filas con contraparte** y **11.457 sin ella**, **124.030 contrapartes únicas** y **0 coincidencias con IDs de empresas**. Cada contraparte de la columna aparece en una única empresa dentro de este fichero. Las **501 empresas restantes no tienen filas de facturas**; esto no prueba ausencia de actividad comercial.

El fichero no contiene únicamente facturas: **760.406 filas `invoice`** y **137.488 de otros tipos**. La distribución completa está en el anexo. Tampoco hay IDs de cliente/proveedor alternativos. Lista solicitada `(company_A, company_B, invoice_count, total_amount)`: **vacía, 0 filas**, en `direct_invoice_pairs.csv`. No se suman importes de monedas distintas ni se interpreta `invoiceGroup` como un vínculo a `groups.csv`.

### HALLAZGO 4 — Contrapartes compartidas demostradas por columnas estructuradas
- Fichero fuente: `transactions.csv` (2.556.437 filas) y `invoices.csv` (897.894 filas).
- Columnas implicadas: `company_id`, `counterparty_id` en ambas tablas; espacio de contraparte común documentado.
- Número de pares de empresas: **2**, entre **4 empresas**, sustentados por **98 contrapartes distintas compartidas**.
- Direccional: **no**, A↔B por compartir contraparte. No representa un flujo de A hacia B.
- Significado económico: exposición o actividad registrada frente a una misma contraparte identificada; no implica relación comercial directa entre ambas empresas ni permite clasificar automáticamente proveedor común frente a cliente común.
- Usable para grafo: **sí**, tipo `shared_counterparty_structured`, peso = número de contrapartes únicas comunes en la unión de columnas de ambas tablas.
- Ejemplo concreto: `COMP_0977 ↔ COMP_1109` porque ambas aparecen con `COUNTERPARTY_03211` en transacciones; en toda la unión comparten **97 IDs**. Sus grupos son distintos: `GROUP_0080` y `GROUP_0205`.

| Empresa A | Empresa B | Comunes tx–tx | Comunes factura–factura | Comunes tx–factura | Unión sin duplicados | Mismo grupo |
|---|---|---|---|---|---|---|
| COMP_0354 | COMP_0909 | 1 | 0 | 0 | 1 | Sí, GROUP_0220 |
| COMP_0977 | COMP_1109 | 90 | 0 | 97 | 97 | No |

La unión tiene **129.701 IDs de contraparte**, de los cuales solo **98** aparecen con más de una empresa; ninguno con más de dos. Hay **42.125 IDs presentes en ambos ficheros**; eso no significa 42.125 relaciones entre empresas: casi todos reaparecen en la misma empresa. El cruce tx–factura añade **7 contrapartes** al par `COMP_0977`–`COMP_1109`, no añade pares nuevos.

Evidencia verificable: `COUNTERPARTY_03211` aparece en las transacciones `ca90c6b7dde6cb704dd56e6e2b8a7863` (`COMP_0977`) y `f6aab5a1f910f227df526651270f76df` (`COMP_1109`). `COUNTERPARTY_08536` aparece en `55eeed92fcd2780df687275cbf477f0e` (`COMP_0354`) y `00c6eedbf1e027f20b5c0b339f5f865f` (`COMP_0909`). `relationship_incidence.csv` conserva todas las incidencias, recuentos y un ID de registro testigo por incidencia.

### HALLAZGO 5 — Menciones textuales de contrapartes compartidas: evidencia real, rol económico incierto
- Fichero fuente: `transactions.csv` y `invoices.csv`, **3.454.331 filas en total**.
- Columnas implicadas: `company_id`, tokens exactos `COUNTERPARTY_[0-9]+` de `description`/`concept` y, en la capa mixta, `counterparty_id`.
- Número de pares de empresas: **441.633** con una coincidencia de contraparte donde al menos un extremo está sustentado por texto. La unión de todas las incidencias, incluyendo columnas, contiene **441.633 pares**, **13.964 contrapartes compartidas** y **1.260 empresas participantes**. Añade **441.631 pares** a los 2 estructurados.
- Direccional: **no**; dos empresas tienen registros que mencionan/refieren la misma contraparte, sin dirección comercial demostrada.
- Significado económico: contexto de contraparte común. Un nombre en una narrativa puede tener un papel distinto al titular económico de la operación. No se corrige ni sustituye la columna estructurada con el texto.
- Usable para grafo: **sí, únicamente como capa opcional de menciones**, `shared_counterparty_mention`, desactivada inicialmente. No etiquetar como “pagó a”, “proveedor” ni “cliente”.
- Ejemplo concreto: `COMP_0479 ↔ COMP_1152` comparten **246 IDs mencionados en `transactions.description`**, entre ellos `COUNTERPARTY_24373`. `COMP_0169 ↔ COMP_0852` comparten **187 IDs mencionados en `invoices.concept`**, entre ellos `COUNTERPARTY_07060`.

| Prueba de coincidencia | Filas con tokens | IDs textuales distintos | IDs compartidos entre empresas | Pares distintos |
|---|---|---|---|---|
| description↔description | 645.855 | 29.749 | 8.732 | 398.347 |
| concept↔concept | 182.984 | 17.430 | 2.912 | 28.850 |
| Cualquier columna/texto en ambos ficheros | 828.839 filas con texto; además columnas | 39.312 en texto; 129.701 en la unión | 13.964 | 441.633 |

Hay **520.739 transacciones** y **58 documentos** con tokens aunque la columna de contraparte esté vacía. En **72.605 transacciones** y **100.553 documentos** con ambas evidencias, la contraparte de columna no aparece entre los tokens. **80.132 transacciones** y **7.708 documentos** mencionan varias contrapartes. Ejemplo: transacción `2487f735eaf4598a19c1b79f5e35ae1f`, `COMP_1149`, columna vacía y texto `DEVOLUCION COMPRA COUNTERPARTY_18137 COUNTERPARTY_01442 Madrid`. No se sabe cuál sería el beneficiario de la fila.

Los **39.312 IDs textuales** existen en alguna columna estructurada del dataset, pero esa existencia no valida el papel que cumplen en cada texto. Una misma contraparte aparece en textos de hasta **432 empresas** y en la unión de evidencias de hasta **456**. La densidad de la unión es aproximadamente **53,45 % de los 826.255 pares posibles**: mostrar toda esta capa como comercio real sería engañoso. Las coincidencias se agregan sobre todo el histórico; no prueban relaciones simultáneas.

### HALLAZGO 6 — Banco/proveedor bancario con la misma etiqueta literal
- Fichero fuente: `banking_products.csv` (**5.987 filas**) y `debt_products.csv` (**2.239 filas**).
- Columnas implicadas: `company_id`, `bank_name`; `product_id` identifica el producto, no un banco compartido.
- Número de pares de empresas: **206.684**, entre empresas que usan al menos una misma etiqueta no vacía de `bank_name`. **1.232 empresas** tienen algún producto con etiqueta bancaria no genérica; no todas tienen por qué participar en un par.
- Direccional: **no**, A↔B por proveedor etiquetado igual.
- Significado económico: exposición a un proveedor bancario de nombre común; **no** titularidad compartida, crédito sindicado ni garantía cruzada. Se usa igualdad literal, sin resolver grupos bancarios o marcas equivalentes.
- Usable para grafo: **sí, opcional**, como exposición a un proveedor/hub o `shared_named_bank`; excesivamente denso para ser la relación principal. Peso = número de etiquetas bancarias comunes.
- Ejemplo concreto: `COMP_0004 ↔ COMP_0011` coinciden en `Banco Sabadell Empresas`, `Bankinter Empresas` y `Banco Santander Empresas`.

Se excluye expresamente `Other (customer-defined)`: es una categoría genérica, **no una entidad común**. Por ejemplo `Banco Santander` y `Banco Santander Empresas` permanecen distintos; no se inventa un maestro bancario. `Banco Santander Empresas` aparece en **433 empresas**. Los recuentos por etiqueta están en `relationship_audit.json`.

### HALLAZGO 7 — Código de servicio bancario común, distinto de cuenta común
- Fichero fuente: los mismos **8.226 productos** de banca/deuda.
- Columnas implicadas: `company_id`, `service`.
- Número de pares de empresas: **278.391**, por igualdad exacta de uno o más de los **202 códigos de servicio no vacíos ni `custom`**.
- Direccional: **no**.
- Significado económico: servicio/conector bancario compartido; coincidencia tecnológica y de proveedor, no prueba de que dos empresas compartan una cuenta o financiación.
- Usable para grafo: **sí, opcional y de baja especificidad**, `shared_bank_service`, o mejor como filtro de proveedores. No sumarlo como evidencia independiente del banco: son criterios correlacionados.
- Ejemplo concreto: `COMP_0004 ↔ COMP_0011` usan `service=sabadell_emp`. El peso cuenta códigos distintos, nunca productos.

### HALLAZGO 8 — No hay cuentas o productos de propiedad compartida
- Fichero fuente: banca (**5.987**), deuda (**2.239**), transacciones (**2.556.437**), balances (**7.996**) y calendarios (**87** filas).
- Columnas implicadas: `product_id`, `company_id`; revisión de propiedad en cada fichero y en su unión.
- Número de pares de empresas: **0**.
- Direccional: no aplica; una hipotética cotitularidad sería simétrica, pero no está observada.
- Significado económico: los productos son individuales por empresa en las referencias observadas. Repetir el tipo o `label=LOAN_01` no identifica la misma cuenta.
- Usable para grafo: **no** como arista entre empresas; sí como atributo/subnodo de la empresa propietaria.
- Ejemplo concreto: `PRODUCT_03496 → COMP_0001` aparece en balances; no aparece con una segunda empresa.

Los catálogos contienen **8.226 productos únicos**, sin IDs duplicados ni solapamiento entre catálogo bancario y de deuda. Las transacciones hacen referencia a **5.311 productos**, ninguno compartido entre empresas. La unión de todas las referencias `product_id, company_id` contiene **8.283 productos**, cada uno observado con una sola empresa, y **0 discrepancias de propietario en las referencias a productos catalogados**.

Calidad de referencia: **1.314 transacciones** usan **29 IDs de producto no catalogados**; ejemplo `PRODUCT_08229`, `COMP_1115`, transacción `3fa09d8b65664279a73b1ced8f4cded1`. **29 filas de balances** usan productos no catalogados; ejemplo `PRODUCT_08258 → COMP_0007`, balance `-100000`. El conjunto combinado tiene **57 productos extra**, porque hay solapamiento entre los dos ficheros. No se asigna moneda o tipo de producto a estas referencias por aproximación.

### HALLAZGO 9 — Cuenta de liquidación de deuda: vínculo entre productos, no entre empresas
- Fichero fuente: `debt_schedule_config.csv` (**87 filas**) y catálogos bancario/deuda (**8.226 filas**), contrastados además con transacciones y balances.
- Columnas implicadas: `company_id`, `product_id`, `settlement_product_id` → `product_id` de la cuenta; `company_id` del producto destino.
- Número de pares de empresas: **0 resolubles**. Hay **68 cuentas de liquidación distintas** en 87 filas.
- Direccional: conceptualmente deuda→cuenta de liquidación; no hay dirección entre empresas observada.
- Significado económico: cuenta utilizada para liquidar una facilidad de deuda. En **85 filas**, su propietario coincide con la empresa de la deuda; **2 cuentas no se resuelven en ningún fichero**. Ninguna cuenta de liquidación es usada por deudas de empresas distintas.
- Usable para grafo: **no** entre empresas; sí como vínculo interno producto→cuenta. Los 2 no resueltos son desconocidos, no evidencia negativa de un posible vínculo fuera de la muestra.
- Ejemplo concreto: `COMP_0047`, deuda `PRODUCT_06719`, liquidación `PRODUCT_04535`, también propiedad de `COMP_0047`.

Casos no resueltos: `COMP_1072 / PRODUCT_05408 → PRODUCT_08227` y `COMP_0770 / PRODUCT_02526 → PRODUCT_08228`. No se inventan sus propietarios. El esquema carece de `guarantor_id`, `co_borrower_id`, empresa acreedora o beneficiaria.

### HALLAZGO 10 — Garantías y productos custom no identifican a otra empresa
- Fichero fuente: `debt_products.csv` (**2.239 filas**) y, para `custom`, ambos catálogos (**8.226 filas**).
- Columnas implicadas: `type`, `company_id`, `bank_name`, `service`, `label`; no hay columna de avalista, prestamista empresarial o beneficiario.
- Número de pares de empresas: **0 identificables**.
- Direccional: no se puede asignar empresa avalista→empresa avalada.
- Significado económico: hay **155 productos `guarantee`**. El diccionario dice que los productos custom pueden incluir préstamos intercompany o de socios, entre muchas otras clases, pero no identifica sus extremos.
- Usable para grafo: **no** como avales cruzados, préstamos intragrupo o propiedad de accionistas.
- Ejemplo concreto: `PRODUCT_00057`, `COMP_1025`, `type=guarantee`, `bank_name=Banco Santander Empresas`, sin empresa avalista o avalada. `PRODUCT_00005`, `COMP_0742`, `type=loan`, `bank_name=Other (customer-defined)`, `service=custom`: no identifica al prestamista.

Hay **547 productos de `Other (customer-defined)`**, incluidos **171 préstamos** y **3 garantías**. No se interpreta compartir `custom` como compartir prestamista. Los tipos reales también incluyen `wallet`, `lineofcomex` y `risk`, ausentes de la lista abreviada del diccionario.

### HALLAZGO 11 — Atributos comunes de empresa: filtros, no vínculos económicos
- Fichero fuente: `companies.csv`, **1.286 filas**.
- Columnas implicadas: `country`, `currency`, `erp`, `created_at`, además de `company_id` y `group_id`.
- Número de pares de empresas por igualdad literal no vacía: país **10.335**, moneda **661.095**, ERP **66.067**. Son coincidencias de atributos, no relaciones empresariales.
- Direccional: **no**.
- Significado económico: contexto geográfico, monetario y del sistema de información; no propiedad o comercio.
- Usable para grafo: **no como aristas**; **sí como atributos de nodo**, color y filtro.
- Ejemplo concreto: `COMP_0001` y `COMP_0002` tienen `currency=EUR`, aunque sus grupos difieren. `COMP_0001` tiene `erp=sage200`, `country` vacío y alta `2026-03-11 12:20:06`.

No existen columnas `sector`, `size`, `region`, `founding_date`, nombre legal, NIF, dirección o matriz societaria. `created_at` es **alta en la plataforma, no constitución**. Rango observado: `2021-11-17 10:55:30` a `2026-07-16 06:51:09`. `group_size_in_sample` es tamaño del grupo en la muestra, no tamaño económico de la empresa.

País vacío en **1.056 empresas** (solo 230 informadas); mezcla `ES`, `España`, `ESPAÑA`, `Spain`, `Portugal` y otros nombres/códigos. Aunque el diccionario diga ISO, no se normaliza silenciosamente. ERP vacío en **541 empresas**; **745 informadas**. Moneda informada en todas: **1.149 EUR** y **137 no EUR**. `groups.erp` está vacío en **161 grupos** y usa etiquetas distintas de `companies.erp`; se conserva por separado como `group_erp`, sin rellenar el ERP de empresa con el del grupo.

### HALLAZGO 12 — Perfiles de score: cohortes descriptivas, no aristas
- Fichero fuente: **1.286 JSON** de resultados, correspondencia exacta con las 1.286 empresas: **0 ausentes y 0 IDs extra**.
- Columnas/campos implicados: `company_id`, `base_score`, `final_score`, `trajectory`, `persistence`, `confidence`, `window_usage`, `rule_version`, `data_cutoff`.
- Número de pares de empresas: **55.844 pares en las mismas cohortes** de banda de score base y trayectoria. No se exportan como aristas. Con la regla alternativa “misma trayectoria válida y diferencia base ≤10”, hay **102.717 pares**; no es la misma definición.
- Direccional: **no**.
- Significado económico: semejanza de salud de tesorería calculada por el modelo existente, no riesgo crediticio calibrado ni probabilidad de impago demostrada.
- Usable para grafo: **no como aristas**, sí para enriquecer nodos (`behavioral_cohort`, scores, trayectoria, persistencia y cobertura).
- Ejemplo concreto: `COMP_0001` tiene base/final `75.4`, trayectoria `improving`, persistencia `unconfirmed`, cohorte `70-80|improving`. `COMP_0002` tiene base `60.2`, final `50.2`, `deteriorating`, `confirmed`.

Hay **1.167 scores numéricos** y **119 nulos**; los nulos se exportan vacíos, no como cero. Rango base/final: **29,5–100**. Trayectorias: **421 improving**, **409 deteriorating**, **317 stable**, **139 insufficient_data**; de estas últimas, 20 tienen score pero no trayectoria suficiente. Persistencia: **202 confirmed**, **1.084 unconfirmed**.

Se han creado **19 cohortes no vacías para 1.147 empresas**, usando bandas base `[20,30)`, `[30,40)`, …, `[90,100]` y una de las tres trayectorias válidas. Es una agrupación explícita, reproducible y arbitraria de 10 puntos, **no clusters estadísticamente descubiertos**. Las 139 empresas sin trayectoria suficiente quedan sin cohorte. En los límites de banda puede haber vecinos próximos en cohortes distintas; las reglas por distancia, a su vez, no son transitivas.

Todos los resultados tienen `rule_version=v2.0.0-w3-h9`. Hay **1.167 con alcance `EUR_only`** y **119 `insufficient`**: no representan toda la actividad multimoneda. La cobertura va de **0 a 1**, los meses disponibles de **0 a 24**; **163** resultados indican fallback de ventana primaria y **690** fallback de drift. Estos indicadores se conservan para no pintar igual un score bien observado y uno con historia insuficiente.

### HALLAZGO 13 — Pertenencia a grupo asociada a score parecido, no predictor fiable por sí solo
- Fichero fuente: `companies.csv` y los **1.286 JSON**, con **1.167 empresas puntuables**.
- Columnas/campos implicados: `group_id`, `base_score`, `final_score`, `trajectory`.
- Número de pares de empresas comparables: **5.000 dentro del grupo** y **675.361 entre grupos** con score numérico; para trayectoria conocida, **4.872** y **652.359**, respectivamente.
- Direccional: **no**.
- Significado económico: asociación descriptiva entre grupo y salud financiera modelada en estos datos sintéticos. No prueba contagio, causalidad, garantía común ni homogeneidad de todas las filiales.
- Usable para grafo: **no como una arista nueva**; sí como resumen contextual de los nodos/grupos.
- Ejemplo concreto de excepción: `COMP_0144` y `COMP_1101` pertenecen a `GROUP_0236`, pero tienen base **100,0** y **46,8**, trayectorias `stable` y `deteriorating`.

| Métrica | Mismo grupo | Grupos distintos |
|---|---|---|
| Diferencia absoluta media del score base | 11,7516 | 14,1222 |
| Mediana de diferencia base | 9,4 | 12,2 |
| Diferencia absoluta media del score final | 12,8559 | 15,2686 |
| Mediana de diferencia final | 10,5 | 13,3 |
| Misma trayectoria, excluyendo insuficientes | 37,83 % | 33,74 % |
| Pares con misma trayectoria y diferencia base ≤10 | 1.079 / 4.872 (22,15 %) | 101.638 / 652.359 (15,58 %) |

La diferencia base media es aproximadamente **16,8 % menor** dentro de grupos. Prueba de permutación a nivel empresa (conserva tamaños de grupo, **2.000 permutaciones**, semilla **20260919**): media nula **14,1010**, intervalo central 95 % **[13,6596; 14,5595]**, p unilateral empírica **1/2001 ≈ 0,00050**. El intervalo es de la distribución nula, no un intervalo de confianza de la diferencia observada. No se usa una prueba que trate los pares como independientes.

Prueba predictiva limitada, dejando una empresa fuera: **1.091 empresas** de **169 grupos** con al menos dos miembros puntuables. Predecir su score final con la media de los demás miembros da **MAE 10,5903**, frente a **10,9095** con la media global sin esa empresa; sin embargo, **RMSE 13,5246** frente a **13,4253**, peor. La pertenencia aporta señal descriptiva, pero **no demuestra una mejora predictiva robusta**. No es validación temporal, no controla composición de moneda/cobertura y los grupos grandes pesan más en el análisis por pares.

Sensibilidad del criterio “misma trayectoria y diferencia base ≤umbral”: **55.253 pares** con 5 puntos, **102.717** con 10 y **142.718** con 15. Estas cifras dependen del criterio elegido y nunca se convierten en relaciones económicas.

### HALLAZGO 14 — Placeholders y referencias de documento no permiten reconstruir identidades
- Fichero fuente: transacciones (**2.556.437 filas**) y documentos (**897.894 filas**).
- Columnas implicadas: `description`, `concept`, `transaction_id`, `operation_id`.
- Número de pares de empresas: **0 por IDs de documento compartidos**, **0 referencias textuales literales `COMP_…`, `GROUP_…` o `PRODUCT_…`** en esos dos campos.
- Direccional: no aplica.
- Significado económico: los placeholders genéricos ocultan identidad, no la conservan. No son identificadores compartidos de empresas o cuentas.
- Usable para grafo: **no** unir por `[COMPANY]`, `[IBAN]`, `[ACCOUNT]`, `[TAXID]`, nombres parciales ni fecha/importe coincidente.
- Ejemplo concreto: `[COMPANY]` aparece en **689.238 transacciones** y **34.011 documentos**; no significa que todas esas filas nombren una misma empresa. `[IBAN]` aparece en **94.844 transacciones** y **859 documentos**, sin una cuenta identificable.

Los **2.556.437 transaction_id** y **897.894 operation_id** son únicos en sus respectivos ficheros; su intersección entre ficheros también es **0**, comprobada directamente. Solo los tokens `COUNTERPARTY_…` tienen identidad estable documentada; se mantienen con la cautela del hallazgo 5.

### RESUMEN FINAL

| Tipo | Pares | Fuente | Usable para grafo |
| --- | --- | --- | --- |
| Pertenencia empresa→grupo | 1.286 vínculos; 0 aristas directas empresa–empresa | companies.group_id → groups.group_id | Sí, bipartito |
| Co-miembros de grupo (derivado) | 5.846 | companies.group_id | No exportado como arista directa |
| Transacción directa entre empresas | 0 | transactions.company_id/counterparty_id | No |
| Factura directa entre empresas | 0 | invoices.company_id/counterparty_id | No |
| Contraparte compartida, tx–tx | 2 | transactions.counterparty_id | Sí |
| Contraparte compartida, factura–factura | 0 | invoices.counterparty_id | No observada |
| Contraparte compartida, tx–factura | 1 (ya incluido en los 2) | Ambos counterparty_id | Sí, no duplicar |
| Contraparte compartida, unión estructurada | 2 | Ambos company_id/counterparty_id | Sí, capa empresarial conservadora |
| Mención textual compartida, description–description | 398.347 | transactions.description | Solo capa de menciones |
| Mención textual compartida, concept–concept | 28.850 | invoices.concept | Solo capa de menciones |
| Mención compartida, al menos un extremo textual | 441.633 | Columna/texto de ambos ficheros | Sí, opcional; rol económico incierto |
| Misma etiqueta bancaria | 206.684 | banking/debt_products.bank_name | Sí, opcional/proveedor |
| Mismo servicio bancario | 278.391 | banking/debt_products.service | Sí, opcional/proveedor |
| Producto/cuenta/deuda compartida | 0 | Todos product_id/company_id | No |
| Liquidación de deuda en cuenta ajena | 0 resolubles; 2 filas sin resolver | debt_schedule_config.settlement_product_id | No |
| Avales cruzados / préstamos intercompany | 0 identificables | debt_products.type/bank_name | No |
| País / moneda / ERP coincidentes | 10.335 / 661.095 / 66.067 | companies.csv | Solo atributos |
| Cohorte de score y trayectoria | 55.844 (criterio explícito) | JSON de scoring | Solo atributos |
| Score comparable dentro de grupo | 5.000 | companies.group_id + JSON | Estadística, no nueva arista |
| IDs de documento / placeholders compartidos | 0 IDs; placeholders no identifican | transactions/invoices | No |

### RECOMENDACIÓN PARA EL GRAFO

1. **Estructura principal: empresa→grupo**, usando 1.286 membresías y 250 nodos de grupo. Las 71 membresías de grupos unitarios no deben confundirse con empresas sin grupo. No dibujar propiedad directa entre filiales.
2. **Entre empresas: solo 2 aristas conservadoras** de `shared_counterparty_structured`. Etiquetarlas “contraparte común”, nunca “pago”, y permitir abrir las evidencias de ambas empresas.
3. **Capas secundarias opcionales, apagadas por defecto:** `shared_counterparty_mention`, `shared_named_bank` y `shared_bank_service`. Son menciones o exposición a proveedores, no transacciones interempresa. Preferir hubs de contraparte/banco a cliques masivas. Filtrar por tipo y peso es una decisión visual, no una validación de relación comercial. No sumar las capas como señales independientes.
4. **Atributos de nodo:** `final_score`, `base_score`, `trajectory`, `persistence`, `behavioral_cohort`, `coverage_pct`, `months_available`, alcance monetario, fallback de ventanas, `group_id`, `group_size_in_sample`, `country` bruto, `currency`, `erp`, `group_erp` y alta `created_at`. Usar color neutral cuando falte score, no color de insolvencia. Bancos, servicios y tipos de producto se pueden mostrar como listas de atributos; se obtienen del catálogo, no de `companies.csv`.
5. **No se puede hacer con estos datos:** red dirigida cliente/proveedor entre `COMP_…`; importes pagados de una empresa identificada a otra; clasificación de qué filial es matriz; participaciones accionarias; avales cruzados; facilidad compartida; normalización bancaria por identidad jurídica; sector/tamaño/región/fundación; recuperación de IBAN/NIF desde placeholders; atribuir roles comerciales a tokens de texto; convertir `COUNTERPARTY_00001` en `COMP_0001`; demostrar contagio o predecir impago por proximidad.
6. La ausencia de una arista reconstruible **no demuestra ausencia de relación económica real**. Solo delimita lo identificable en el extracto anonimizado.

### DATOS PARA EL GRAFO

Todos los archivos están en `/home/juan/hackspain/credit-scoring/research`.

- **`graph_edges.csv`: 926.710 filas**, cabecera exacta `company_a,company_b,relationship_type,weight,direction,source_file`. Los dos extremos son siempre empresas reales, ordenadas (`company_a < company_b`). Sin autoaristas ni duplicados dentro del mismo tipo. `direction=undirected`. `source_file` lista con `;` los ficheros que aportan evidencia a esa arista.
- **`graph_nodes.csv`: 1.286 filas**, comienza con `company_id,final_score,trajectory,persistence` e incluye todos los atributos originales de `companies.csv`, más los enriquecimientos descritos. Los 119 scores ausentes están vacíos; `country` y ERP faltantes no se imputan.
- **`graph_memberships.csv`: 1.286 filas**, `company_id,group_id,relationship_type,weight,direction,source_file`, `relationship_type=member_of_group`, peso 1 y `direction=company_to_group`.
- **`graph_groups.csv`: 250 filas**, `group_id,erp,n_companies_in_sample`. Estos dos archivos adicionales preservan correctamente el enlace empresa→grupo sin introducir un `GROUP_…` en la columna `company_b` ni en `graph_nodes.company_id`.
- **`relationship_incidence.csv`: 290.544 filas**, una por fuente, clase de evidencia (`column`/`text`), contraparte y empresa; conserva `row_count` e `example_record_id`. Permite reconstruir las aristas y recuperar un testigo en el original. El contador textual cuenta filas que mencionan el token, no repeticiones del token dentro de la misma fila.
- **`direct_transaction_pairs.csv` y `direct_invoice_pairs.csv`: 0 filas cada uno**, solo cabeceras: listas vacías explícitas, no relaciones simuladas.
- **`relationship_audit.json`**, **`relationship_validation.json`** y **`graph_manifest.json`**: estadísticas, controles de integridad y recuentos de exportación.

**Importante:** no cargar todas las capas como si fueran vínculos comerciales. Aplicar el filtro de tipo antes de visualizarlas. Las filas de `graph_edges.csv` incluyen capas opcionales deliberadamente diferenciadas; no son 926.710 relaciones económicas independientes.

| relationship_type | Filas | Definición exacta de weight | Activación recomendada |
| --- | --- | --- | --- |
| shared_counterparty_structured | 2 | IDs comunes en counterparty_id de cualquiera de los dos ficheros; cada ID una vez | Sí |
| shared_counterparty_mention | 441.633 | IDs comunes con al menos un extremo apoyado por description/concept; cada ID una vez | No, exploración textual |
| shared_named_bank | 206.684 | bank_name literales comunes, excluye vacío y Other (customer-defined) | No, exposición a proveedor |
| shared_bank_service | 278.391 | service literales comunes, excluye vacío y custom | No, servicio/proveedor |

Un mismo par y contraparte puede aparecer tanto en la capa estructurada como en la textual; conservar tipos separados y no sumar esos pesos. No se han exportado importes como peso: el volumen frente a un tercero no es dinero transferido entre las dos empresas, y las fuentes tienen varias monedas.

#### Reproducción y validación

Scripts locales, sin modificar las fuentes y sin acceso a red:

```sh
/home/juan/hackspain/credit-scoring/.venv/bin/python /home/juan/hackspain/credit-scoring/research/investigate_relationships.py
/home/juan/hackspain/credit-scoring/.venv/bin/python /home/juan/hackspain/credit-scoring/research/verify_relationships.py
/home/juan/hackspain/credit-scoring/.venv/bin/python /home/juan/hackspain/credit-scoring/research/export_relationships.py
/home/juan/hackspain/credit-scoring/.venv/bin/python /home/juan/hackspain/credit-scoring/research/verify_relationships.py
```

El primer script usa lectura CSV completa; la comprobación de contrapartes/productos vuelve a leer los originales por bloques con pandas de forma independiente. La validación final comprueba los extremos, pesos, unicidad por capa y membresías, y contrasta todos los atributos de nodo originales. No se usa conteo de líneas físicas: descriptions/concepts contienen saltos de línea dentro de campos CSV citados.

### ANEXO A — Inventario, esquemas, nulos y ejemplos de todos los ficheros

| Fichero | Filas reales | Columnas exactas |
| --- | --- | --- |
| groups.csv | 250 | `group_id`, `erp`, `n_companies_in_sample` |
| companies.csv | 1.286 | `company_id`, `group_id`, `country`, `currency`, `erp`, `created_at` |
| banking_products.csv | 5.987 | `product_id`, `company_id`, `label`, `type`, `bank_name`, `service`, `currency`, `created_at` |
| debt_products.csv | 2.239 | `product_id`, `company_id`, `label`, `type`, `bank_name`, `service`, `currency`, `created_at`, `granted`, `outstanding`, `liquidity` |
| balances.csv | 7.996 | `product_id`, `company_id`, `date`, `balance`, `available`, `granted`, `liquidity`, `countable` |
| debt_schedule_config.csv | 87 | `product_id`, `company_id`, `settlement_product_id`, `currency`, `amortization_type`, `interest_calc_method`, `amortising_frequency`, `granted_balance`, `outstanding_balance`, `total_periods`, `next_payment_date`, `last_payment_date`, `annual_interest_rate_or_spread`, `interest_type` |
| transactions.csv | 2.556.437 | `transaction_id`, `company_id`, `product_id`, `date`, `value_date`, `amount`, `exchange_rate`, `status`, `accounting_status`, `category`, `description`, `counterparty_id` |
| invoices.csv | 897.894 | `operation_id`, `company_id`, `document_type`, `issuance_date`, `due_date`, `payment_date`, `amount`, `pending_amount`, `currency`, `accounting_currency`, `exchange_rate`, `status`, `concept`, `counterparty_id` |

#### groups.csv

Filas: **250**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| group_id | 0 |
| erp | 161 |
| n_companies_in_sample | 0 |

Ejemplo de fila real:
```json
{
  "group_id": "GROUP_0001",
  "erp": "",
  "n_companies_in_sample": "3"
}
```

#### companies.csv

Filas: **1.286**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| company_id | 0 |
| group_id | 0 |
| country | 1.056 |
| currency | 0 |
| erp | 541 |
| created_at | 0 |

Ejemplo de fila real:
```json
{
  "company_id": "COMP_0218",
  "group_id": "GROUP_0113",
  "country": "",
  "currency": "EUR",
  "erp": "",
  "created_at": "2025-03-07 12:27:13"
}
```

#### banking_products.csv

Filas: **5.987**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| product_id | 0 |
| company_id | 0 |
| label | 0 |
| type | 0 |
| bank_name | 0 |
| service | 0 |
| currency | 0 |
| created_at | 0 |

Ejemplo de fila real:
```json
{
  "product_id": "PRODUCT_00001",
  "company_id": "COMP_1068",
  "label": "CHECKING_01",
  "type": "checking",
  "bank_name": "Banco Sabadell Empresas",
  "service": "sabadell_emp",
  "currency": "EUR",
  "created_at": "2026-02-19 15:46:46"
}
```

#### debt_products.csv

Filas: **2.239**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| product_id | 0 |
| company_id | 0 |
| label | 0 |
| type | 0 |
| bank_name | 0 |
| service | 0 |
| currency | 0 |
| created_at | 0 |
| granted | 169 |
| outstanding | 0 |
| liquidity | 1.435 |

Ejemplo de fila real:
```json
{
  "product_id": "PRODUCT_00002",
  "company_id": "COMP_1008",
  "label": "LOAN_01",
  "type": "loan",
  "bank_name": "Banca March",
  "service": "bancamarch",
  "currency": "EUR",
  "created_at": "2026-01-28 12:50:43",
  "granted": "",
  "outstanding": "-394699.74",
  "liquidity": ""
}
```

#### balances.csv

Filas: **7.996**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| product_id | 0 |
| company_id | 0 |
| date | 0 |
| balance | 0 |
| available | 7.996 |
| granted | 5.348 |
| liquidity | 6.100 |
| countable | 7.332 |

Ejemplo de fila real:
```json
{
  "product_id": "PRODUCT_03496",
  "company_id": "COMP_0001",
  "date": "2026-09-01 00:00:00",
  "balance": "31795.29",
  "available": "",
  "granted": "",
  "liquidity": "",
  "countable": ""
}
```

#### debt_schedule_config.csv

Filas: **87**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| product_id | 0 |
| company_id | 0 |
| settlement_product_id | 0 |
| currency | 0 |
| amortization_type | 0 |
| interest_calc_method | 0 |
| amortising_frequency | 0 |
| granted_balance | 0 |
| outstanding_balance | 0 |
| total_periods | 0 |
| next_payment_date | 0 |
| last_payment_date | 0 |
| annual_interest_rate_or_spread | 0 |
| interest_type | 0 |

Ejemplo de fila real:
```json
{
  "product_id": "PRODUCT_06719",
  "company_id": "COMP_0047",
  "settlement_product_id": "PRODUCT_04535",
  "currency": "EUR",
  "amortization_type": "constant quote",
  "interest_calc_method": "30/360",
  "amortising_frequency": "monthly",
  "granted_balance": "270000",
  "outstanding_balance": "154978.58",
  "total_periods": "33",
  "next_payment_date": "2025-09-30 00:00:00",
  "last_payment_date": "2025-09-16 12:31:20",
  "annual_interest_rate_or_spread": "0.04",
  "interest_type": "fixed"
}
```

#### transactions.csv

Filas: **2.556.437**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| transaction_id | 0 |
| company_id | 0 |
| product_id | 0 |
| date | 0 |
| value_date | 0 |
| amount | 0 |
| exchange_rate | 0 |
| status | 29.839 |
| accounting_status | 1.573.869 |
| category | 330 |
| description | 456 |
| counterparty_id | 2.305.659 |

Ejemplo de fila real:
```json
{
  "transaction_id": "031b6af5e65957a71747a25f819ee269",
  "company_id": "COMP_0194",
  "product_id": "PRODUCT_00121",
  "date": "2025-02-15 00:00:00",
  "value_date": "2025-02-15 00:00:00",
  "amount": "-12",
  "exchange_rate": "1",
  "status": "booked",
  "accounting_status": "RECONCILIATION_COMPLETED",
  "category": "interest_charge",
  "description": "LIQUIDACION DE INTERESES-COMISIONES-GASTOS",
  "counterparty_id": ""
}
```

#### invoices.csv

Filas: **897.894**. Valores vacíos por columna:

| Columna | Vacíos |
| --- | --- |
| operation_id | 0 |
| company_id | 0 |
| document_type | 0 |
| issuance_date | 0 |
| due_date | 8 |
| payment_date | 6 |
| amount | 0 |
| pending_amount | 0 |
| currency | 0 |
| accounting_currency | 0 |
| exchange_rate | 261 |
| status | 0 |
| concept | 3.967 |
| counterparty_id | 11.457 |

Ejemplo de fila real:
```json
{
  "operation_id": "00229f2507386496cf94639ebac785f3",
  "company_id": "COMP_0556",
  "document_type": "invoice",
  "issuance_date": "2025-11-29 00:00:00",
  "due_date": "2025-12-29 00:00:00",
  "payment_date": "2025-12-29 00:00:00",
  "amount": "-720",
  "pending_amount": "0",
  "currency": "SEK",
  "accounting_currency": "DKK",
  "exchange_rate": "1.47",
  "status": "paid",
  "concept": "Cph tem event",
  "counterparty_id": "COUNTERPARTY_47797"
}
```

### ANEXO B — Todos los valores únicos de groups.csv

250 filas; esquema exacto `group_id,erp,n_companies_in_sample`. Se preservan espacios y vacíos (`""`); `Infor M3 ` lleva espacio final. No se normalizan silenciosamente.


**group_id**: 250 valores distintos, incluido vacío si aparece.
```text
"GROUP_0001"
"GROUP_0002"
"GROUP_0003"
"GROUP_0004"
"GROUP_0005"
"GROUP_0006"
"GROUP_0007"
"GROUP_0008"
"GROUP_0009"
"GROUP_0010"
"GROUP_0011"
"GROUP_0012"
"GROUP_0013"
"GROUP_0014"
"GROUP_0015"
"GROUP_0016"
"GROUP_0017"
"GROUP_0018"
"GROUP_0019"
"GROUP_0020"
"GROUP_0021"
"GROUP_0022"
"GROUP_0023"
"GROUP_0024"
"GROUP_0025"
"GROUP_0026"
"GROUP_0027"
"GROUP_0028"
"GROUP_0029"
"GROUP_0030"
"GROUP_0031"
"GROUP_0032"
"GROUP_0033"
"GROUP_0034"
"GROUP_0035"
"GROUP_0036"
"GROUP_0037"
"GROUP_0038"
"GROUP_0039"
"GROUP_0040"
"GROUP_0041"
"GROUP_0042"
"GROUP_0043"
"GROUP_0044"
"GROUP_0045"
"GROUP_0046"
"GROUP_0047"
"GROUP_0048"
"GROUP_0049"
"GROUP_0050"
"GROUP_0051"
"GROUP_0052"
"GROUP_0053"
"GROUP_0054"
"GROUP_0055"
"GROUP_0056"
"GROUP_0057"
"GROUP_0058"
"GROUP_0059"
"GROUP_0060"
"GROUP_0061"
"GROUP_0062"
"GROUP_0063"
"GROUP_0064"
"GROUP_0065"
"GROUP_0066"
"GROUP_0067"
"GROUP_0068"
"GROUP_0069"
"GROUP_0070"
"GROUP_0071"
"GROUP_0072"
"GROUP_0073"
"GROUP_0074"
"GROUP_0075"
"GROUP_0076"
"GROUP_0077"
"GROUP_0078"
"GROUP_0079"
"GROUP_0080"
"GROUP_0081"
"GROUP_0082"
"GROUP_0083"
"GROUP_0084"
"GROUP_0085"
"GROUP_0086"
"GROUP_0087"
"GROUP_0088"
"GROUP_0089"
"GROUP_0090"
"GROUP_0091"
"GROUP_0092"
"GROUP_0093"
"GROUP_0094"
"GROUP_0095"
"GROUP_0096"
"GROUP_0097"
"GROUP_0098"
"GROUP_0099"
"GROUP_0100"
"GROUP_0101"
"GROUP_0102"
"GROUP_0103"
"GROUP_0104"
"GROUP_0105"
"GROUP_0106"
"GROUP_0107"
"GROUP_0108"
"GROUP_0109"
"GROUP_0110"
"GROUP_0111"
"GROUP_0112"
"GROUP_0113"
"GROUP_0114"
"GROUP_0115"
"GROUP_0116"
"GROUP_0117"
"GROUP_0118"
"GROUP_0119"
"GROUP_0120"
"GROUP_0121"
"GROUP_0122"
"GROUP_0123"
"GROUP_0124"
"GROUP_0125"
"GROUP_0126"
"GROUP_0127"
"GROUP_0128"
"GROUP_0129"
"GROUP_0130"
"GROUP_0131"
"GROUP_0132"
"GROUP_0133"
"GROUP_0134"
"GROUP_0135"
"GROUP_0136"
"GROUP_0137"
"GROUP_0138"
"GROUP_0139"
"GROUP_0140"
"GROUP_0141"
"GROUP_0142"
"GROUP_0143"
"GROUP_0144"
"GROUP_0145"
"GROUP_0146"
"GROUP_0147"
"GROUP_0148"
"GROUP_0149"
"GROUP_0150"
"GROUP_0151"
"GROUP_0152"
"GROUP_0153"
"GROUP_0154"
"GROUP_0155"
"GROUP_0156"
"GROUP_0157"
"GROUP_0158"
"GROUP_0159"
"GROUP_0160"
"GROUP_0161"
"GROUP_0162"
"GROUP_0163"
"GROUP_0164"
"GROUP_0165"
"GROUP_0166"
"GROUP_0167"
"GROUP_0168"
"GROUP_0169"
"GROUP_0170"
"GROUP_0171"
"GROUP_0172"
"GROUP_0173"
"GROUP_0174"
"GROUP_0175"
"GROUP_0176"
"GROUP_0177"
"GROUP_0178"
"GROUP_0179"
"GROUP_0180"
"GROUP_0181"
"GROUP_0182"
"GROUP_0183"
"GROUP_0184"
"GROUP_0185"
"GROUP_0186"
"GROUP_0187"
"GROUP_0188"
"GROUP_0189"
"GROUP_0190"
"GROUP_0191"
"GROUP_0192"
"GROUP_0193"
"GROUP_0194"
"GROUP_0195"
"GROUP_0196"
"GROUP_0197"
"GROUP_0198"
"GROUP_0199"
"GROUP_0200"
"GROUP_0201"
"GROUP_0202"
"GROUP_0203"
"GROUP_0204"
"GROUP_0205"
"GROUP_0206"
"GROUP_0207"
"GROUP_0208"
"GROUP_0209"
"GROUP_0210"
"GROUP_0211"
"GROUP_0212"
"GROUP_0213"
"GROUP_0214"
"GROUP_0215"
"GROUP_0216"
"GROUP_0217"
"GROUP_0218"
"GROUP_0219"
"GROUP_0220"
"GROUP_0221"
"GROUP_0222"
"GROUP_0223"
"GROUP_0224"
"GROUP_0225"
"GROUP_0226"
"GROUP_0227"
"GROUP_0228"
"GROUP_0229"
"GROUP_0230"
"GROUP_0231"
"GROUP_0232"
"GROUP_0233"
"GROUP_0234"
"GROUP_0235"
"GROUP_0236"
"GROUP_0237"
"GROUP_0238"
"GROUP_0239"
"GROUP_0240"
"GROUP_0241"
"GROUP_0242"
"GROUP_0243"
"GROUP_0244"
"GROUP_0245"
"GROUP_0246"
"GROUP_0247"
"GROUP_0248"
"GROUP_0249"
"GROUP_0250"
```

**erp**: 22 valores distintos, incluido vacío si aparece.
```text
""
"A3 ERP"
"Desarrollo propio"
"Distrito K"
"Etendo"
"Holded"
"Infor M3 "
"LIBRA"
"MOVEX"
"Microsoft Business Central"
"Microsoft Dynamics - AX 2009"
"Microsoft Dynamics - AX 2012"
"Microsoft Dynamics - F&O"
"Microsoft Navision"
"Netsuite"
"Odoo"
"Oracle Cloud"
"SAP Business One"
"SAP R3 / S4"
"Sage 200"
"Sage 50"
"Sage X3"
```

**n_companies_in_sample**: 21 valores distintos, incluido vacío si aparece.
```text
"1"
"10"
"11"
"12"
"13"
"14"
"15"
"16"
"17"
"18"
"19"
"2"
"21"
"22"
"3"
"4"
"5"
"6"
"7"
"8"
"9"
```

Frecuencias de tamaño de grupo:
| Empresas del grupo | Grupos |
| --- | --- |
| 1 | 71 |
| 2 | 34 |
| 3 | 27 |
| 4 | 22 |
| 5 | 15 |
| 6 | 15 |
| 7 | 9 |
| 8 | 7 |
| 9 | 6 |
| 10 | 4 |
| 11 | 6 |
| 12 | 7 |
| 13 | 7 |
| 14 | 1 |
| 15 | 3 |
| 16 | 3 |
| 17 | 2 |
| 18 | 4 |
| 19 | 2 |
| 21 | 2 |
| 22 | 3 |

Frecuencias de ERP de grupo:
| ERP (valor literal) | Grupos |
| --- | --- |
| "" | 161 |
| "A3 ERP" | 2 |
| "Desarrollo propio" | 1 |
| "Distrito K" | 1 |
| "Etendo" | 1 |
| "Holded" | 1 |
| "Infor M3 " | 1 |
| "LIBRA" | 1 |
| "MOVEX" | 1 |
| "Microsoft Business Central" | 28 |
| "Microsoft Dynamics - AX 2009" | 1 |
| "Microsoft Dynamics - AX 2012" | 2 |
| "Microsoft Dynamics - F&O" | 2 |
| "Microsoft Navision" | 6 |
| "Netsuite" | 19 |
| "Odoo" | 1 |
| "Oracle Cloud" | 1 |
| "SAP Business One" | 6 |
| "SAP R3 / S4" | 2 |
| "Sage 200" | 5 |
| "Sage 50" | 3 |
| "Sage X3" | 4 |

### ANEXO C — Atributos de empresa y tipos de documento


**companies.country**, 23 valores incluyendo vacío:
| Valor literal | Empresas |
| --- | --- |
| "" | 1056 |
| "AT" | 1 |
| "Alemania" | 1 |
| "BE" | 3 |
| "DE" | 11 |
| "ES" | 142 |
| "ESPANYA" | 2 |
| "ESPAÑA" | 14 |
| "Espanya" | 1 |
| "España" | 9 |
| "España " | 1 |
| "FR" | 6 |
| "GB" | 4 |
| "IT" | 3 |
| "Italia" | 1 |
| "Malaysia" | 1 |
| "NL" | 14 |
| "PL" | 1 |
| "PT" | 3 |
| "Portugal" | 5 |
| "SE" | 1 |
| "Spain" | 1 |
| "US" | 5 |

**companies.currency**, 28 valores incluyendo vacío:
| Valor literal | Empresas |
| --- | --- |
| "AED" | 2 |
| "AOA" | 2 |
| "ARS" | 1 |
| "AUD" | 5 |
| "BAM" | 1 |
| "BRL" | 3 |
| "CAD" | 3 |
| "CHF" | 3 |
| "CLP" | 3 |
| "COP" | 5 |
| "CZK" | 1 |
| "DKK" | 6 |
| "EUR" | 1149 |
| "GBP" | 42 |
| "GHS" | 1 |
| "INR" | 1 |
| "JPY" | 1 |
| "MXN" | 7 |
| "MYR" | 1 |
| "NAD" | 1 |
| "NOK" | 1 |
| "NZD" | 2 |
| "PEN" | 2 |
| "PLN" | 4 |
| "SEK" | 1 |
| "USD" | 36 |
| "VND" | 1 |
| "XOF" | 1 |

**companies.erp**, 21 valores incluyendo vacío:
| Valor literal | Empresas |
| --- | --- |
| "" | 541 |
| "a3" | 14 |
| "businessCentral" | 322 |
| "businessOne" | 47 |
| "datev" | 1 |
| "distritoK" | 20 |
| "dynamicsAx" | 42 |
| "ekon" | 3 |
| "etendo" | 11 |
| "fo" | 2 |
| "holded" | 1 |
| "libra" | 7 |
| "m3Rosetta" | 21 |
| "navision" | 18 |
| "netsuite" | 143 |
| "r3" | 10 |
| "sage200" | 47 |
| "sage50" | 1 |
| "sageIntacct" | 4 |
| "sageX3" | 30 |
| "sapByd" | 1 |

**invoices.document_type**:
| Tipo | Filas |
| --- | --- |
| invoice | 760406 |
| invoiceGroup | 13775 |
| note | 38154 |
| refund | 2018 |
| paymentDocument | 53761 |
| deliveryNote | 6380 |
| purchaseOrder | 1259 |
| other | 739 |
| cheque | 12 |
| deposit | 21390 |

**Tipos de producto en ambos catálogos**:
| Tipo | Filas |
| --- | --- |
| card | 796 |
| checking | 4854 |
| confirming | 229 |
| expensesPlatform | 23 |
| factoring | 24 |
| guarantee | 155 |
| investment | 201 |
| leasing | 179 |
| lineofcomex | 19 |
| lineofcredit | 536 |
| loan | 1022 |
| mortgage | 60 |
| renting | 34 |
| risk | 25 |
| saving | 10 |
| tpv | 25 |
| wallet | 34 |

### ANEXO D — Cohortes descriptivas de comportamiento

Bandas cerradas por la izquierda y abiertas por la derecha, excepto 90–100 que incluye 100. Las cifras suman 1.147 empresas; 139 no tienen cohorte.

| Cohorte | Empresas | Ejemplos |
| --- | --- | --- |
| 20-30\|improving | 1 | COMP_0680 |
| 30-40\|deteriorating | 1 | COMP_0649 |
| 40-50\|deteriorating | 6 | COMP_0043, COMP_0169, COMP_0816 |
| 40-50\|stable | 2 | COMP_0241, COMP_1020 |
| 50-60\|deteriorating | 54 | COMP_0016, COMP_0075, COMP_0086 |
| 50-60\|improving | 8 | COMP_0038, COMP_0041, COMP_0062 |
| 50-60\|stable | 27 | COMP_0004, COMP_0034, COMP_0071 |
| 60-70\|deteriorating | 130 | COMP_0002, COMP_0007, COMP_0015 |
| 60-70\|improving | 63 | COMP_0006, COMP_0009, COMP_0013 |
| 60-70\|stable | 84 | COMP_0005, COMP_0020, COMP_0022 |
| 70-80\|deteriorating | 135 | COMP_0010, COMP_0018, COMP_0019 |
| 70-80\|improving | 131 | COMP_0001, COMP_0027, COMP_0028 |
| 70-80\|stable | 80 | COMP_0011, COMP_0023, COMP_0024 |
| 80-90\|deteriorating | 71 | COMP_0059, COMP_0061, COMP_0111 |
| 80-90\|improving | 144 | COMP_0003, COMP_0008, COMP_0049 |
| 80-90\|stable | 74 | COMP_0026, COMP_0040, COMP_0100 |
| 90-100\|deteriorating | 12 | COMP_0070, COMP_0078, COMP_0085 |
| 90-100\|improving | 74 | COMP_0045, COMP_0073, COMP_0077 |
| 90-100\|stable | 50 | COMP_0012, COMP_0033, COMP_0039 |

### ANEXO E — Diccionario leído primero: definiciones originales completas

Se reproduce íntegramente para incluir todas las definiciones de empresa, grupo, contraparte, propietario, cuenta de liquidación y placeholders, sin omitir contexto. Las discrepancias con las filas observadas se señalan en los hallazgos.

```markdown
# HackSpain X-Ray Track — Data Dictionary

This is a **synthetic dataset**: 1,286 companies across 250 business groups, with 24 months
of financial history (**2024-09-01 to 2026-09-01**). It was generated from the statistical
distribution of real SME treasury data (bank accounts, financing, transactions, invoices), so
volumes, seasonality, counterparty patterns and financing terms behave like the real thing.
No row corresponds to an actual company, bank account or person.

All IDs (`company_id`, `group_id`, `product_id`, `counterparty_id`) are stable within the
dataset: the same entity always has the same ID in every file.

## groups.csv (250 rows)
One row per business group. A group can be a holding with several subsidiaries, so group
size ranges from 1 to 24 companies (median 2).

| column | description |
|---|---|
| group_id | Group ID |
| erp | ERP system used by the group, if any (e.g. `businesscentral`, `netsuite`, `sap`) |
| n_companies_in_sample | Number of companies from this group included in the dataset (1-24) |

## companies.csv (1,286 rows)
| column | description |
|---|---|
| company_id | Company ID — the primary key used across every other file |
| group_id | Parent group ID |
| country | ISO country code, when known (often missing) |
| currency | Company currency |
| erp | ERP system, if any |
| created_at | When the company was onboarded onto the platform |

## banking_products.csv (5,987 rows) / debt_products.csv (2,239 rows)
Bank accounts and financing facilities. Split by `type`:
- **banking_products**: checking, card, investment, tpv, saving, expensesPlatform
- **debt_products**: loan, leasing, lineofcredit, mortgage, renting, factoring, confirming, guarantee

| column | description |
|---|---|
| product_id | Product/account ID |
| company_id | Owning company |
| label | Human-readable label, e.g. `LOAN_01`, `CHECKING_02` |
| type | Product type (see above) |
| bank_name | Bank name (e.g. "BBVA", "Banco Santander"). `Other (customer-defined)` for products that are not linked to a bank connection (intercompany loans, shareholder loans, prepaid cards, "other" accounts) |
| service | Bank service code; `custom` for the customer-defined products above |
| currency | Product currency |
| created_at | When the product was connected |
| granted / outstanding / liquidity | *(debt_products only)* `granted` = original facility amount, `outstanding` = current balance owed, `liquidity` = available amount when reported |

## debt_schedule_config.csv (87 rows)
Loan terms for the debt products that have a formal amortization schedule (mostly `loan`
and `leasing`). One row per debt product.

| column | description |
|---|---|
| product_id, company_id | Keys |
| settlement_product_id | Settlement bank account (a `product_id`) |
| amortization_type, interest_calc_method, amortising_frequency, interest_type | Loan terms (e.g. `constant quote`, `30/360`, `monthly`, `fixed`/`variable`) |
| granted_balance | Original principal |
| outstanding_balance | Remaining principal as of extraction |
| total_periods | Total number of installments in the schedule |
| next_payment_date, last_payment_date | Loan-level dates |
| annual_interest_rate_or_spread | Current/latest rate |

## transactions.csv (2,556,437 rows)
Bank transactions, 2024-09-01 to 2026-09-01.

| column | description |
|---|---|
| transaction_id | Transaction ID |
| company_id, product_id | Keys (product = which bank account) |
| date, value_date | Booking / value date |
| amount | Amount (negative = outgoing, positive = incoming) |
| exchange_rate | Exchange rate applied to the transaction |
| status | `booked`, `pending`, etc. |
| accounting_status | Reconciliation status, when available |
| category | Auto-assigned category (e.g. `utility`, `tax`, `collection`) |
| description | Bank transaction narrative. Names, identifiers and rare words are replaced by placeholders (see *Placeholders* below) |
| counterparty_id | Counterparty (same counterparty ⇒ same ID everywhere). Blank when the transaction has no resolved counterparty |

## invoices.csv (897,894 rows)
ERP-sourced invoices (synced in from the company's ERP).

| column | description |
|---|---|
| operation_id | Invoice/document ID |
| company_id | Key |
| document_type | e.g. `invoice`, `credit_note` |
| issuance_date, due_date, payment_date | Invoice lifecycle dates |
| amount, pending_amount | Amounts (pending_amount = 0 once fully paid) |
| status | e.g. `paid`, `pending` |
| currency | Invoice currency |
| accounting_currency | Accounting currency of the invoice |
| exchange_rate | Exchange rate applied to the invoice |
| concept | Free-text invoice line/concept (e.g. `"Factura FC2024-00819. [X] Suscripción"`). Same placeholders as `transactions.description` |
| counterparty_id | Supplier/customer — same ID space as transactions.csv's `counterparty_id` |

## balances.csv (7,996 rows)
Balances as of 2026-09-01, one row per product.

| column | description |
|---|---|
| product_id, company_id | Keys |
| date | Always 2026-09-01 (or the closest prior day with a recorded snapshot) |
| balance | Ledger balance on that date |
| available, granted, liquidity, countable | Balance breakdowns, when populated by the bank/provider (often null depending on account type) |

## Placeholders
The free-text fields (`transactions.description`, `invoices.concept`) contain these tokens
in place of the original text:

| token | stands for |
|---|---|
| `COUNTERPARTY_xxxxx` | A counterparty (same ID as in `counterparty_id`) |
| `[COMPANY]` | A company name |
| `[PERSON]`, `[NAME]` | A person or payer/payee name |
| `[IBAN]`, `[ACCOUNT]`, `[CARD]` | Bank account or card identifiers |
| `[TAXID]`, `[EMAIL]`, `[PHONE]`, `[URL]`, `[ADDRESS]` | Other identifiers |
| `[REF]`, `[NUM]` | Long alphanumeric references / long digit sequences |
| `[X]` | Any other uncommon word |

```
