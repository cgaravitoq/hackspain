<script setup lang="ts">
import { ROLE_LABELS, type Role } from "@hackspain/shared";
import { ArrowRight, ChartNoAxesCombined, Landmark, Users } from "@lucide/vue";
import type { Component } from "vue";
import EmbatLogo from "./EmbatLogo.vue";

const emit = defineEmits<{ select: [role: Role]; back: [] }>();

const roles = [
  {
    value: "tesorero",
    icon: Landmark,
    embat: false,
    text: "Sigues la caja de tu empresa día a día: radiografía, alertas y compromisos que puedes asumir.",
  },
  {
    value: "financiero",
    icon: ChartNoAxesCombined,
    embat: true,
    text: "Ves toda la cartera: comparas empresas, recorres el grafo de relaciones y preparas informes.",
  },
  {
    value: "ventas",
    icon: Users,
    embat: true,
    text: "Priorizas clientes por salud financiera y llegas a cada conversación con el contexto listo.",
  },
] satisfies { value: Role; icon: Component; embat: boolean; text: string }[];
</script>

<template>
  <div class="role-select marketing">
    <header class="role-header">
      <button type="button" class="brand" aria-label="Volver a la portada" @click="emit('back')">
        <EmbatLogo />
      </button>
    </header>
    <main class="role-main">
      <span class="eyebrow">Acceso a Embat</span>
      <h1>¿Con qué rol quieres entrar?</h1>
      <p class="lead">
        Embat adapta lo que ves a tu trabajo. Elige un rol para abrir el panel
        con la vista que te corresponde.
      </p>
      <div class="roles">
        <button
          v-for="role in roles"
          :key="role.value"
          type="button"
          class="role-card"
          :class="{ embat: role.embat }"
          @click="emit('select', role.value)"
        >
          <span class="role-icon">
            <component :is="role.icon" class="size-5" />
          </span>
          <span class="role-title">
            <span class="role-name">{{ ROLE_LABELS[role.value] }}</span>
            <span class="role-team">{{ role.embat ? "Equipo Embat" : "Cliente" }}</span>
          </span>
          <span class="role-text">{{ role.text }}</span>
          <span class="role-go">
            Entrar
            <ArrowRight class="size-4" />
          </span>
        </button>
      </div>
    </main>
  </div>
</template>

<style scoped>
.role-select {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--embat-gray);
  color: var(--embat-navy);
  font-size: 16px;
  line-height: 1.5;
}

.role-header {
  display: flex;
  align-items: center;
  height: 72px;
  padding: 0 32px;
  background: var(--embat-navy);
  color: #fff;
}

.brand {
  display: inline-flex;
  padding: 0;
  border: 0;
  background: none;
  color: #fff;
}

.role-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  width: 100%;
  max-width: 1040px;
  margin: 0 auto;
  padding: 72px 32px 80px;
}

h1 {
  margin: 0;
  font-size: clamp(1.75rem, 1.2rem + 1.8vw, 2.5rem);
  font-weight: 500;
  line-height: 1.2;
}

.eyebrow {
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--embat-blue);
}

.lead {
  margin: 0;
  max-width: 52ch;
  font-size: 1.125rem;
  color: var(--embat-muted);
}

.roles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  width: 100%;
  margin-top: 32px;
}

.role-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: 12px;
  padding: 28px;
  background: #fff;
  border: 1px solid var(--embat-line);
  border-radius: 12px;
  color: var(--embat-navy);
  box-shadow: var(--embat-shadow-1);
  transition:
    box-shadow 0.3s,
    border-color 0.3s;
}

.role-card:hover,
.role-card:focus-visible {
  border-color: var(--embat-blue);
  box-shadow: var(--embat-shadow-3);
  outline: none;
}

.role-card.embat {
  background: var(--embat-navy);
  border-color: var(--embat-navy);
  color: #fff;
}

.role-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: var(--embat-gradient);
  color: #fff;
}

.role-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.role-name {
  font-size: 1.25rem;
  font-weight: 500;
}

.role-team {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--embat-gray);
  color: var(--embat-muted);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.role-card.embat .role-team {
  background: var(--embat-navy-soft);
  color: #fff;
}

.role-text {
  color: var(--embat-muted);
  flex: 1;
}

.role-card.embat .role-text {
  color: #b4b7c6;
}

.role-go {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-weight: 500;
  color: var(--embat-blue);
}

.role-card.embat .role-go {
  color: #fff;
}

@media (max-width: 899px) {
  .role-header,
  .role-main {
    padding-left: 16px;
    padding-right: 16px;
  }

  .roles {
    grid-template-columns: 1fr;
  }
}
</style>
