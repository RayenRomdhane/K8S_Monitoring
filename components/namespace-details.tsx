"use client"

import { useState } from "react"
import { ArrowLeft, Download, Search, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import type { Cluster, Namespace, Pod } from "@/lib/types"

interface NamespaceDetailsProps {
  cluster: Cluster
  namespace: Namespace
  onBack: () => void
  onRefresh: () => void
  isLoading: boolean
}

export function NamespaceDetails({ cluster, namespace, onBack, onRefresh, isLoading }: NamespaceDetailsProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [sortColumn, setSortColumn] = useState<keyof Pod>("name")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")

  const handleSort = (column: keyof Pod) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      setSortColumn(column)
      setSortDirection("asc")
    }
  }

  const filteredPods = namespace.pods.filter((pod) => pod.name.toLowerCase().includes(searchQuery.toLowerCase()))

  const sortedPods = [...filteredPods].sort((a, b) => {
    const aValue = a[sortColumn]
    const bValue = b[sortColumn]

    if (typeof aValue === "number" && typeof bValue === "number") {
      return sortDirection === "asc" ? aValue - bValue : bValue - aValue
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue)
    }

    return 0
  })

  const exportToCsv = () => {
    const headers = [
      "Pod Name",
      "CPU Usage (m)",
      "Memory Usage (Mi)",
      "PVCs",
      "ConfigMaps",
      "Secrets",
      "Services",
      "Ingresses",
    ]

    const rows = sortedPods.map((pod) => [
      pod.name,
      pod.cpuUsage.toString(),
      pod.memoryUsage.toString(),
      pod.pvcs.join(", "),
      pod.configMaps.join(", "),
      pod.secrets.join(", "),
      pod.services.join(", "),
      pod.ingresses.join(", "),
    ])

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${namespace.name}-pods.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{namespace.name}</h1>
            <p className="text-muted-foreground">
              Cluster: {cluster.name} • {namespace.podCount} pods
            </p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search pods..."
              className="pl-8"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCsv}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-md border">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer" onClick={() => handleSort("name")}>
                  Pod Name {sortColumn === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort("cpuUsage")}>
                  CPU Usage (m) {sortColumn === "cpuUsage" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="cursor-pointer text-right" onClick={() => handleSort("memoryUsage")}>
                  Memory Usage (Mi) {sortColumn === "memoryUsage" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead>PVCs</TableHead>
                <TableHead>ConfigMaps</TableHead>
                <TableHead>Secrets</TableHead>
                <TableHead>Services</TableHead>
                <TableHead>Ingresses</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPods.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center h-24">
                    No pods found
                  </TableCell>
                </TableRow>
              ) : (
                sortedPods.map((pod) => (
                  <TableRow key={pod.id}>
                    <TableCell className="font-medium">{pod.name}</TableCell>
                    <TableCell className="text-right">{pod.cpuUsage}</TableCell>
                    <TableCell className="text-right">{pod.memoryUsage}</TableCell>
                    <TableCell>{pod.pvcs.join(", ") || "-"}</TableCell>
                    <TableCell>{pod.configMaps.join(", ") || "-"}</TableCell>
                    <TableCell>{pod.secrets.join(", ") || "-"}</TableCell>
                    <TableCell>{pod.services.join(", ") || "-"}</TableCell>
                    <TableCell>{pod.ingresses.join(", ") || "-"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
