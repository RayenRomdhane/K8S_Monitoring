import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execPromise = promisify(exec)

// Mise à jour de la fonction parsePodMetrics pour corriger le calcul de la mémoire
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

      // Parse Memory - Correction du calcul de la mémoire
      let memory = 0
      const memStr = parts[2]
      if (memStr.endsWith("Mi")) {
        memory = Number.parseInt(memStr.slice(0, -2), 10)
      } else if (memStr.endsWith("Gi")) {
        memory = Number.parseInt(memStr.slice(0, -2), 10) * 1024 // Convert Gi to Mi
      } else if (memStr.endsWith("Ki")) {
        memory = Math.floor(Number.parseInt(memStr.slice(0, -2), 10) / 1024) // Convert Ki to Mi
      } else if (memStr.endsWith("m")) {
        // Handle potential 'm' suffix for memory (though unusual)
        memory = Number.parseInt(memStr.slice(0, -1), 10) / 1024 / 1024 // Convert bytes to Mi
      } else {
        // Assume bytes if no unit
        memory = Number.parseInt(memStr, 10) / 1024 / 1024 // Convert bytes to Mi
      }

      result[podName] = { cpu, memory }
    }
  })

  return result
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

export async function POST(request: Request) {
  try {
    const { filePath, contextName, namespaceName } = await request.json()

    if (!filePath || !contextName || !namespaceName) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Security check: Ensure the file path is within our temp directory
    if (!filePath.includes("tmp/kubeconfig-")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    // Switch to the specified context
    const switchResult = await execPromise(`kubectl config use-context ${contextName} --kubeconfig=${filePath}`)
    if (switchResult.stderr) {
      return NextResponse.json({ error: switchResult.stderr }, { status: 500 })
    }

    // Get pods in the namespace
    const { stdout: podsStdout, stderr: podsStderr } = await execPromise(
      `kubectl get pods -n ${namespaceName} --kubeconfig=${filePath} -o json`,
    )

    if (podsStderr) {
      return NextResponse.json({ error: podsStderr }, { status: 500 })
    }

    const podsData = JSON.parse(podsStdout)

    // Get pod metrics
    let podMetricsMap: Record<string, { cpu: number; memory: number }> = {}

    try {
      const { stdout: metricsStdout } = await execPromise(
        `kubectl top pods -n ${namespaceName} --kubeconfig=${filePath} --no-headers 2>/dev/null`,
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

    const namespace = {
      id: namespaceName,
      name: namespaceName,
      podCount: pods.length,
      cpuUsage,
      memoryUsage,
      pods,
    }

    return NextResponse.json({
      success: true,
      namespace,
    })
  } catch (error) {
    console.error("Error getting namespace details:", error)
    return NextResponse.json(
      { error: `Failed to get namespace details: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
