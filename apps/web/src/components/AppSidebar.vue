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
  WalletCards,
} from "@lucide/vue";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
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

const roles = [
  { value: "tesorero", label: ROLE_LABELS.tesorero, initials: "TE" },
  { value: "financiero", label: ROLE_LABELS.financiero, initials: "FI" },
  { value: "ventas", label: ROLE_LABELS.ventas, initials: "VE" },
] satisfies { value: Role; label: string; initials: string }[];

const roleInitials = {
  tesorero: "TE",
  financiero: "FI",
  ventas: "VE",
} satisfies Record<Role, string>;
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
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu
        class="grid grid-cols-[minmax(0,1fr)_auto_auto] group-data-[collapsible=icon]:grid-cols-1"
      >
        <SidebarMenuItem class="min-w-0">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <SidebarMenuButton
                :tooltip="ROLE_LABELS[role]"
                aria-label="Cambiar rol"
              >
                <Avatar class="size-6">
                  <AvatarFallback class="bg-primary text-[10px] font-semibold text-primary-foreground">
                    {{ roleInitials[role] }}
                  </AvatarFallback>
                </Avatar>
                <span>{{ ROLE_LABELS[role] }}</span>
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              aria-label="Perfil"
              side="top"
              align="start"
            >
              <DropdownMenuRadioGroup :model-value="role">
                <DropdownMenuRadioItem
                  v-for="option in roles"
                  :key="option.value"
                  :value="option.value"
                  @select="emit('role', option.value)"
                >
                  <Avatar class="size-6">
                    <AvatarFallback class="text-[10px] font-semibold">
                      {{ option.initials }}
                    </AvatarFallback>
                  </Avatar>
                  {{ option.label }}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            class="w-auto group-data-[collapsible=icon]:w-full"
            tooltip="Ajustes · próximamente"
            aria-disabled="true"
            title="Próximamente"
          >
            <Settings />
            <span>Ajustes</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            class="w-auto group-data-[collapsible=icon]:w-full"
            tooltip="Alertas · próximamente"
            aria-label="Alertas · próximamente"
            aria-disabled="true"
            title="Próximamente"
          >
            <Bell />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
