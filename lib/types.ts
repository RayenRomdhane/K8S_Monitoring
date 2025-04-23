export interface KubeConfig {
  fileName: string
  uploadedAt: string
  content?: string
}

export interface Pod {
  id: string
  name: string
  cpuUsage: number
  memoryUsage: number
  pvcs: string[]
  configMaps: string[]
  secrets: string[]
  services: string[]
  ingresses: string[]
}

export interface Namespace {
  id: string
  name: string
  podCount: number
  cpuUsage: number
  memoryUsage: number
  pods: Pod[]
}

export interface Cluster {
  id: string
  name: string
  context: string
  cpuUsage: number
  cpuTotal: number
  memoryUsage: number
  memoryTotal: number
  namespaces: Namespace[]
}

export interface KubeContext {
  name: string
  cluster: string
  user: string
  namespace?: string
  current: boolean
}

export interface KubeCommandResult {
  success: boolean
  data?: any
  error?: string
}
