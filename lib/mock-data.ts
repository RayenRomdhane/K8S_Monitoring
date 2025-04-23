import type { Cluster } from "@/lib/types"

// Generate a random ID
const generateId = () => Math.random().toString(36).substring(2, 9)

// Generate mock pod data
const generatePods = (namespacePrefix: string, count: number) => {
  return Array.from({ length: count }).map((_, i) => {
    const cpuUsage = Math.floor(Math.random() * 500) + 10
    const memoryUsage = Math.floor(Math.random() * 1000) + 50

    return {
      id: generateId(),
      name: `${namespacePrefix}-pod-${i + 1}`,
      cpuUsage,
      memoryUsage,
      pvcs: Math.random() > 0.5 ? [`${namespacePrefix}-pvc-${i + 1}`] : [],
      configMaps: Math.random() > 0.3 ? [`${namespacePrefix}-config-${i + 1}`] : [],
      secrets: Math.random() > 0.4 ? [`${namespacePrefix}-secret-${i + 1}`] : [],
      services: Math.random() > 0.6 ? [`${namespacePrefix}-svc-${i + 1}:80`] : [],
      ingresses: Math.random() > 0.7 ? [`${namespacePrefix}-${i + 1}.example.com`] : [],
    }
  })
}

// Generate mock namespace data
const generateNamespaces = (clusterPrefix: string) => {
  const namespaces = [
    "default",
    "kube-system",
    "kube-public",
    "monitoring",
    "logging",
    "app-frontend",
    "app-backend",
    "database",
    "ingress-nginx",
    "cert-manager",
  ]

  return namespaces.map((name) => {
    const podCount = Math.floor(Math.random() * 10) + 1
    const pods = generatePods(`${clusterPrefix}-${name}`, podCount)
    const cpuUsage = pods.reduce((sum, pod) => sum + pod.cpuUsage, 0)
    const memoryUsage = pods.reduce((sum, pod) => sum + pod.memoryUsage, 0)

    return {
      id: generateId(),
      name,
      podCount,
      cpuUsage,
      memoryUsage,
      pods,
    }
  })
}

// Generate mock cluster data based on context name
export function generateMockClusterData(contextName: string): Cluster {
  const cluster: Cluster = {
    id: contextName,
    name: contextName,
    context: contextName,
    cpuUsage: 0,
    cpuTotal: 16000,
    memoryUsage: 0,
    memoryTotal: 64000,
    namespaces: [],
  }

  // Generate namespaces based on context name
  cluster.namespaces = generateNamespaces(contextName)

  // Update cluster total resource usage based on namespace data
  cluster.cpuUsage = cluster.namespaces.reduce((sum, ns) => sum + ns.cpuUsage, 0)
  cluster.memoryUsage = cluster.namespaces.reduce((sum, ns) => sum + ns.memoryUsage, 0)

  return cluster
}
