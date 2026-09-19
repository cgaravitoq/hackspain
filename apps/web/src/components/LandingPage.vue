<script setup lang="ts">
import { Sparkles } from "@lucide/vue";
import { ref } from "vue";
import EmbatLogo from "./EmbatLogo.vue";

const emit = defineEmits<{ start: [] }>();

const navLinks = [
  { label: "Producto", href: "#features" },
  { label: "TellMe IA", href: "#modes" },
  { label: "Precios", href: "#cta" },
  { label: "Recursos", href: "#results" },
  { label: "Empresa", href: "#footer" },
];

const modes = [
  {
    title: "Silent Mode",
    image: "/landing/silent-mode.svg",
    text: "Las tareas rutinarias se ejecutan en segundo plano: categorización, enriquecimiento, conciliación. Registradas, trazables y reversibles. Nada ocurre sin que puedas verlo y deshacerlo.",
  },
  {
    title: "Guided Mode",
    image: "/landing/guided-mode.svg",
    text: "Cuando TellMe detecta algo que requiere tu criterio, lo presenta con contexto y razonamiento. Sin relleno. Aprueba, modifica o rechaza en un clic.",
  },
  {
    title: "Ask Mode",
    image: "/landing/ask-mode.svg",
    text: "Pídele lo que necesites a TellMe: un desglose del flujo de caja por entidad o una explicación de por qué falló la previsión de la semana pasada. Tú preguntas, TellMe responde con la misma transparencia y el mismo control.",
  },
];

type Feature = { name: string; title: string; text: string };

const featureTabs: { label: string; features: Feature[] }[] = [
  {
    label: "Tesorería",
    features: [
      {
        name: "Categorización inteligente",
        title:
          "Categoriza cada transacción automáticamente, desde el primer día",
        text: "Cada transacción entrante se categoriza de forma automática, con una precisión que mejora a medida que se aprenden tus patrones.",
      },
      {
        name: "Conciliación de previsiones",
        title:
          "Empareja cada previsión con su transacción real, línea por línea",
        text: "Cada transacción se cruza con su entrada de previsión, generando una imagen clara de lo esperado, lo que ha llegado y lo pendiente.",
      },
      {
        name: "Análisis del comportamiento de pago",
        title:
          "Ajusta las fechas de previsión al comportamiento real de tus terceros",
        text: "Los patrones históricos de pago se analizan automáticamente, marcando las previsiones cuyas fechas no reflejan el comportamiento real.",
      },
      {
        name: "Inteligencia de informes",
        title: "Informes que se explican solos, sin análisis manual",
        text: "Los datos clave se extraen y se añade narrativa. Los ciclos de reporting que antes llevaban horas ahora se completan en minutos.",
      },
    ],
  },
  {
    label: "Contabilidad",
    features: [
      {
        name: "Conciliación de facturas",
        title:
          "Liquida facturas automáticamente mediante el emparejamiento bancario",
        text: "Cada transacción se empareja con su factura, ya sea una coincidencia 1 a 1, varias facturas o un pago parcial. Acepta en un clic y continúa.",
      },
      {
        name: "Registro en cuenta GL",
        title: "Contabiliza cada transacción en la cuenta contable correcta",
        text: "Sin facturas asociadas, la descripción, el tercero y los metadatos sugieren la cuenta contable, el centro de coste y las etiquetas analíticas.",
      },
      {
        name: "Conciliación bancaria",
        title:
          "Concilia extractos bancarios y asientos contables en tiempo real",
        text: "Cada transacción registrada en Embat se concilia con su asiento. Para los asientos externos, las coincidencias se presentan como sugerencias.",
      },
      {
        name: "Conciliación de órdenes PSP",
        title:
          "Resuelve las discrepancias de PSP con sugerencias de cuentas contables",
        text: "Cuando una transacción y una venta comparten ID pero no importe, se sugiere la cuenta adecuada: comisión, reembolso o diferencia de cambio.",
      },
    ],
  },
  {
    label: "Optimización de caja",
    features: [
      {
        name: "Optimización de liquidez",
        title:
          "Optimiza la distribución de liquidez en todas tus entidades y divisas",
        text: "Tu posición de caja se analiza automáticamente, con sugerencias de movimientos óptimos para maximizar el rendimiento y minimizar los costes.",
      },
    ],
  },
  {
    label: "Pagos",
    features: [
      {
        name: "Completado de datos de pago",
        title:
          "Completa los pagos al instante: TellMe rellena los datos que faltan",
        text: "Los registros incompletos se detectan en tiempo real y los datos del beneficiario se sugieren en el momento. Sin interrupciones ni búsquedas manuales.",
      },
    ],
  },
];

