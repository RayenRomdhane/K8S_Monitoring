// Browser-compatible kubeconfig parser
import type { KubeContext, KubeCommandResult } from "@/lib/types"
import { generateMockClusterData } from "@/lib/mock-data"

// Parse kubeconfig YAML
export async function parseKubeConfig(content: string): Promise<KubeCommandResult> {
  try {
    // In a real implementation, we would use js-yaml to parse the YAML
    // But for the browser preview, we'll do a simple validation
    if (!content.includes("apiVersion: v1") || !content.includes("kind: Config")) {
      return {
        success: false,
        error: "Invalid kubeconfig file format. Missing required sections.",
      }
    }

    return {
      success: true,
      data: { content },
    }
  } catch (error) {
    console.error("Error parsing kubeconfig:", error)
    return {
      success: false,
      error: `Failed to parse kubeconfig: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Extract contexts from kubeconfig content
export async function getKubeContexts(content: string): Promise<KubeCommandResult> {
  try {
    // In a real implementation, we would parse the YAML and extract contexts
    // For the browser preview, we'll extract context names using regex
    const contextMatches = content.match(/context:\s*\n\s*cluster:\s*([\w-]+)\s*\n\s*user:\s*([\w-]+)/g) || []
    const nameMatches = content.match(/name:\s*([\w-]+)/g) || []

    // Extract current-context if available
    const currentContextMatch = content.match(/current-context:\s*([\w-]+)/)
    const currentContext = currentContextMatch ? currentContextMatch[1] : ""

    // Create mock contexts based on the extracted names
    const contexts: KubeContext[] = []

    // Use the first few name matches as context names
    for (let i = 0; i < Math.min(nameMatches.length, 3); i++) {
      const nameMatch = nameMatches[i].match(/name:\s*([\w-]+)/)
      if (nameMatch) {
        const name = nameMatch[1]
        contexts.push({
          name,
          cluster: `cluster-${name}`,
          user: `user-${name}`,
          namespace: "default",
          current: name === currentContext,
        })
      }
    }

    // If no contexts were found, create some mock contexts
    if (contexts.length === 0) {
      contexts.push(
        {
          name: "dev-cluster",
          cluster: "cluster-dev",
          user: "user-dev",
          namespace: "default",
          current: true,
        },
        {
          name: "prod-cluster",
          cluster: "cluster-prod",
          user: "user-prod",
          namespace: "default",
          current: false,
        },
        {
          name: "staging-cluster",
          cluster: "cluster-staging",
          user: "user-staging",
          namespace: "default",
          current: false,
        },
      )
    }

    return {
      success: true,
      data: contexts,
    }
  } catch (error) {
    console.error("Error getting kubeconfig contexts:", error)
    return {
      success: false,
      error: `Failed to get contexts: ${error instanceof Error ? error.message : String(error)}`,
    }
  }
}

// Get cluster information
export async function getClusterInfo(content: string, contextName: string): Promise<KubeCommandResult> {
  try {
    // For the browser preview, we'll generate mock cluster data
    const cluster = generateMockClusterData(contextName)

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
  content: string,
  contextName: string,
  namespaceName: string,
): Promise<KubeCommandResult> {
  try {
    // For the browser preview, we'll generate mock namespace data
    const cluster = generateMockClusterData(contextName)
    const namespace = cluster.namespaces.find((ns) => ns.name === namespaceName)

    if (!namespace) {
      return {
        success: false,
        error: `Namespace ${namespaceName} not found in cluster ${contextName}`,
      }
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
