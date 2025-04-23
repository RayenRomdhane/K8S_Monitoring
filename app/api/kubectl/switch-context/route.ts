import { NextResponse } from "next/server"
import { exec } from "child_process"
import { promisify } from "util"

const execPromise = promisify(exec)

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

    // Switch context
    const { stderr } = await execPromise(`kubectl config use-context ${contextName} --kubeconfig=${filePath}`)

    if (stderr) {
      return NextResponse.json({ error: stderr }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    console.error("Error switching context:", error)
    return NextResponse.json(
      { error: `Failed to switch context: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
