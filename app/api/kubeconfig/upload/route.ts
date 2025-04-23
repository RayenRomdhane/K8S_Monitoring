import { NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import { join } from "path"
import { v4 as uuidv4 } from "uuid"
import { load } from "js-yaml"

// Directory to store temporary kubeconfig files
const TEMP_DIR = join(process.cwd(), "tmp")
const MAX_FILE_SIZE = 1024 * 1024 // 1MB

// Ensure temp directory exists
async function ensureTempDir() {
  if (!existsSync(TEMP_DIR)) {
    await mkdir(TEMP_DIR, { recursive: true })
  }
}

export async function POST(request: Request) {
  try {
    console.log("Received request to /api/kubeconfig/upload")

    // Check content type to determine how to handle the request
    const contentType = request.headers.get("content-type") || ""
    console.log("Content-Type:", contentType)

    // Handle JSON request (for text content)
    if (contentType.includes("application/json")) {
      console.log("Handling as JSON request")
      const body = await request.json()

      if (typeof body.content !== "string") {
        console.log("Invalid JSON format: missing or invalid content field")
        return NextResponse.json({ error: "Invalid JSON format: missing or invalid content field" }, { status: 400 })
      }

      return await handleTextContent(body.content, body.fileName || "kubeconfig.yaml")
    }

    // Handle form data request (for file upload)
    if (contentType.includes("multipart/form-data")) {
      console.log("Handling as form data request")
      const formData = await request.formData()
      const file = formData.get("file") as File | null

      if (!file) {
        console.log("No file found in form data")
        return NextResponse.json({ error: "No file provided" }, { status: 400 })
      }

      return await handleFileUpload(file)
    }

    // If we get here, we couldn't handle the request
    console.log("Unsupported content type:", contentType)
    return NextResponse.json({ error: "Unsupported request format" }, { status: 400 })
  } catch (error) {
    console.error("Error uploading kubeconfig:", error)
    return NextResponse.json(
      { error: `Failed to upload kubeconfig: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 },
    )
  }
}

// Handle file upload
async function handleFileUpload(file: File) {
  console.log("Handling file upload:", file.name)

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    console.log("File size exceeds limit")
    return NextResponse.json({ error: "File size exceeds the limit (1MB)" }, { status: 400 })
  }

  // Check file type
  const fileName = file.name
  if (!fileName.endsWith(".yaml") && !fileName.endsWith(".yml") && !fileName.endsWith(".json")) {
    console.log("Invalid file type")
    return NextResponse.json({ error: "Invalid file type. Only YAML and JSON files are allowed" }, { status: 400 })
  }

  // Read file content
  const fileContent = await file.text()
  console.log("File content read successfully, length:", fileContent.length)

  return await processKubeConfig(fileContent, fileName)
}

// Handle text content
async function handleTextContent(content: string, fileName = "kubeconfig.yaml") {
  console.log("Handling text content, length:", content.length)

  if (!content) {
    console.log("No content provided")
    return NextResponse.json({ error: "No content provided" }, { status: 400 })
  }

  return await processKubeConfig(content, fileName)
}

// Process kubeconfig content and save to file
async function processKubeConfig(content: string, fileName: string) {
  console.log("Processing kubeconfig content")

  // Basic validation - just check if it's valid YAML/JSON
  try {
    const parsedConfig = load(content)

    // More lenient validation - just check if it's an object
    if (!parsedConfig || typeof parsedConfig !== "object") {
      console.log("Invalid YAML/JSON format: not an object")
      return NextResponse.json({ error: "Invalid YAML/JSON format: not an object" }, { status: 400 })
    }

    // Log the structure for debugging
    console.log("Parsed YAML structure:", Object.keys(parsedConfig))

    // Very basic kubeconfig validation - just check if it has apiVersion and kind
    if (!parsedConfig.apiVersion || !parsedConfig.kind) {
      console.log("Warning: Missing apiVersion or kind fields, but proceeding anyway")
    }

    console.log("YAML format validated successfully")
  } catch (error) {
    console.log("Failed to parse YAML/JSON:", error)
    return NextResponse.json(
      { error: `Invalid YAML/JSON format: ${error instanceof Error ? error.message : String(error)}` },
      { status: 400 },
    )
  }

  // Ensure temp directory exists
  await ensureTempDir()
  console.log("Temp directory ensured")

  // Generate a unique filename
  const uniqueId = uuidv4()
  const filePath = join(TEMP_DIR, `kubeconfig-${uniqueId}`)
  console.log("Generated file path:", filePath)

  // Write the file
  await writeFile(filePath, content)
  console.log("File written successfully")

  // Return the file path and original filename
  return NextResponse.json({
    success: true,
    filePath,
    fileName,
  })
}
