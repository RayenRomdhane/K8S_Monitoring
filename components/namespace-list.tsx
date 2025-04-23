"use client"

import { Database, Cpu, MemoryStickIcon as Memory } from "lucide-react"
import type { Namespace } from "@/lib/types"

interface NamespaceListProps {
  namespaces: Namespace[]
  onNamespaceSelect: (namespace: Namespace) => void
}

export function NamespaceList({ namespaces, onNamespaceSelect }: NamespaceListProps) {
  if (namespaces.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No namespaces found</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {namespaces.map((namespace) => (
        <div
          key={namespace.id}
          className="flex items-center justify-between p-3 rounded-md border hover:bg-muted cursor-pointer transition-colors"
          onClick={() => onNamespaceSelect(namespace)}
        >
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2 rounded-md">
              <Database className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{namespace.name}</h3>
              <p className="text-sm text-muted-foreground">{namespace.podCount} pods</p>
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-1">
              <Cpu className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{namespace.cpuUsage}m</span>
            </div>
            <div className="flex items-center gap-1">
              <Memory className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{namespace.memoryUsage}Mi</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
