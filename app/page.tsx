"use client"

import { useState, useEffect } from "react"
import { ThemeProvider } from "@/components/theme-provider"
import { KubeConfigUpload } from "@/components/kube-config-upload"
import { ClusterDashboard } from "@/components/cluster-dashboard"
import { ClusterSidebar } from "@/components/cluster-sidebar"
import { NamespaceDetails } from "@/components/namespace-details"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { useToast } from "@/hooks/use-toast"
import type { Cluster, KubeConfig, Namespace, KubeContext } from "@/lib/types"
import { getKubeContexts, getClusterInfo, getNamespaceDetails, deleteKubeConfig } from "@/lib/api-client"

export default function Home() {
  const [kubeConfig, setKubeConfig] = useState<KubeConfig | null>(null)
  const [contexts, setContexts] = useState<KubeContext[]>([])
  const [selectedCluster, setSelectedCluster] = useState<Cluster | null>(null)
  const [selectedNamespace, setSelectedNamespace] = useState<Namespace | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  // Clean up kubeconfig file when component unmounts
  useEffect(() => {
    return () => {
      if (kubeConfig?.filePath) {
        deleteKubeConfig(kubeConfig.filePath).catch(console.error)
      }
    }
  }, [kubeConfig])

  const handleFileUpload = async (filePath: string, fileName: string) => {
    setIsLoading(true)
    try {
      setKubeConfig({
        fileName,
        uploadedAt: new Date().toISOString(),
        filePath,
      })

      // Get available contexts from the kubeconfig
      const contextsData = await getKubeContexts(filePath)
      setContexts(contextsData)
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
      if (kubeConfig?.filePath) {
        deleteKubeConfig(kubeConfig.filePath).catch(console.error)
      }
      setKubeConfig(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClusterSelect = async (context: KubeContext) => {
    if (!kubeConfig?.filePath) return

    setIsLoading(true)
    setSelectedCluster(null)
    setSelectedNamespace(null)

    try {
      const clusterData = await getClusterInfo(kubeConfig.filePath, context.name)
      setSelectedCluster(clusterData)

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
    if (!kubeConfig?.filePath || !selectedCluster) return

    setIsLoading(true)

    try {
      const namespaceData = await getNamespaceDetails(kubeConfig.filePath, selectedCluster.context, namespace.name)

      setSelectedNamespace(namespaceData)
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
    if (!kubeConfig?.filePath || !selectedCluster) return

    setIsLoading(true)

    try {
      if (selectedNamespace) {
        // Refresh namespace details
        const namespaceData = await getNamespaceDetails(
          kubeConfig.filePath,
          selectedCluster.context,
          selectedNamespace.name,
        )

        setSelectedNamespace(namespaceData)
      } else {
        // Refresh cluster info
        const clusterData = await getClusterInfo(kubeConfig.filePath, selectedCluster.context)
        setSelectedCluster(clusterData)
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
