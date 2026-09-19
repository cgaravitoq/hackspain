<script setup lang="ts">
import { type Role, roleSchema } from "@hackspain/shared";
import { onMounted, onUnmounted, ref } from "vue";
import App from "./App.vue";
import LandingPage from "./components/LandingPage.vue";
import RoleSelect from "./components/RoleSelect.vue";

type Page = "landing" | "roles" | "app";
type Route = { page: Page; role?: Role };

const ROLES_PATH = "/start";
const APP_PATH = "/app";

function parseRoute(pathname: string): Route {
  if (pathname === ROLES_PATH) return { page: "roles" };
  if (pathname === APP_PATH || pathname.startsWith(`${APP_PATH}/`)) {
    const role = roleSchema.safeParse(pathname.slice(APP_PATH.length + 1));
    return { page: "app", role: role.success ? role.data : undefined };
  }
  return { page: "landing" };
}

function pathFor(route: Route): string {
  if (route.page === "roles") return ROLES_PATH;
  if (route.page === "app") return `${APP_PATH}/${route.role}`;
  return "/";
}

const route = ref<Route>(parseRoute(window.location.pathname));

function go(next: Route) {
  route.value = next;
  window.history.pushState(null, "", pathFor(next));
}

function syncRoute() {
  route.value = parseRoute(window.location.pathname);
}

onMounted(() => window.addEventListener("popstate", syncRoute));
onUnmounted(() => window.removeEventListener("popstate", syncRoute));
</script>

<template>
  <App
    v-if="route.page === 'app'"
    :key="route.role"
    :initial-role="route.role"
  />
  <RoleSelect
    v-else-if="route.page === 'roles'"
    @select="(role) => go({ page: 'app', role })"
    @back="go({ page: 'landing' })"
  />
  <LandingPage v-else @start="go({ page: 'roles' })" />
</template>
