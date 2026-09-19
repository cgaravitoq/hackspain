<script setup lang="ts">
import { ROLE_LABELS, type Role } from "@hackspain/shared";
import {
  Bell,
  ChartNoAxesCombined,
  FlaskConical,
  MessageSquareText,
  Network,
  ScanSearch,
  Settings,
  TriangleAlert,
  UserRound,
  WalletCards,
} from "@lucide/vue";
import { onMounted, ref } from "vue";
import { Button } from "./ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "./ui/sidebar";

const SEEN_KEY = "xray.chat.seen";

type View = "radiography" | "graph";

defineProps<{ view: View; role: Role }>();

const emit = defineEmits<{
  chat: [];
  role: [role: Role];
  view: [view: View];
}>();

// SAFETY: ROLE_LABELS is declared as Record<Role, string> at the shared boundary.
const roles = Object.entries(ROLE_LABELS) as [Role, string][];
const seen = ref(false);

function openChat() {
  seen.value = true;
  try {
    window.localStorage.setItem(SEEN_KEY, "true");
  } catch {
    seen.value = true;
  }
  emit("chat");
}

onMounted(() => {
  try {
    seen.value = window.localStorage.getItem(SEEN_KEY) === "true";
  } catch {
    seen.value = false;
  }
});
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" tooltip="X Ray">
            <span class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanSearch class="size-4" />
            </span>
            <span class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">X Ray</span>
              <span class="truncate text-xs">Embat</span>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <div class="flex gap-2 group-data-[collapsible=icon]:flex-col">
        <SidebarMenuButton
          class="relative bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
          tooltip="Preguntar al agente"
          aria-label="Abrir el asistente"
          @click="openChat"
        >
          <MessageSquareText />
          <span>Preguntar al agente</span>
          <span
            v-if="!seen"
            class="absolute top-0 right-0 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] text-white"
            aria-label="1 aviso"
          >1</span>
        </SidebarMenuButton>
        <Button
          class="shrink-0 group-data-[collapsible=icon]:size-8"
          variant="outline"
          size="icon"
          type="button"
          aria-disabled="true"
          title="Próximamente"
        >
          <Bell />
          <span class="sr-only">Notificaciones - Próximamente</span>
        </Button>
      </div>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu aria-label="Pantalla">
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Radiografía"
                :is-active="view === 'radiography'"
                @click="emit('view', 'radiography')"
              >
                <ChartNoAxesCombined />
                <span>Radiografía</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Grafo"
                :is-active="view === 'graph'"
                @click="emit('view', 'graph')"
              >
                <Network />
                <span>Grafo</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Próximamente"
                aria-disabled="true"
                title="Próximamente"
              >
                <TriangleAlert />
                <span>Alertas</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Próximamente"
                aria-disabled="true"
                title="Próximamente"
              >
                <FlaskConical />
                <span>Simulador</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Próximamente"
                aria-disabled="true"
                title="Próximamente"
              >
                <WalletCards />
                <span>Cartera</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup>
        <SidebarGroupLabel>Roles</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu class="role-menu" aria-label="Perfil">
            <SidebarMenuItem v-for="[value, label] in roles" :key="value">
              <SidebarMenuButton
                :tooltip="label"
                :is-active="role === value"
                @click="emit('role', value)"
              >
                <UserRound />
                <span>{{ label }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Próximamente"
            aria-disabled="true"
            title="Próximamente"
          >
            <Settings />
            <span>Ajustes</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
