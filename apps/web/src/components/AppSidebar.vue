<script setup lang="ts">
import { ROLE_LABELS, type Role } from "@hackspain/shared";
import {
  Bell,
  ChartNoAxesCombined,
  FlaskConical,
  Network,
  ScanSearch,
  Settings,
  TriangleAlert,
  UserRound,
  WalletCards,
} from "@lucide/vue";
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

type View = "radiography" | "graph";

defineProps<{ view: View; role: Role }>();

const emit = defineEmits<{
  role: [role: Role];
  view: [view: View];
}>();

// SAFETY: ROLE_LABELS is declared as Record<Role, string> at the shared boundary.
const roles = Object.entries(ROLE_LABELS) as [Role, string][];
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
      <div class="flex justify-end">
        <Button
          class="shrink-0"
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
