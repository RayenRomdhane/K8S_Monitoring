import type { KubeContext, Cluster, Namespace } from "@/lib/types"

// Upload kubeconfig file
export async function uploadKubeConfig(file: File): Promise<{ filePath: string; fileName: string }> {
  const formData = new FormData()
  formData.append("file", file)

  try {
    const response = await fetch("/api/kubeconfig/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    const result = await response.json()
    return {
      filePath: result.filePath,
      fileName: result.fileName,
    }
  } catch (error) {
    console.error("Upload error:", error)
    throw error
  }
}

// Upload kubeconfig text content
export async function uploadKubeConfigText(
  content: string,
  fileName = "kubeconfig.yaml",
): Promise<{ filePath: string; fileName: string }> {
  console.log("Uploading kubeconfig text, length:", content.length)

  try {
    const response = await fetch("/api/kubeconfig/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content, fileName }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    const result = await response.json()
    return {
      filePath: result.filePath,
      fileName: result.fileName,
    }
  } catch (error) {
    console.error("Upload text error:", error)
    throw error
  }
}

// Delete kubeconfig file
export async function deleteKubeConfig(filePath: string): Promise<void> {
  try {
    const response = await fetch("/api/kubeconfig/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }
  } catch (error) {
    console.error("Delete error:", error)
    // Don't throw on deletion errors, just log them
  }
}

// Get contexts from kubeconfig
export async function getKubeContexts(filePath: string): Promise<KubeContext[]> {
  try {
    const response = await fetch("/api/kubectl/contexts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    const result = await response.json()
    return result.contexts
  } catch (error) {
    console.error("Get contexts error:", error)
    throw error
  }
}

// Switch context
export async function switchContext(filePath: string, contextName: string): Promise<void> {
  try {
    const response = await fetch("/api/kubectl/switch-context", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath, contextName }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }
  } catch (error) {
    console.error("Switch context error:", error)
    throw error
  }
}

// Get cluster info
export async function getClusterInfo(filePath: string, contextName: string): Promise<Cluster> {
  try {
    const response = await fetch("/api/kubectl/cluster-info", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath, contextName }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    const result = await response.json()
    return result.cluster
  } catch (error) {
    console.error("Get cluster info error:", error)
    throw error
  }
}

// Get namespace details
export async function getNamespaceDetails(
  filePath: string,
  contextName: string,
  namespaceName: string,
): Promise<Namespace> {
  try {
    const response = await fetch("/api/kubectl/namespace-details", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filePath, contextName, namespaceName }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      throw new Error(errorData.error || `Server error: ${response.status}`)
    }

    const result = await response.json()
    return result.namespace
  } catch (error) {
    console.error("Get namespace details error:", error)
    throw error
  }
}