const activeTab = ref(0);

const results = [
  {
    company: "HOFF",
    metric: "85–90%",
    label: "Reducción del tiempo dedicado a tareas diarias de tesorería.",
    quote:
      "Antes dedicábamos el 100 % del día a tareas muy manuales. Hoy, con Embat, una persona puede gestionar toda la tesorería en tiempo real dedicando solo el 10-15 % de su tiempo.",
    author: "Javier Gaya, CFO en HOFF",
  },
  {
    company: "Cooltra",
    metric: "50.000+",
    label: "Asientos contables automatizados con reglas e IA en todo el grupo.",
    quote:
      "Con Embat, las conciliaciones se pueden automatizar mediante reglas e inteligencia artificial. Ahora, el equipo puede centrarse en actividades que realmente añaden valor.",
    author: "Francesc Madurell, CFO en Cooltra",
  },
  {
    company: "Molins",
    metric: "11",
    label: "Países con previsión de tesorería centralizada y cash pooling.",
    quote:
      "Para nosotros, Embat ha sido la solución que asegura claridad en tres niveles: el actual, las previsiones confirmadas y la previsión estimada.",
    author: "Michele Iaria, Corporate Finance Director en Molins",
  },
];

const footerColumns = [
  {
    title: "Producto",
    links: [
      "Gestión de Tesorería",
      "Gestión del Riesgo Financiero",
      "Pagos Corporativos",
      "Conciliación Automatizada",
      "Centro de Conectividad",
    ],
  },
  {
    title: "Plataforma",
    links: [
      "TellMe (AI)",
      "Precio",
      "Reglas de negocio",
      "Seguridad",
      "Changelog",
    ],
  },
  {
    title: "Empresa",
    links: ["Quienes somos", "Prensa", "Partners", "Empleo"],
  },
];

const legalLinks = [
  "Términos y Condiciones",
  "Política de Cookies",
  "Política de Privacidad",
  "Aviso Legal",
];
</script>

