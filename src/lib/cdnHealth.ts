/**
 * Enhanced CDN Health Monitoring System
 * 
 * Provides comprehensive health monitoring, failover mechanisms,
 * and performance tracking for CDN services.
 */

import { checkCDNHealth, getOptimizedMediaUrl, cdnConfig } from './cdn';
import type { CDNHealthStatus, MediaBucket } from './cdn';

interface HealthCheckConfig {
  interval: number; // Check interval in milliseconds
  timeout: number; // Request timeout in milliseconds
  retries: number; // Number of retry attempts
  endpoints: string[]; // Health check endpoints
  expectedStatusCodes: number[]; // Expected HTTP status codes
}

interface CDNPerformanceMetrics {
  averageLatency: number;
  successRate: number;
  errorRate: number;
  uptime: number; // Percentage
  lastCheck: Date;
  trend: 'improving' | 'stable' | 'degrading';
}

interface FailoverStrategy {
  enabled: boolean;
  maxRetries: number;
  fallbackDelay: number; // Delay between retries in milliseconds
  circuitBreaker: {
    enabled: boolean;
    failureThreshold: number; // Number of failures before opening circuit
    timeout: number; // Circuit breaker timeout in milliseconds
    halfOpenRequests: number; // Number of requests allowed in half-open state
  };
}

interface AlertConfig {
  enabled: boolean;
  email?: string;
  webhook?: string;
  slackWebhook?: string;
  thresholds: {
    latency: number; // Maximum acceptable latency in ms
    errorRate: number; // Maximum acceptable error rate (0-1)
    uptime: number; // Minimum acceptable uptime percentage
  };
}

// Default configurations
const DEFAULT_HEALTH_CONFIG: HealthCheckConfig = {
  interval: 30000, // 30 seconds
  timeout: 5000, // 5 seconds
  retries: 3,
  endpoints: ['/health', '/status'],
  expectedStatusCodes: [200, 204, 301, 302],
};

const DEFAULT_FAILOVER_STRATEGY: FailoverStrategy = {
  enabled: true,
  maxRetries: 3,
  fallbackDelay: 1000,
  circuitBreaker: {
    enabled: true,
    failureThreshold: 5,
    timeout: 60000, // 1 minute
    halfOpenRequests: 1,
  },
};

const DEFAULT_ALERT_CONFIG: AlertConfig = {
  enabled: true,
  thresholds: {
    latency: 2000, // 2 seconds
    errorRate: 0.1, // 10%
    uptime: 95, // 95%
  },
};

class CDNHealthMonitor {
  private healthStatus: Map<string, CDNHealthStatus> = new Map();
  private performanceMetrics: Map<string, CDNPerformanceMetrics> = new Map();
  private circuitBreakerState: Map<string, {
    state: 'closed' | 'open' | 'half-open';
    failureCount: number;
    lastFailure: Date;
    nextAttempt: Date;
  }> = new Map();

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private config: HealthCheckConfig;
  private failoverStrategy: FailoverStrategy;
  private alertConfig: AlertConfig;

  constructor(
    config: Partial<HealthCheckConfig> = {},
    failoverStrategy: Partial<FailoverStrategy> = {},
    alertConfig: Partial<AlertConfig> = {}
  ) {
    this.config = { ...DEFAULT_HEALTH_CONFIG, ...config };
    this.failoverStrategy = { ...DEFAULT_FAILOVER_STRATEGY, ...failoverStrategy };
    this.alertConfig = { ...DEFAULT_ALERT_CONFIG, ...alertConfig };
  }

