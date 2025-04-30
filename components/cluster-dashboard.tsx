"use client"

import { useState } from "react"
import { Search, Cpu, MemoryStickIcon as Memory, Server, RefreshCw } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { ResourceUsageChart } from "@/components/resource-usage-chart"
import { NamespaceList } from "@/components/namespace-list"
import type { Cluster, Namespace } from "@/lib/types"

interface ClusterDashboardProps {
  cluster: Cluster
  onNamespaceSelect: (namespace: Namespace) => void
  onRefresh: () => void
  isLoading: boolean
}

export function ClusterDashboard({ cluster, onNamespaceSelect, onRefresh, isLoading }: ClusterDashboardProps) {
  const [searchQuery, setSearchQuery] = useState("")

  const filteredNamespaces = cluster.namespaces.filter((namespace) =>
    namespace.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const totalPods = cluster.namespaces.reduce((acc, namespace) => acc + namespace.podCount, 0)

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">{cluster.name}</h1>
          <p className="text-muted-foreground">{cluster.context}</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto">
          <div className="w-full md:w-64">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search namespaces..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pods</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{totalPods}</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {cluster.cpuUsage}m / {cluster.cpuTotal}m
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {Math.round((cluster.cpuUsage / cluster.cpuTotal) * 100)}% utilized
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
            <Memory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {Math.round(cluster.memoryUsage)}Mi / {cluster.memoryTotal}Mi
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              {Math.round((cluster.memoryUsage / cluster.memoryTotal) * 100)}% utilized
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="namespaces">Namespaces ({cluster.namespaces.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>CPU Usage</CardTitle>
                <CardDescription>Distribution across namespaces</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-64 w-64 rounded-full" />
                  </div>
                ) : (
                  <ResourceUsageChart
                    data={cluster.namespaces.map((ns) => ({
                      name: ns.name,
                      value: ns.cpuUsage,
                    }))}
                    type="cpu"
                  />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>Distribution across namespaces</CardDescription>
              </CardHeader>
              <CardContent className="h-80">
                {isLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Skeleton className="h-64 w-64 rounded-full" />
                  </div>
                ) : (
                  <ResourceUsageChart
                    data={cluster.namespaces.map((ns) => ({
                      name: ns.name,
                      value: Math.round(ns.memoryUsage),
                    }))}
                    type="memory"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="namespaces">
          <Card>
            <CardHeader>
              <CardTitle>Namespaces</CardTitle>
              <CardDescription>Select a namespace to view detailed pod information</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <NamespaceList namespaces={filteredNamespaces} onNamespaceSelect={onNamespaceSelect} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
