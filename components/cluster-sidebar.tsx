"use client"

import { RefreshCw, Server, ChevronLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { ThemeToggle } from "@/components/theme-toggle"
import type { Cluster, KubeContext } from "@/lib/types"

interface ClusterSidebarProps {
  contexts: KubeContext[]
  selectedCluster: Cluster | null
  onClusterSelect: (context: KubeContext) => void
  onRefreshData: () => void
  isLoading: boolean
}

export function ClusterSidebar({
  contexts,
  selectedCluster,
  onClusterSelect,
  onRefreshData,
  isLoading,
}: ClusterSidebarProps) {
  const { isMobile } = useSidebar()

  return (
    <Sidebar>
      <SidebarHeader className="flex flex-row items-center justify-between p-4">
        <div className="flex items-center gap-2">
          <Server className="h-6 w-6" />
          <h1 className="text-xl font-bold">K8s Monitor</h1>
        </div>
        {isMobile && <SidebarTrigger />}
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Clusters</h2>
          <SidebarMenu>
            {contexts.map((context) => (
              <SidebarMenuItem key={context.name}>
                <SidebarMenuButton
                  isActive={selectedCluster?.context === context.name}
                  onClick={() => onClusterSelect(context)}
                >
                  <Server className="h-4 w-4" />
                  <span>{context.name}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </div>
      </SidebarContent>
      <SidebarFooter className="p-4 space-y-4">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={onRefreshData}
          disabled={!selectedCluster || isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Data
        </Button>
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <ThemeToggle />
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
