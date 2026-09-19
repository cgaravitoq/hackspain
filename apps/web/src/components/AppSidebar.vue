<script setup lang="ts">
import type { Role } from "@hackspain/shared";
import {
  Activity,
  BookOpen,
  ChartLine,
  ChartPie,
  ChevronRight,
  Landmark,
  LayoutDashboard,
  ScanSearch,
  Send,
  Sparkles,
  Zap,
} from "@lucide/vue";
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "reka-ui";
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
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
} from "./ui/sidebar";

type View = "radiography" | "graph";

defineProps<{
  view: View;
  role: Role;
  chatOpen: boolean;
  chatUnread: boolean;
  chatDisabled: boolean;
}>();

const emit = defineEmits<{ view: [view: View]; chat: [] }>();

const menuBeforeAnalytics = [
  { label: "Inicio", icon: LayoutDashboard },
  { label: "Conectividad", icon: Activity },
  { label: "Transacciones", icon: Landmark },
  { label: "Tesorería y previsiones", icon: ChartLine },
];

const menuAfterAnalytics = [
  { label: "Contabilidad", icon: BookOpen },
  { label: "Pagos", icon: Send },
  { label: "Automatización", icon: Zap },
];
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" tooltip="Embat">
            <span class="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <ScanSearch class="size-4" />
            </span>
            <span class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">Embat</span>
            </span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu aria-label="Pantalla">
            <SidebarMenuItem
              v-for="item in menuBeforeAnalytics"
              :key="item.label"
            >
              <SidebarMenuButton
                class="aria-disabled:pointer-events-auto"
                tooltip="Próximamente"
                aria-disabled="true"
                title="Próximamente"
              >
                <component :is="item.icon" />
                <span>{{ item.label }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <CollapsibleRoot default-open as-child>
              <SidebarMenuItem>
                <SidebarMenuButton as-child tooltip="Analítica">
                  <CollapsibleTrigger>
                    <ChartPie />
                    <span>Analítica</span>
                    <ChevronRight class="ml-auto transition-transform data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                </SidebarMenuButton>
                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem>
                      <SidebarMenuSubButton
                        as="button"
                        :is-active="view === 'radiography'"
                        @click="emit('view', 'radiography')"
                      >
                        <span>Radiografía</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                    <SidebarMenuSubItem v-if="role !== 'tesorero'">
                      <SidebarMenuSubButton
                        as="button"
                        :is-active="view === 'graph'"
                        @click="emit('view', 'graph')"
                      >
                        <span>Grafo</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </CollapsibleRoot>
            <SidebarMenuItem
              v-for="item in menuAfterAnalytics"
              :key="item.label"
            >
              <SidebarMenuButton
                class="aria-disabled:pointer-events-auto"
                tooltip="Próximamente"
                aria-disabled="true"
                title="Próximamente"
              >
                <component :is="item.icon" />
                <span>{{ item.label }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter>
      <SidebarMenu class="flex-row items-center group-data-[collapsible=icon]:flex-col">
        <SidebarMenuItem>
          <SidebarMenuButton
            class="w-auto group-data-[collapsible=icon]:p-1.5!"
            tooltip="TellMe"
            aria-label="Abrir el asistente"
            :aria-expanded="chatOpen"
            :is-active="chatOpen"
            :disabled="chatDisabled"
            @click="emit('chat')"
          >
            <span class="flex size-5 shrink-0 items-center justify-center rounded-md bg-(image:--embat-gradient) text-white">
              <Sparkles class="size-3" />
            </span>
            <span class="font-semibold">TellMe</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem v-if="chatUnread && !chatDisabled" class="group-data-[collapsible=icon]:hidden">
          <button
            type="button"
            class="insight"
            @click="emit('chat')"
          >
            1 nuevo insight
          </button>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>

<style scoped>
.insight {
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: #ecdcfb;
  color: var(--embat-purple);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.insight:hover {
  background: #e2cdf9;
}
</style>
