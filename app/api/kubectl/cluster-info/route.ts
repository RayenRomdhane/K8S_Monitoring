import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execPromise = promisify(exec)

// Mise à jour de la fonction parseNodeMetrics pour corriger le calcul de la mémoire
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

      // Parse Memory - Correction du calcul de la mémoire
      const memStr = parts[2]
      if (memStr.endsWith("Mi")) {
        memoryUsage += Number.parseInt(memStr.slice(0, -2), 10)
      } else if (memStr.endsWith("Gi")) {
        memoryUsage += Number.parseInt(memStr.slice(0, -2), 10) * 1024 // Convert Gi to Mi
      } else if (memStr.endsWith("Ki")) {
        memoryUsage += Math.floor(Number.parseInt(memStr.slice(0, -2), 10) / 1024) // Convert Ki to Mi
      } else if (memStr.endsWith("m")) {
        // Handle potential 'm' suffix for memory (though unusual)
        memoryUsage += Number.parseInt(memStr.slice(0, -1), 10) / 1024 / 1024 // Convert bytes to Mi
      } else {
        // Assume bytes if no unit
        memoryUsage += Number.parseInt(memStr, 10) / 1024 / 1024 // Convert bytes to Mi
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

export async function POST(request: Request) {
  try {
    const { filePath, contextName } = await request.json()

    if (!filePath || !contextName) {
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

    // Get namespaces
    const { stdout: nsStdout, stderr: nsStderr } = await execPromise(
      `kubectl get namespaces --kubeconfig=${filePath} -o json`,
    )

    if (nsStderr) {
      return NextResponse.json({ error: nsStderr }, { status: 500 })
    }

    const namespaces = JSON.parse(nsStdout)

    // Get node metrics
    let nodeMetrics
    try {
      const { stdout: metricsStdout } = await execPromise(
        `kubectl top nodes --kubeconfig=${filePath} --no-headers 2>/dev/null`,
      )
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
    const cluster = {
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
      }
    })

    cluster.namespaces = await Promise.all(namespacePromises)

    // Update cluster total resource usage based on namespace data
    cluster.cpuUsage = cluster.namespaces.reduce((sum, ns) => sum + ns.cpuUsage, 0)
    cluster.memoryUsage = cluster.namespaces.reduce((sum, ns) => sum + ns.memoryUsage, 0)

    return NextResponse.json({
      success: true,
      cluster,
    })
  } catch (error) {
    console.error("Error getting cluster info:", error)
    return NextResponse.json(
      { error: `Failed to get cluster info: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
