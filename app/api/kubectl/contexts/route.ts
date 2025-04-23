import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execPromise = promisify(exec)

export async function POST(request: Request) {
  try {
    const { filePath } = await request.json()

    if (!filePath) {
      return NextResponse.json({ error: "No file path provided" }, { status: 400 })
    }

    // Security check: Ensure the file path is within our temp directory
    if (!filePath.includes("tmp/kubeconfig-")) {
      return NextResponse.json({ error: "Invalid file path" }, { status: 400 })
    }

    // Get contexts from kubeconfig
    const { stdout, stderr } = await execPromise(`kubectl config get-contexts --kubeconfig=${filePath} -o json`)

    if (stderr) {
      return NextResponse.json({ error: stderr }, { status: 500 })
    }

    // Get current context
    const { stdout: currentContextStdout } = await execPromise(
      `kubectl config current-context --kubeconfig=${filePath}`,
    )
    const currentContext = currentContextStdout.trim()

    // Parse contexts
    const contexts = JSON.parse(stdout)

    // Format contexts
    const formattedContexts = contexts.items.map((context: any) => ({
      name: context.name,
      cluster: context.context.cluster,
      user: context.context.user,
      namespace: context.context.namespace,
      current: context.name === currentContext,
    }))

    return NextResponse.json({
      success: true,
      contexts: formattedContexts,
    })
  } catch (error) {
    console.error("Error getting contexts:", error)
    return NextResponse.json(
      { error: `Failed to get contexts: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