<template>
  <div class="landing marketing">
    <header class="nav">
      <div class="container nav-inner">
        <a href="#top" class="brand" aria-label="Embat">
          <EmbatLogo />
        </a>
        <nav class="nav-links" aria-label="Principal">
          <a v-for="link in navLinks" :key="link.label" :href="link.href">
            {{ link.label }}
          </a>
        </nav>
        <div class="nav-actions">
          <button type="button" class="link-button" @click="emit('start')">
            Login
          </button>
          <button type="button" class="button button-primary" @click="emit('start')">
            Empezar
          </button>
        </div>
      </div>
    </header>

    <section id="top" class="hero">
      <div class="container hero-inner">
        <span class="chip chip-inverse">
          <Sparkles class="size-4" />
          Tu nuevo Analista de Tesorería
        </span>
        <h1>
          La inteligencia artificial en finanzas que vive dentro de tu
          tesorería, desde el primer día
        </h1>
        <p class="lead">
          TellMe es el agente de IA de Embat, la inteligencia más avanzada
          especializada en tesorería corporativa. Vive dentro de cada proceso
          financiero de tu empresa: tesorería, contabilidad, pagos y
          optimización de caja. Ejecuta el trabajo que tu equipo no debería
          hacer manualmente y pone sobre la mesa las decisiones que necesitan
          tu criterio.
        </p>
        <div class="hero-actions">
          <button type="button" class="button button-primary button-lg" @click="emit('start')">
            Empezar
          </button>
          <a href="#modes" class="button button-ghost button-lg">Ver cómo funciona</a>
        </div>
        <img
          class="hero-visual"
          src="/landing/hero.svg"
          alt="Sugerencia de previsión de TellMe dentro de Embat"
          width="1312"
          height="278"
        />
      </div>
    </section>

    <section id="modes" class="section section-gray">
      <div class="container">
        <header class="section-header">
          <span class="eyebrow">Cómo funciona TellMe</span>
          <h2>Autónomo cuando puede serlo. Asistido cuando debe.</h2>
        </header>
        <div class="cards cards-3">
          <article v-for="mode in modes" :key="mode.title" class="card">
            <img :src="mode.image" :alt="mode.title" class="card-visual" loading="lazy" />
            <h3>{{ mode.title }}</h3>
            <p>{{ mode.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section id="features" class="section">
      <div class="container">
        <header class="section-header">
          <span class="eyebrow">La inteligencia detrás de Embat</span>
          <h2>¿Qué hace TellMe?</h2>
          <p class="section-sub">Un agente. Cuatro procesos.</p>
        </header>
        <div class="tabs" role="tablist" aria-label="Procesos">
          <button
            v-for="(tab, index) in featureTabs"
            :key="tab.label"
            type="button"
            role="tab"
            class="tab"
            :aria-selected="activeTab === index"
            @click="activeTab = index"
          >
            {{ tab.label }}
          </button>
        </div>
        <div class="cards cards-2" role="tabpanel">
          <article
            v-for="feature in featureTabs[activeTab]?.features"
            :key="feature.name"
            class="card card-soft"
          >
            <span class="feature-name">{{ feature.name }}</span>
            <h3>{{ feature.title }}</h3>
            <p>{{ feature.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <section id="results" class="section section-gray">
      <div class="container">
        <header class="section-header">
          <span class="eyebrow">Una plataforma. Todos los bancos. Control total.</span>
          <h2>Resultados reales de equipos financieros reales</h2>
          <p class="section-sub">Así describen el cambio los equipos que ya usan Embat.</p>
        </header>
        <div class="cards cards-3">
          <article v-for="result in results" :key="result.company" class="card">
            <span class="feature-name">{{ result.company }}</span>
            <span class="metric">{{ result.metric }}</span>
            <p class="metric-label">{{ result.label }}</p>
            <blockquote>«{{ result.quote }}»</blockquote>
            <cite>{{ result.author }}</cite>
          </article>
        </div>
      </div>
    </section>

    <section id="cta" class="section section-navy">
      <div class="container cta-inner">
        <span class="eyebrow eyebrow-inverse">Descubre la tesorería inteligente</span>
        <h2>¿Quieres ver lo que una tesorería inteligente puede hacer por ti?</h2>
        <p class="lead">
          En una sesión personalizada verás cómo la conciliación contable, la
          previsión de flujo de caja y la gestión de pagos dejan de ser una
          carga para tu equipo. Más tiempo para las decisiones que importan.
        </p>
        <button type="button" class="button button-primary button-lg" @click="emit('start')">
          Empezar
        </button>
      </div>
    </section>

    <footer id="footer" class="footer">
      <div class="container footer-inner">
        <div class="footer-brand">
          <EmbatLogo />
          <p>By humans for humans.<br />© Embat Technologies.</p>
        </div>
        <div v-for="column in footerColumns" :key="column.title" class="footer-column">
          <h4>{{ column.title }}</h4>
          <a v-for="link in column.links" :key="link" href="#top">{{ link }}</a>
        </div>
      </div>
      <div class="container footer-legal">
        <a v-for="link in legalLinks" :key="link" href="#top">{{ link }}</a>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.landing {
  flex: 1;
  background: #fff;
  color: var(--embat-navy);
  font-size: 16px;
  line-height: 1.5;
  font-variant-numeric: normal;
}

.container {
  width: 100%;
  max-width: 1312px;
  margin: 0 auto;
  padding: 0 32px;
}

h1,
h2,
h3,
h4 {
  margin: 0;
  font-weight: 500;
  line-height: 1.2;
}

h1 {
  font-size: clamp(2rem, 1.5rem + 2vw, 3.25rem);
  max-width: 24ch;
}

h2 {
  font-size: clamp(1.5rem, 1.1rem + 1.6vw, 2.5rem);
  max-width: 28ch;
}

h3 {
  font-size: clamp(1.125rem, 1rem + 0.5vw, 1.375rem);
}

p {
  margin: 0;
}

.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--embat-navy);
  color: #fff;
}

.nav-inner {
  display: flex;
  align-items: center;
  gap: 32px;
  height: 72px;
}

.brand {
  display: inline-flex;
  color: #fff;
}

.nav-links {
  display: flex;
  gap: 28px;
  font-weight: 500;
}

.nav-links a {
  color: rgba(255, 255, 255, 0.85);
  text-decoration: none;
  transition: color 0.3s;
}

.nav-links a:hover {
  color: #fff;
}

.nav-actions {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 20px;
}

.link-button {
  background: none;
  border: 0;
  padding: 0;
  color: #fff;
  font-weight: 500;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 24px;
  border: 1px solid transparent;
  border-radius: 999px;
  font-weight: 500;
  font-size: 1rem;
  line-height: 22px;
  text-decoration: none;
  transition:
    background 0.3s,
    border-color 0.3s;
}

.button-lg {
  padding: 16px 28px;
}

.button-primary {
  background: var(--embat-blue);
  border-color: var(--embat-blue);
  color: #fff;
}

.button-primary:hover {
  background: var(--embat-blue-hover);
  border-color: var(--embat-blue-hover);
}

.button-ghost {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.35);
}

.button-ghost:hover {
  border-color: #fff;
}

.hero {
  background:
    radial-gradient(60% 50% at 80% 10%, rgba(65, 93, 230, 0.35), transparent 70%),
    radial-gradient(40% 40% at 10% 80%, rgba(195, 87, 236, 0.25), transparent 70%),
    var(--embat-navy);
  color: #fff;
  padding: 72px 0 0;
}

.hero-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 24px;
}

