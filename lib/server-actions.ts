"use server"

import { writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import { exec } from "child_process"
import { promisify } from "util"
import { load } from "js-yaml"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"
import type { KubeCommandResult, KubeContext, Cluster, Namespace } from "@/lib/types"

const execPromise = promisify(exec)

// Directory to store temporary kubeconfig files
const TEMP_DIR = join(process.cwd(), "tmp")

// Ensure temp directory exists
async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true })
  }
}

// Save kubeconfig file to temp directory
export async function saveKubeConfig(fileContent: string): Promise<KubeCommandResult> {
  try {
    await ensureTempDir()

    // Parse the YAML to validate it's a proper kubeconfig
    const parsedConfig = load(fileContent)

    if (!parsedConfig.contexts || !parsedConfig.clusters || !parsedConfig.users) {
      return {
        success: false,
        error: "Invalid kubeconfig file format. Missing required sections.",
      }
    }

    // Generate a unique filename
    const filePath = join(TEMP_DIR, `kubeconfig-${uuidv4()}`)

    // Write the file
    await writeFile(filePath, fileContent)

    return {
      success: true,
      data: {
        filePath,
      },
    }
  } catch (error) {
    console.error("Error saving kubeconfig:", error)
    return {
      success: false,
      error: `Failed to save kubeconfig: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Delete kubeconfig file
export async function deleteKubeConfig(filePath: string): Promise<KubeCommandResult> {
  try {
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error deleting kubeconfig:", error)
    return {
      success: false,
      error: `Failed to delete kubeconfig: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Get available contexts from kubeconfig
export async function getKubeContexts(filePath: string): Promise<KubeCommandResult> {
  try {
    const { stdout, stderr } = await execPromise(`kubectl config get-contexts --kubeconfig=${filePath} -o json`)

    if (stderr) {
      throw new Error(stderr)
    }

    const contexts = JSON.parse(stdout)
    const currentContext = await getCurrentContext(filePath)

    const formattedContexts: KubeContext[] = contexts.items.map((context: any) => ({
      name: context.name,
      cluster: context.context.cluster,
      user: context.context.user,
      namespace: context.context.namespace,
      current: context.name === currentContext,
    }))

    return {
      success: true,
      data: formattedContexts,
    }
  } catch (error) {
    console.error("Error getting kubeconfig contexts:", error)
    return {
      success: false,
      error: `Failed to get contexts: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Get current context
async function getCurrentContext(filePath: string): Promise<string> {
  try {
    const { stdout } = await execPromise(`kubectl config current-context --kubeconfig=${filePath}`)
    return stdout.trim()
  } catch (error) {
    console.error("Error getting current context:", error)
    return ""
  }
}

// Switch context
export async function switchContext(filePath: string, contextName: string): Promise<KubeCommandResult> {
  try {
    const { stderr } = await execPromise(`kubectl config use-context ${contextName} --kubeconfig=${filePath}`)

    if (stderr) {
      throw new Error(stderr)
    }

    return {
      success: true,
    }
  } catch (error) {
    console.error("Error switching context:", error)
    return {
      success: false,
      error: `Failed to switch context: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Get cluster information
export async function getClusterInfo(filePath: string, contextName: string): Promise<KubeCommandResult> {
  try {
    // Switch to the specified context
    const switchResult = await switchContext(filePath, contextName)
    if (!switchResult.success) {
      return switchResult
    }

    // Get namespaces
    const { stdout: nsStdout, stderr: nsStderr } = await execPromise(
      `kubectl get namespaces --kubeconfig=${filePath} -o json`,
    )

    if (nsStderr) {
      throw new Error(nsStderr)
    }

    const namespaces = JSON.parse(nsStdout)

    // Get node metrics
    let nodeMetrics
    try {
      const { stdout: metricsStdout } = await execPromise(`kubectl top nodes --kubeconfig=${filePath} --no-headers`)
      nodeMetrics = parseNodeMetrics(metricsStdout)
    } catch (error) {
      console.warn("Could not get node metrics, using defaults:", error)
      nodeMetrics = {
        cpuUsage: 0,
        cpuTotal: 8000, // Default values
        memoryUsage: 0,
        memoryTotal: 32000, // Default values
      }
    }

    // Create cluster object
    const cluster: Cluster = {
      id: contextName,
      name: contextName,
      context: contextName,
      cpuUsage: nodeMetrics.cpuUsage,
      cpuTotal: nodeMetrics.cpuTotal,
      memoryUsage: nodeMetrics.memoryUsage,
      memoryTotal: nodeMetrics.memoryTotal,
      namespaces: [],
    }

    // Get basic namespace info (we'll load detailed info when a namespace is selected)
    const namespacePromises = namespaces.items.map(async (ns: any) => {
      const nsName = ns.metadata.name

      // Get pod count
      const { stdout: podStdout } = await execPromise(
        `kubectl get pods -n ${nsName} --kubeconfig=${filePath} --no-headers 2>/dev/null | wc -l`,
      )
      const podCount = Number.parseInt(podStdout.trim(), 10) || 0

      // Try to get namespace resource usage
      let cpuUsage = 0
      let memoryUsage = 0

      try {
        const { stdout: nsMetricsStdout } = await execPromise(
          `kubectl top pods -n ${nsName} --kubeconfig=${filePath} --no-headers 2>/dev/null`,
        )

        const podMetrics = parseNamespaceMetrics(nsMetricsStdout)
        cpuUsage = podMetrics.cpuUsage
        memoryUsage = podMetrics.memoryUsage
      } catch (error) {
        console.warn(`Could not get metrics for namespace ${nsName}:`, error)
      }

      return {
        id: nsName,
        name: nsName,
        podCount,
        cpuUsage,
        memoryUsage,
        pods: [], // We'll load pods when the namespace is selected
      } as Namespace
    })

    cluster.namespaces = await Promise.all(namespacePromises)

    // Update cluster total resource usage based on namespace data
    cluster.cpuUsage = cluster.namespaces.reduce((sum, ns) => sum + ns.cpuUsage, 0)
    cluster.memoryUsage = cluster.namespaces.reduce((sum, ns) => sum + ns.memoryUsage, 0)

    return {
      success: true,
      data: cluster,
    }
  } catch (error) {
    console.error("Error getting cluster info:", error)
    return {
      success: false,
      error: `Failed to get cluster info: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Get namespace details
export async function getNamespaceDetails(
  filePath: string,
  contextName: string,
  namespaceName: string,
): Promise<KubeCommandResult> {
  try {
    // Switch to the specified context
    const switchResult = await switchContext(filePath, contextName)
    if (!switchResult.success) {
      return switchResult
    }

    // Get pods in the namespace
    const { stdout: podsStdout, stderr: podsStderr } = await execPromise(
      `kubectl get pods -n ${namespaceName} --kubeconfig=${filePath} -o json`,
    )

    if (podsStderr) {
      throw new Error(podsStderr)
    }

    const podsData = JSON.parse(podsStdout)

    // Get pod metrics
    let podMetricsMap: Record<string, { cpu: number; memory: number }> = {}

    try {
      const { stdout: metricsStdout } = await execPromise(
        `kubectl top pods -n ${namespaceName} --kubeconfig=${filePath} --no-headers`,
      )

      podMetricsMap = parsePodMetrics(metricsStdout)
    } catch (error) {
      console.warn(`Could not get pod metrics for namespace ${namespaceName}:`, error)
    }

    // Get PVCs, ConfigMaps, Secrets, Services, and Ingresses
    const [pvcs, configMaps, secrets, services, ingresses] = await Promise.all([
      getResourcesForNamespace(filePath, namespaceName, "pvc"),
      getResourcesForNamespace(filePath, namespaceName, "configmap"),
      getResourcesForNamespace(filePath, namespaceName, "secret"),
      getResourcesForNamespace(filePath, namespaceName, "service"),
      getResourcesForNamespace(filePath, namespaceName, "ingress"),
    ])

    // Create pod objects
    const pods = podsData.items.map((pod: any) => {
      const podName = pod.metadata.name
      const metrics = podMetricsMap[podName] || { cpu: 0, memory: 0 }

      // Find associated resources
      const podPvcs = findAssociatedResources(pod, pvcs)
      const podConfigMaps = findAssociatedResources(pod, configMaps)
      const podSecrets = findAssociatedResources(pod, secrets)
      const podServices = findAssociatedServices(pod, services)
      const podIngresses = findAssociatedIngresses(podServices, ingresses)

      return {
        id: podName,
        name: podName,
        cpuUsage: metrics.cpu,
        memoryUsage: metrics.memory,
        pvcs: podPvcs,
        configMaps: podConfigMaps,
        secrets: podSecrets,
        services: podServices,
        ingresses: podIngresses,
      }
    })

    // Calculate namespace totals
    const cpuUsage = pods.reduce((sum, pod) => sum + pod.cpuUsage, 0)
    const memoryUsage = pods.reduce((sum, pod) => sum + pod.memoryUsage, 0)

    const namespace: Namespace = {
      id: namespaceName,
      name: namespaceName,
      podCount: pods.length,
      cpuUsage,
      memoryUsage,
      pods,
    }

    return {
      success: true,
      data: namespace,
    }
  } catch (error) {
    console.error("Error getting namespace details:", error)
    return {
      success: false,
      error: `Failed to get namespace details: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Helper function to get resources for a namespace
async function getResourcesForNamespace(filePath: string, namespace: string, resourceType: string): Promise<any[]> {
  try {
    const { stdout, stderr } = await execPromise(
      `kubectl get ${resourceType} -n ${namespace} --kubeconfig=${filePath} -o json 2>/dev/null`,
    )

    if (stderr) {
      console.warn(`Warning getting ${resourceType}:`, stderr)
      return []
    }

    const data = JSON.parse(stdout)
    return data.items || []
  } catch (error) {
    console.warn(`Could not get ${resourceType} for namespace ${namespace}:`, error)
    return []
  }
}

// Helper function to parse node metrics
function parseNodeMetrics(metricsOutput: string): {
  cpuUsage: number
  cpuTotal: number
  memoryUsage: number
  memoryTotal: number
} {
  const lines = metricsOutput.trim().split("\n")
  let cpuUsage = 0
  let cpuTotal = 0
  let memoryUsage = 0
  let memoryTotal = 0

  lines.forEach((line) => {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 3) {
      // Parse CPU
      const cpuStr = parts[1]
      if (cpuStr.endsWith("m")) {
        cpuUsage += Number.parseInt(cpuStr.slice(0, -1), 10)
      } else {
        cpuUsage += Number.parseInt(cpuStr, 10) * 1000 // Convert cores to millicores
      }

      // Parse Memory
      const memStr = parts[2]
      if (memStr.endsWith("Mi")) {
        memoryUsage += Number.parseInt(memStr.slice(0, -2), 10)
      } else if (memStr.endsWith("Gi")) {
        memoryUsage += Number.parseInt(memStr.slice(0, -2), 10) * 1024 // Convert Gi to Mi
      } else if (memStr.endsWith("Ki")) {
        memoryUsage += Math.floor(Number.parseInt(memStr.slice(0, -2), 10) / 1024) // Convert Ki to Mi
      }

      // Estimate total resources (this is a rough estimate)
      cpuTotal += 4000 // Assume 4 cores per node
      memoryTotal += 16384 // Assume 16Gi per node
    }
  })

  return { cpuUsage, cpuTotal, memoryUsage, memoryTotal }
}

// Helper function to parse namespace metrics
function parseNamespaceMetrics(metricsOutput: string): { cpuUsage: number; memoryUsage: number } {
  const lines = metricsOutput.trim().split("\n")
  let cpuUsage = 0
  let memoryUsage = 0

  lines.forEach((line) => {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 3) {
      // Parse CPU
      const cpuStr = parts[1]
      if (cpuStr.endsWith("m")) {
        cpuUsage += Number.parseInt(cpuStr.slice(0, -1), 10)
      } else {
        cpuUsage += Number.parseInt(cpuStr, 10) * 1000 // Convert cores to millicores
      }

      // Parse Memory
      const memStr = parts[2]
      if (memStr.endsWith("Mi")) {
        memoryUsage += Number.parseInt(memStr.slice(0, -2), 10)
      } else if (memStr.endsWith("Gi")) {
        memoryUsage += Number.parseInt(memStr.slice(0, -2), 10) * 1024 // Convert Gi to Mi
      } else if (memStr.endsWith("Ki")) {
        memoryUsage += Math.floor(Number.parseInt(memStr.slice(0, -2), 10) / 1024) // Convert Ki to Mi
      }
    }
  })

  return { cpuUsage, memoryUsage }
}

// Helper function to parse pod metrics
function parsePodMetrics(metricsOutput: string): Record<string, { cpu: number; memory: number }> {
  const lines = metricsOutput.trim().split("\n")
  const result: Record<string, { cpu: number; memory: number }> = {}

  lines.forEach((line) => {
    const parts = line.trim().split(/\s+/)
    if (parts.length >= 3) {
      const podName = parts[0]

      // Parse CPU
      let cpu = 0
      const cpuStr = parts[1]
      if (cpuStr.endsWith("m")) {
        cpu = Number.parseInt(cpuStr.slice(0, -1), 10)
      } else {
        cpu = Number.parseInt(cpuStr, 10) * 1000 // Convert cores to millicores
      }

      // Parse Memory
      let memory = 0
      const memStr = parts[2]
      if (memStr.endsWith("Mi")) {
        memory = Number.parseInt(memStr.slice(0, -2), 10)
      } else if (memStr.endsWith("Gi")) {
        memory = Number.parseInt(memStr.slice(0, -2), 10) * 1024 // Convert Gi to Mi
      } else if (memStr.endsWith("Ki")) {
        memory = Math.floor(Number.parseInt(memStr.slice(0, -2), 10) / 1024) // Convert Ki to Mi
      }

      result[podName] = { cpu, memory }
    }
  })

  return result
}

// Helper function to find associated resources
function findAssociatedResources(pod: any, resources: any[]): string[] {
  const result: string[] = []

  // Check volumes for PVCs, ConfigMaps, and Secrets
  if (pod.spec && pod.spec.volumes) {
    pod.spec.volumes.forEach((volume: any) => {
      if (volume.persistentVolumeClaim && volume.persistentVolumeClaim.claimName) {
        const pvc = resources.find((r) => r.metadata.name === volume.persistentVolumeClaim.claimName)
        if (pvc) {
          result.push(pvc.metadata.name)
        }
      } else if (volume.configMap && volume.configMap.name) {
        const configMap = resources.find((r) => r.metadata.name === volume.configMap.name)
        if (configMap) {
          result.push(configMap.metadata.name)
        }
      } else if (volume.secret && volume.secret.secretName) {
        const secret = resources.find((r) => r.metadata.name === volume.secret.secretName)
        if (secret) {
          result.push(secret.metadata.name)
        }
      }
    })
  }

  // Check environment variables for ConfigMaps and Secrets
  if (pod.spec && pod.spec.containers) {
    pod.spec.containers.forEach((container: any) => {
      if (container.env) {
        container.env.forEach((env: any) => {
          if (env.valueFrom) {
            if (env.valueFrom.configMapKeyRef && env.valueFrom.configMapKeyRef.name) {
              const configMap = resources.find((r) => r.metadata.name === env.valueFrom.configMapKeyRef.name)
              if (configMap && !result.includes(configMap.metadata.name)) {
                result.push(configMap.metadata.name)
              }
            } else if (env.valueFrom.secretKeyRef && env.valueFrom.secretKeyRef.name) {
              const secret = resources.find((r) => r.metadata.name === env.valueFrom.secretKeyRef.name)
              if (secret && !result.includes(secret.metadata.name)) {
                result.push(secret.metadata.name)
              }
            }
          }
        })
      }
    })
  }

  return [...new Set(result)] // Remove duplicates
}

// Helper function to find associated services
function findAssociatedServices(pod: any, services: any[]): string[] {
  const result: string[] = []

  if (pod.metadata && pod.metadata.labels) {
    services.forEach((service) => {
      if (service.spec && service.spec.selector) {
        // Check if all selector labels match pod labels
        const matches = Object.entries(service.spec.selector).every(
          ([key, value]) => pod.metadata.labels[key] === value,
        )

        if (matches) {
          // Format service with ports
          let serviceName = service.metadata.name
          if (service.spec.ports && service.spec.ports.length > 0) {
            const ports = service.spec.ports.map((port: any) => port.port).join(",")
            serviceName = `${serviceName}:${ports}`
          }
          result.push(serviceName)
        }
      }
    })
  }

  return result
}

// Helper function to find associated ingresses
function findAssociatedIngresses(serviceNames: string[], ingresses: any[]): string[] {
  const result: string[] = []
  const serviceBasenames = serviceNames.map((s) => s.split(":")[0]) // Remove port numbers

  ingresses.forEach((ingress) => {
    if (ingress.spec && ingress.spec.rules) {
      ingress.spec.rules.forEach((rule: any) => {
        if (rule.http && rule.http.paths) {
          rule.http.paths.forEach((path: any) => {
            if (path.backend && path.backend.service && path.backend.service.name) {
              if (serviceBasenames.includes(path.backend.service.name)) {
                if (rule.host) {
                  result.push(rule.host)
                }
              }
            }
          })
        }
      })
    }
  })

  return [...new Set(result)] // Remove duplicates
}
