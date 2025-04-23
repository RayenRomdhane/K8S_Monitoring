"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Upload, FileUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { parseKubeConfig } from "@/lib/kube-parser"

interface KubeConfigUploadProps {
  onFileUpload: (content: string, fileName: string) => void
  isLoading: boolean
}

export function KubeConfigUpload({ onFileUpload, isLoading }: KubeConfigUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const processFile = async (file: File) => {
    setError(null)

    try {
      // Check file type
      if (!file.name.endsWith(".yaml") && !file.name.endsWith(".yml") && !file.name.endsWith(".json")) {
        setError("Please upload a YAML or JSON file")
        return
      }

      // Read file content
      const fileContent = await file.text()

      // Parse kubeconfig
      const result = await parseKubeConfig(fileContent)

      if (!result.success) {
        setError(result.error || "Failed to process kubeconfig file")
        return
      }

      // Pass the file content back to parent component
      onFileUpload(fileContent, file.name)
    } catch (err) {
      console.error("Error processing file:", err)
      setError(`Error processing file: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0])
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0])
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">K8s Cluster Monitor</CardTitle>
        <CardDescription>Upload your kubeconfig file to start monitoring your Kubernetes clusters</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center ${
            dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-primary/10 p-4">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="text-lg font-medium">Drag and drop your kubeconfig file</p>
              <p className="text-sm text-muted-foreground mt-1">or click the button below</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".yaml,.yml,.json"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>
        {error && <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">{error}</div>}
      </CardContent>
      <CardFooter>
        <Button onClick={handleButtonClick} className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>Processing...</>
          ) : (
            <>
              <FileUp className="mr-2 h-4 w-4" />
              Select KubeConfig File
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
