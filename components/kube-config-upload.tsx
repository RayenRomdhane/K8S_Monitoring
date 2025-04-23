"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
import { Upload, FileUp, Code, FileCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { uploadKubeConfig, uploadKubeConfigText } from "@/lib/api-client"

interface KubeConfigUploadProps {
  onFileUpload: (filePath: string, fileName: string) => void
  isLoading: boolean
}

export function KubeConfigUpload({ onFileUpload, isLoading }: KubeConfigUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kubeConfigText, setKubeConfigText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropAreaRef = useRef<HTMLDivElement>(null)

  // Process a file (either from file input or drag and drop)
  const processFile = useCallback(
    async (file: File) => {
      setError(null)
      setIsProcessing(true)

      try {
        console.log("Processing file:", file.name, file.type, file.size)

        // Check file type client-side first
        if (!file.name.endsWith(".yaml") && !file.name.endsWith(".yml") && !file.name.endsWith(".json")) {
          setError("Invalid file type. Only YAML and JSON files are allowed")
          return
        }

        // Upload kubeconfig file to the server
        const { filePath, fileName } = await uploadKubeConfig(file)

        // Pass the file path back to parent component
        onFileUpload(filePath, fileName)
      } catch (err) {
        console.error("Error processing file:", err)
        setError(`Error processing file: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setIsProcessing(false)
      }
    },
    [onFileUpload],
  )

  // Process text input
  const processText = useCallback(async () => {
    setError(null)
    setIsProcessing(true)

    if (!kubeConfigText.trim()) {
      setError("Please enter kubeconfig content")
      setIsProcessing(false)
      return
    }

    try {
      console.log("Processing kubeconfig text, length:", kubeConfigText.length)

      // Upload kubeconfig text content to the server
      const { filePath, fileName } = await uploadKubeConfigText(kubeConfigText)

      // Pass the file path back to parent component
      onFileUpload(filePath, fileName)
    } catch (err) {
      console.error("Error processing kubeconfig text:", err)
      setError(`Error processing kubeconfig text: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setIsProcessing(false)
    }
  }, [kubeConfigText, onFileUpload])

  // Handle drag enter event
  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(true)
  }, [])

  // Handle drag over event
  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!dragActive) setDragActive(true)
    },
    [dragActive],
  )

  // Handle drag leave event
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()

    // Only set dragActive to false if we're leaving the drop area
    // and not entering a child element
    if (e.currentTarget === e.target) {
      setDragActive(false)
    }
  }, [])

  // Handle drop event
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setDragActive(false)

      console.log("File dropped")

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0]
        console.log("Dropped file:", file.name, file.type, file.size)
        processFile(file)
      } else {
        console.log("No files found in drop event")
        setError("No file detected in drop. Please try again or use the file selector.")
      }
    },
    [processFile],
  )

  // Handle file input change
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0])
      }
    },
    [processFile],
  )

  // Handle file button click
  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">K8s Cluster Monitor</CardTitle>
        <CardDescription>
          Upload your kubeconfig file or paste its content to start monitoring your Kubernetes clusters
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="file" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="file">
              <FileCode className="mr-2 h-4 w-4" />
              Upload File
            </TabsTrigger>
            <TabsTrigger value="text">
              <Code className="mr-2 h-4 w-4" />
              Paste Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file">
            <div
              ref={dropAreaRef}
              className={`border-2 border-dashed rounded-lg p-12 text-center ${
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
              }`}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
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
                <Button onClick={handleButtonClick} disabled={isLoading || isProcessing}>
                  {isLoading || isProcessing ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Select KubeConfig File
                    </>
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="text">
            <div className="space-y-4">
              <Textarea
                placeholder="Paste your kubeconfig content here..."
                className="min-h-[200px] font-mono text-sm"
                value={kubeConfigText}
                onChange={(e) => setKubeConfigText(e.target.value)}
              />
              <Button
                className="w-full"
                onClick={processText}
                disabled={isLoading || isProcessing || !kubeConfigText.trim()}
              >
                {isLoading || isProcessing ? "Processing..." : "Use This KubeConfig"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            <p className="font-semibold">Error:</p>
            <p>{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
