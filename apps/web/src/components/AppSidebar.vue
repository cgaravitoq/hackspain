<script setup lang="ts">
import { ROLE_LABELS, type Role } from "@hackspain/shared";
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
  Zap,
} from "@lucide/vue";
import {
  CollapsibleContent,
  CollapsibleRoot,
  CollapsibleTrigger,
} from "reka-ui";
import { Avatar, AvatarFallback } from "./ui/avatar";
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

defineProps<{ view: View; role: Role }>();

const emit = defineEmits<{ view: [view: View] }>();

const roleInitials = {
  tesorero: "TE",
  financiero: "FI",
  ventas: "VE",
} satisfies Record<Role, string>;

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
      <SidebarMenu>
        <SidebarMenuItem class="min-w-0">
          <SidebarMenuButton
            as="div"
            role="img"
            class="cursor-default gap-1 px-1 hover:bg-transparent"
            :tooltip="ROLE_LABELS[role]"
            :aria-label="`Rol: ${ROLE_LABELS[role]}`"
          >
            <Avatar class="size-6">
              <AvatarFallback class="bg-primary text-[10px] font-semibold text-primary-foreground">
                {{ roleInitials[role] }}
              </AvatarFallback>
            </Avatar>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>