  // Start continuous health monitoring
  startMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthChecks();
    }, this.config.interval);

    // Perform initial check
    this.performHealthChecks();
  }

  // Stop health monitoring
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Perform health checks for all configured endpoints
  private async performHealthChecks(): Promise<void> {
    const endpoints = this.config.endpoints;
    
    for (const endpoint of endpoints) {
      try {
        await this.checkEndpointHealth(endpoint);
      } catch (error) {
        console.error(`Health check failed for endpoint ${endpoint}:`, error);
        this.recordFailure(endpoint);
      }
    }

    this.updatePerformanceMetrics();
  }

  // Check health of a specific endpoint
  private async checkEndpointHealth(endpoint: string): Promise<void> {
    const provider = this.getProviderForEndpoint(endpoint);
    const url = this.buildHealthCheckUrl(endpoint);

    for (let attempt = 0; attempt < this.config.retries; attempt++) {
      try {
        const startTime = Date.now();
        const response = await fetch(url, {
          method: 'GET',
          timeout: this.config.timeout,
        });

        const latency = Date.now() - startTime;

        // Check if response is acceptable
        if (this.config.expectedStatusCodes.includes(response.status)) {
          this.recordSuccess(endpoint, latency);
          return;
        } else {
          throw new Error(`Unexpected status code: ${response.status}`);
        }
      } catch (error) {
        if (attempt === this.config.retries - 1) {
          throw error;
        }
        await this.delay(this.config.timeout);
      }
    }
  }

  // Build health check URL
  private buildHealthCheckUrl(endpoint: string): string {
    if (cdnConfig.baseUrl) {
      return `${cdnConfig.baseUrl}${endpoint}`;
    }
    
    // Fallback to Supabase health endpoint
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${endpoint}`;
  }

  // Get CDN provider for endpoint
  private getProviderForEndpoint(endpoint: string): string {
    if (endpoint.includes('/health')) {
      return cdnConfig.provider;
    }
    return 'supabase';
  }

  // Record successful health check
  private recordSuccess(endpoint: string, latency: number): void {
    const currentStatus = this.healthStatus.get(endpoint) || {
      status: 'healthy',
      latency: 0,
      lastCheck: new Date(),
    };

    this.healthStatus.set(endpoint, {
      status: 'healthy',
      latency,
      lastCheck: new Date(),
    });

    this.resetCircuitBreaker(endpoint);
  }

  // Record failed health check
  private recordFailure(endpoint: string): void {
    const currentStatus = this.healthStatus.get(endpoint) || {
      status: 'healthy',
      latency: 0,
      lastCheck: new Date(),
    };

    const failureCount = (this.circuitBreakerState.get(endpoint)?.failureCount || 0) + 1;
    const lastFailure = new Date();

    this.healthStatus.set(endpoint, {
      status: failureCount > this.failoverStrategy.circuitBreaker.failureThreshold ? 'down' : 'degraded',
      latency: currentStatus.latency,
      lastCheck: lastFailure,
      error: `Health check failed after ${failureCount} attempts`,
    });

    this.updateCircuitBreaker(endpoint, failureCount, lastFailure);

    // Check if alert should be triggered
    this.checkAlertConditions(endpoint);
  }

  // Update circuit breaker state
  private updateCircuitBreaker(endpoint: string, failureCount: number, lastFailure: Date): void {
    const circuitBreaker = this.failoverStrategy.circuitBreaker;
    
    if (failureCount >= circuitBreaker.failureThreshold) {
      this.circuitBreakerState.set(endpoint, {
        state: 'open',
        failureCount,
        lastFailure,
        nextAttempt: new Date(Date.now() + circuitBreaker.timeout),
      });
    } else {
      this.circuitBreakerState.set(endpoint, {
        state: 'closed',
        failureCount,
        lastFailure,
        nextAttempt: new Date(),
      });
    }
  }

  // Reset circuit breaker
  private resetCircuitBreaker(endpoint: string): void {
    this.circuitBreakerState.set(endpoint, {
      state: 'closed',
      failureCount: 0,
      lastFailure: new Date(),
      nextAttempt: new Date(),
    });
  }

  // Check alert conditions
  private checkAlertConditions(endpoint: string): void {
    if (!this.alertConfig.enabled) return;

    const status = this.healthStatus.get(endpoint);
    if (!status) return;

    const { thresholds } = this.alertConfig;

    if (status.latency > thresholds.latency) {
      this.triggerAlert(endpoint, 'HIGH_LATENCY', `Latency ${status.latency}ms exceeds threshold ${thresholds.latency}ms`);
    }

    if (status.status === 'down') {
      this.triggerAlert(endpoint, 'SERVICE_DOWN', 'CDN service is down');
    }

    // Check uptime based on recent health checks
    const uptime = this.calculateUptime(endpoint);
    if (uptime < thresholds.uptime) {
      this.triggerAlert(endpoint, 'LOW_UPTIME', `Uptime ${uptime}% is below threshold ${thresholds.uptime}%`);
    }
  }

  // Trigger alert
  private triggerAlert(endpoint: string, type: string, message: string): void {
    console.warn(`CDN Alert [${type}]: ${message} for endpoint ${endpoint}`);

    // Send alert via configured channels
    if (this.alertConfig.email) {
      this.sendEmailAlert(endpoint, type, message);
    }

    if (this.alertConfig.webhook) {
      this.sendWebhookAlert(endpoint, type, message);
    }

    if (this.alertConfig.slackWebhook) {
      this.sendSlackAlert(endpoint, type, message);
    }
  }

  // Send email alert (mock implementation)
  private async sendEmailAlert(endpoint: string, type: string, message: string): Promise<void> {
    console.log(`Email alert sent for ${type} on ${endpoint}: ${message}`);
    // In real implementation, integrate with email service
  }

  // Send webhook alert
  private async sendWebhookAlert(endpoint: string, type: string, message: string): Promise<void> {
    try {
      await fetch(this.alertConfig.webhook!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint,
          type,
          message,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  // Send Slack alert
  private async sendSlackAlert(endpoint: string, type: string, message: string): Promise<void> {
    try {
      await fetch(this.alertConfig.slackWebhook!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 CDN Alert [${type}]: ${message}`,
          blocks: [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*CDN Alert [${type}]*\n${message}\n\n*Endpoint:* ${endpoint}\n*Timestamp:* ${new Date().toISOString()}`,
              },
            },
          ],
        }),
      });
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  // Calculate uptime for endpoint
  private calculateUptime(endpoint: string): number {
    // Mock uptime calculation based on recent health checks
    // In real implementation, track historical data
    return 98; // Assume 98% uptime
  }

  // Update performance metrics
  private updatePerformanceMetrics(): void {
    const endpoints = this.config.endpoints;
    let totalLatency = 0;
    let healthyCount = 0;
    let degradedCount = 0;
    let downCount = 0;

    for (const endpoint of endpoints) {
      const status = this.healthStatus.get(endpoint);
      if (status) {
        totalLatency += status.latency;
        
        switch (status.status) {
          case 'healthy':
            healthyCount++;
            break;
          case 'degraded':
            degradedCount++;
            break;
          case 'down':
            downCount++;
            break;
        }
      }
    }

    const totalChecks = endpoints.length;
    const averageLatency = totalChecks > 0 ? totalLatency / totalChecks : 0;
    const successRate = totalChecks > 0 ? (healthyCount / totalChecks) * 100 : 0;
    const errorRate = totalChecks > 0 ? ((degradedCount + downCount) / totalChecks) * 100 : 0;
    const uptime = totalChecks > 0 ? (healthyCount / totalChecks) * 100 : 0;

    // Determine trend
    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    const previousMetrics = this.performanceMetrics.get('global');
    
    if (previousMetrics) {
      if (successRate > previousMetrics.successRate) {
        trend = 'improving';
      } else if (successRate < previousMetrics.successRate) {
        trend = 'degrading';
      }
    }

    this.performanceMetrics.set('global', {
      averageLatency,
      successRate,
      errorRate,
      uptime,
      lastCheck: new Date(),
      trend,
    });
  }

  // Get current health status
  getHealthStatus(endpoint?: string): CDNHealthStatus | Map<string, CDNHealthStatus> {
    if (endpoint) {
      return this.healthStatus.get(endpoint) || {
        status: 'unknown',
        latency: 0,
        lastCheck: new Date(),
      };
    }
    return this.healthStatus;
  }

  // Get performance metrics
  getPerformanceMetrics(): CDNPerformanceMetrics | undefined {
    return this.performanceMetrics.get('global');
  }

  // Get circuit breaker state
  getCircuitBreakerState(endpoint: string) {
    return this.circuitBreakerState.get(endpoint);
  }

  // Check if CDN is healthy for a specific operation
  async isHealthyForOperation(operation: string): Promise<boolean> {
    const healthStatus = this.getHealthStatus();
    
    if (healthStatus instanceof Map) {
      // Check all endpoints
      for (const [endpoint, status] of healthStatus.entries()) {
        if (status.status === 'down') {
          console.warn(`CDN is down for endpoint ${endpoint}, operation ${operation} may fail`);
          return false;
        }
      }
      return true;
    }

    // Single status check
    return healthStatus.status !== 'down';
  }

  // Execute operation with failover
  async executeWithFailover<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Check circuit breaker state
    const circuitState = this.getCircuitBreakerState('global');
    
    if (circuitState?.state === 'open') {
      console.warn(`Circuit breaker is open for ${operationName}, using fallback`);
      return fallback();
    }

    try {
      // Check if CDN is healthy
      const isHealthy = await this.isHealthyForOperation(operationName);
      
      if (isHealthy) {
        return await operation();
      } else {
        console.warn(`CDN is not healthy for ${operationName}, using fallback`);
        return fallback();
      }
    } catch (error) {
      console.error(`Operation ${operationName} failed:`, error);
      
      // Update circuit breaker state
      this.recordFailure('global');
      
      // Try fallback
      return fallback();
    }
  }

  // Delay utility
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Global health monitor instance
export const cdnHealthMonitor = new CDNHealthMonitor();

// Utility functions
export const startCDNHealthMonitoring = () => {
  cdnHealthMonitor.startMonitoring();
};

export const stopCDNHealthMonitoring = () => {
  cdnHealthMonitor.stopMonitoring();
};

export const getCDNHealthStatus = (endpoint?: string) => {
  return cdnHealthMonitor.getHealthStatus(endpoint);
};

export const getCDNPerformanceMetrics = () => {
  return cdnHealthMonitor.getPerformanceMetrics();
};

export const executeWithCDNFailover = <T>(
  operation: () => Promise<T>,
  fallback: () => Promise<T>,
  operationName: string
) => {
  return cdnHealthMonitor.executeWithFailover(operation, fallback, operationName);
};

// Health check API endpoint
export const GET = async () => {
  const healthStatus = getCDNHealthStatus();
  const performanceMetrics = getCDNPerformanceMetrics();

  return new Response(
    JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      healthStatus: healthStatus instanceof Map ? Object.fromEntries(healthStatus) : healthStatus,
      performanceMetrics,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
};