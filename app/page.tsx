"use client"

import { useState } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { KubeConfigUpload } from "@/components/kube-config-upload"
import { ClusterDashboard } from "@/components/cluster-dashboard"
import { ClusterSidebar } from "@/components/cluster-sidebar"
import { NamespaceDetails } from "@/components/namespace-details"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import type { Cluster, KubeConfig, Namespace, KubeContext } from "@/lib/types"
import { getKubeContexts, getClusterInfo, getNamespaceDetails } from "@/lib/kube-parser"

export default function Home() {
  const [kubeConfig, setKubeConfig] = useState<KubeConfig | null>(null)
  const [contexts, setContexts] = useState<KubeContext[]>([])
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleFileUpload = async (content: string, fileName: string) => {
    setIsLoading(true)
    try {
      setKubeConfig({
        fileName,
        uploadedAt: new Date().toISOString(),
        content,
      })

      // Get available contexts from the kubeconfig
      const contextsResult = await getKubeContexts(content)

      if (!contextsResult.success || !contextsResult.data) {
        throw new Error(contextsResult.error || "Failed to get contexts from kubeconfig")
      }

      setContexts(contextsResult.data)
      setSelectedCluster(null)
      setSelectedNamespace(null)

      toast({
        title: "KubeConfig uploaded successfully",
        description: `File: ${fileName}`,
      })
    } catch (error) {
      toast({
        title: "Failed to parse KubeConfig",
        description: error instanceof Error ? error.message : "Please check the file format and try again",
        variant: "destructive",
      })

      // Clean up on error
      setKubeConfig(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClusterSelect = async (context: KubeContext) => {
    if (!kubeConfig?.content) return

    setIsLoading(true)
    setSelectedCluster(null)
    setSelectedNamespace(null)

    try {
      const clusterResult = await getClusterInfo(kubeConfig.content, context.name)

      if (!clusterResult.success || !clusterResult.data) {
        throw new Error(clusterResult.error || "Failed to get cluster information")
      }

      setSelectedCluster(clusterResult.data)

      toast({
        title: "Cluster loaded",
        description: `Context: ${context.name}`,
      })
    } catch (error) {
      toast({
        title: "Failed to load cluster",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleNamespaceSelect = async (namespace: Namespace) => {
    if (!kubeConfig?.content || !selectedCluster) return

    setIsLoading(true)

    try {
      const namespaceResult = await getNamespaceDetails(kubeConfig.content, selectedCluster.context, namespace.name)

      if (!namespaceResult.success || !namespaceResult.data) {
        throw new Error(namespaceResult.error || "Failed to get namespace details")
      }

      setSelectedNamespace(namespaceResult.data)
    } catch (error) {
      toast({
        title: "Failed to load namespace details",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefreshData = async () => {
    if (!kubeConfig?.content || !selectedCluster) return

    setIsLoading(true)

    try {
      if (selectedNamespace) {
        // Refresh namespace details
        const namespaceResult = await getNamespaceDetails(
          kubeConfig.content,
          selectedCluster.context,
          selectedNamespace.name,
        )

        if (!namespaceResult.success || !namespaceResult.data) {
          throw new Error(namespaceResult.error || "Failed to refresh namespace details")
        }

        setSelectedNamespace(namespaceResult.data)
      } else {
        // Refresh cluster info
        const clusterResult = await getClusterInfo(kubeConfig.content, selectedCluster.context)

        if (!clusterResult.success || !clusterResult.data) {
          throw new Error(clusterResult.error || "Failed to refresh cluster information")
        }

        setSelectedCluster(clusterResult.data)
      }

      toast({
        title: "Data refreshed",
        description: selectedNamespace ? `Namespace: ${selectedNamespace.name}` : `Cluster: ${selectedCluster.name}`,
      })
    } catch (error) {
      toast({
        title: "Failed to refresh data",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SidebarProvider>
        <div className="flex min-h-screen">
          {kubeConfig ? (
            <>
              <ClusterSidebar
                contexts={contexts}
                selectedCluster={selectedCluster}
                onClusterSelect={handleClusterSelect}
                onRefreshData={handleRefreshData}
                isLoading={isLoading}
              />
              <main className="flex-1 overflow-auto">
                {selectedCluster ? (
                  selectedNamespace ? (
                    <NamespaceDetails
                      cluster={selectedCluster}
                      namespace={selectedNamespace}
                      onBack={() => setSelectedNamespace(null)}
                      isLoading={isLoading}
                      onRefresh={handleRefreshData}
                    />
                  ) : (
                    <ClusterDashboard
                      cluster={selectedCluster}
                      onNamespaceSelect={handleNamespaceSelect}
                      isLoading={isLoading}
                      onRefresh={handleRefreshData}
                    />
                  )
                ) : (
                  <div className="flex items-center justify-center h-full p-8">
                    <div className="max-w-md text-center">
                      <h2 className="text-2xl font-bold mb-4">Select a Cluster</h2>
                      <p className="text-muted-foreground">
                        Choose a cluster from the sidebar to view its details and resource usage.
                      </p>
                    </div>
                  </div>
                )}
              </main>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8">
              <KubeConfigUpload onFileUpload={handleFileUpload} isLoading={isLoading} />
            </div>
          )}
        </div>
        <Toaster />
      </SidebarProvider>
    </ThemeProvider>
  )
}
