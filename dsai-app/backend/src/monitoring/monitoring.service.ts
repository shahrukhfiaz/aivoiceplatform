import { Injectable, Logger } from '@nestjs/common';
import * as si from 'systeminformation';
import {
  SystemMetricsDto,
  CpuMetricsDto,
  MemoryMetricsDto,
  NetworkMetricsDto,
  DiskMetricsDto,
} from './dto/system-metrics.dto';

@Injectable()
export class MonitoringService {
  private readonly logger = new Logger(MonitoringService.name);

  // Cache for rate limiting
  private lastMetricsTime = 0;
  private cachedMetrics: SystemMetricsDto | null = null;
  private readonly CACHE_TTL_MS = 1000; // 1 second cache

  async getSystemMetrics(): Promise<SystemMetricsDto> {
    const now = Date.now();

    // Return cached metrics if within TTL
    if (now - this.lastMetricsTime < this.CACHE_TTL_MS && this.cachedMetrics) {
      return this.cachedMetrics;
    }

    try {
      const [cpu, memory, network, disk] = await Promise.all([
        this.getCpuMetrics(),
        this.getMemoryMetrics(),
        this.getNetworkMetrics(),
        this.getDiskMetrics(),
      ]);

      const metrics: SystemMetricsDto = {
        timestamp: new Date(),
        cpu,
        memory,
        network,
        disk,
      };

      // Update cache
      this.lastMetricsTime = now;
      this.cachedMetrics = metrics;

      return metrics;
    } catch (error) {
      this.logger.error('Failed to fetch system metrics', error);
      throw error;
    }
  }

  async getCpuMetrics(): Promise<CpuMetricsDto> {
    try {
      const load = await si.currentLoad();
      return {
        overall: Math.round(load.currentLoad * 100) / 100,
        cores: load.cpus.map((cpu, index) => ({
          coreId: index,
          usage: Math.round(cpu.load * 100) / 100,
        })),
        count: load.cpus.length,
      };
    } catch (error) {
      this.logger.error('Failed to fetch CPU metrics', error);
      throw error;
    }
  }

  async getMemoryMetrics(): Promise<MemoryMetricsDto> {
    try {
      const mem = await si.mem();
      return {
        total: mem.total,
        used: mem.used,
        available: mem.available,
        usagePercent: Math.round((mem.used / mem.total) * 10000) / 100,
        swap: {
          total: mem.swaptotal,
          used: mem.swapused,
          free: mem.swapfree,
          usagePercent: mem.swaptotal > 0
            ? Math.round((mem.swapused / mem.swaptotal) * 10000) / 100
            : 0,
        },
      };
    } catch (error) {
      this.logger.error('Failed to fetch memory metrics', error);
      throw error;
    }
  }

  async getNetworkMetrics(): Promise<NetworkMetricsDto> {
    try {
      const stats = await si.networkStats();
      return {
        interfaces: stats.map((iface) => ({
          name: iface.iface,
          rxBytes: iface.rx_bytes,
          txBytes: iface.tx_bytes,
          rxRate: iface.rx_sec || 0,
          txRate: iface.tx_sec || 0,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch network metrics', error);
      throw error;
    }
  }

  async getDiskMetrics(): Promise<DiskMetricsDto> {
    try {
      const [io, fs] = await Promise.all([
        si.disksIO(),
        si.fsSize(),
      ]);

      return {
        ioStats: {
          readRate: io.rIO_sec || 0,
          writeRate: io.wIO_sec || 0,
          readMBps: Math.round(((io.rIO_sec || 0) / 1024 / 1024) * 100) / 100,
          writeMBps: Math.round(((io.wIO_sec || 0) / 1024 / 1024) * 100) / 100,
        },
        filesystems: fs.map((f) => ({
          mount: f.mount,
          type: f.type,
          total: f.size,
          used: f.used,
          available: f.available,
          usePercent: Math.round(f.use * 100) / 100,
        })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch disk metrics', error);
      throw error;
    }
  }
}
