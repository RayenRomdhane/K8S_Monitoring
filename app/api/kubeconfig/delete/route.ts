import { NextResponse } from "next/server"
import { unlink } from "fs/promises"
import { existsSync } from "fs"

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

    // Delete the file if it exists
    if (existsSync(filePath)) {
      await unlink(filePath)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting kubeconfig:", error)
    return NextResponse.json(
      { error: `Failed to delete kubeconfig: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}