.hero h1 {
  max-width: 22ch;
}

.lead {
  max-width: 68ch;
  font-size: 1.125rem;
  color: rgba(255, 255, 255, 0.82);
}

.hero-actions {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.hero-visual {
  display: block;
  width: 100%;
  height: auto;
  margin-top: 40px;
  border-radius: 12px 12px 0 0;
  box-shadow: 12px 12px 50px rgba(0, 0, 0, 0.4);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.875rem;
  font-weight: 500;
}

.chip-inverse {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fff;
}

.chip-inverse svg {
  color: #c357ec;
}

.section {
  padding: 80px 0;
  scroll-margin-top: 72px;
}

.section-gray {
  background: var(--embat-gray);
}

.section-navy {
  background: var(--embat-navy);
  color: #fff;
}

.section-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
  margin-bottom: 48px;
}

.section-header h2 {
  max-width: 24ch;
}

.section-sub {
  color: var(--embat-muted);
  font-size: 1.125rem;
}

.eyebrow {
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--embat-blue);
}

.eyebrow-inverse {
  color: #c357ec;
}

.cards {
  display: grid;
  gap: 24px;
}

.cards-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.cards-2 {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 28px;
  background: #fff;
  border: 1px solid var(--embat-line);
  border-radius: 12px;
  box-shadow: var(--embat-shadow-1);
  transition: box-shadow 0.3s;
}

.card:hover {
  box-shadow: var(--embat-shadow-3);
}

.card p {
  color: var(--embat-muted);
}

.card-soft {
  background: var(--embat-gray-soft);
}

.card-visual {
  width: 100%;
  height: auto;
  margin-bottom: 8px;
}

.feature-name {
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--embat-blue);
}

.tabs {
  display: flex;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 32px;
}

.tab {
  padding: 10px 18px;
  border: 1px solid var(--embat-line);
  border-radius: 999px;
  background: #fff;
  color: var(--embat-muted);
  font-weight: 500;
  transition:
    color 0.3s,
    background 0.3s;
}

.tab:hover {
  color: var(--embat-navy);
}

.tab[aria-selected="true"] {
  background: var(--embat-navy);
  border-color: var(--embat-navy);
  color: #fff;
}

.metric {
  font-size: 2.5rem;
  font-weight: 500;
  line-height: 1.1;
  background: var(--embat-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.metric-label {
  min-height: 3em;
}

blockquote {
  margin: 8px 0 0;
  padding-top: 16px;
  border-top: 1px solid var(--embat-line);
  color: var(--embat-navy);
}

cite {
  font-style: normal;
  font-size: 0.875rem;
  color: var(--embat-muted);
}

.cta-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 20px;
}

.cta-inner h2 {
  max-width: 24ch;
}

.footer {
  background: #fff;
  border-top: 1px solid var(--embat-line);
  padding: 56px 0 32px;
  font-size: 0.875rem;
}

.footer-inner {
  display: grid;
  grid-template-columns: 1.4fr repeat(3, 1fr);
  gap: 32px;
}

.footer-brand {
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--embat-muted);
}

.footer-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.footer-column h4 {
  font-size: 0.8rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--embat-muted);
  margin-bottom: 4px;
}

.footer a {
  color: var(--embat-navy);
  text-decoration: none;
}

.footer a:hover {
  color: var(--embat-blue);
}

.footer-legal {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--embat-line);
  color: var(--embat-muted);
}

.footer-legal a {
  color: var(--embat-muted);
}

@media (max-width: 899px) {
  .container {
    padding: 0 16px;
  }

  .nav-links {
    display: none;
  }

  .section {
    padding: 56px 0;
  }

  .cards-3,
  .cards-2,
  .footer-inner {
    grid-template-columns: 1fr;
  }
}
</style>
