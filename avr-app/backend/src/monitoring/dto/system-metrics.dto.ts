export interface CpuCoreMetrics {
  coreId: number;
  usage: number;
}

export interface CpuMetricsDto {
  overall: number;
  cores: CpuCoreMetrics[];
  count: number;
}

export interface SwapMetrics {
  total: number;
  used: number;
  free: number;
  usagePercent: number;
}

export interface MemoryMetricsDto {
  total: number;
  used: number;
  available: number;
  usagePercent: number;
  swap: SwapMetrics;
}

export interface NetworkInterfaceMetrics {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
}

export interface NetworkMetricsDto {
  interfaces: NetworkInterfaceMetrics[];
}

export interface FilesystemMetrics {
  mount: string;
  type: string;
  total: number;
  used: number;
  available: number;
  usePercent: number;
}

export interface DiskIOMetrics {
  readRate: number;
  writeRate: number;
  readMBps: number;
  writeMBps: number;
}

export interface DiskMetricsDto {
  ioStats: DiskIOMetrics;
  filesystems: FilesystemMetrics[];
}

export interface SystemMetricsDto {
  timestamp: Date;
  cpu: CpuMetricsDto;
  memory: MemoryMetricsDto;
  network: NetworkMetricsDto;
  disk: DiskMetricsDto;
}
