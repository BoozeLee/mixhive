/**
 * CDN Cost Optimization Features
 *
 * Provides utilities for optimizing CDN costs through lazy loading,
 * quality selection, format optimization, and bandwidth monitoring.
 */

import { cdnConfig, CDNConfig } from './cdn';
import type { CDNOptimizationParams } from './cdn';

interface CostOptimizationConfig {
  enableLazyLoading: boolean;
  enableQualitySelection: boolean;
  enableFormatOptimization: boolean;
  enableBandwidthMonitoring: boolean;
  enableCompression: boolean;
  costThresholds: {
    maxBandwidthGB: number;
    maxRequestsPerMinute: number;
    alertThreshold: number; // Percentage of threshold
  };
  qualityPresets: {
    thumbnail: { quality: number; format: string; maxSize: number };
    small: { quality: number; format: string; maxSize: number };
    medium: { quality: number; format: string; maxSize: number };
    large: { quality: number; format: string; maxSize: number };
    original: { quality: number; format: string; maxSize: number };
  };
}

interface BandwidthMetrics {
  currentBandwidthGB: number;
  requestsThisMinute: number;
  timestamp: Date;
  costOptimizationActive: boolean;
}

interface QualitySelectionConfig {
  deviceType: 'mobile' | 'tablet' | 'desktop';
  networkType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi';
  viewportSize: { width: number; height: number };
  userPreference: 'low' | 'medium' | 'high' | 'auto';
}

interface FormatOptimizationConfig {
  preferredFormats: Record<string, string>; // MIME type -> optimized format
  compressionLevels: Record<string, number>; // File type -> compression level
  maxSizeKB: Record<string, number>; // File type -> max size in KB
}

// Default cost optimization configuration
const DEFAULT_COST_OPTIMIZATION_CONFIG: CostOptimizationConfig = {
  enableLazyLoading: true,
  enableQualitySelection: true,
  enableFormatOptimization: true,
  enableBandwidthMonitoring: true,
  enableCompression: true,
  costThresholds: {
    maxBandwidthGB: 100, // 100GB per month
    maxRequestsPerMinute: 10000,
    alertThreshold: 80, // 80% of threshold
  },
  qualityPresets: {
    thumbnail: { quality: 50, format: 'webp', maxSize: 50 }, // 50KB
    small: { quality: 70, format: 'webp', maxSize: 200 }, // 200KB
    medium: { quality: 80, format: 'webp', maxSize: 500 }, // 500KB
    large: { quality: 85, format: 'webp', maxSize: 1000 }, // 1MB
    original: { quality: 90, format: 'original', maxSize: 0 }, // No limit
  },
};

// Format optimization configuration
const DEFAULT_FORMAT_OPTIMIZATION_CONFIG: FormatOptimizationConfig = {
  preferredFormats: {
    'image/jpeg': 'webp',
    'image/png': 'webp',
    'image/gif': 'webp',
    'audio/mpeg': 'aac',
    'audio/wav': 'aac',
    'video/mp4': 'webm',
    'video/quicktime': 'webm',
  },
  compressionLevels: {
    'image/webp': 80,
    'image/jpeg': 85,
    'image/png': 75,
    'audio/aac': 128,
    'audio/mp3': 128,
    'video/webm': 80,
    'video/mp4': 85,
  },
  maxSizeKB: {
    'image/webp': 1000,
    'image/jpeg': 1500,
    'image/png': 2000,
    'audio/aac': 32768, // 32MB
    'audio/mp3': 32768,
    'video/webm': 102400, // 100MB
    'video/mp4': 512000, // 500MB
  },
};

class CDNCostOptimizer {
  private config: CostOptimizationConfig;
  private formatConfig: FormatOptimizationConfig;
  private bandwidthMetrics: BandwidthMetrics;
  private qualitySelectionCache: Map<string, QualitySelectionConfig>;
  private observers: Set<IntersectionObserver>;

  constructor(
    config: Partial<CostOptimizationConfig> = {},
    formatConfig: Partial<FormatOptimizationConfig> = {}
  ) {
    this.config = { ...DEFAULT_COST_OPTIMIZATION_CONFIG, ...config };
    this.formatConfig = { ...DEFAULT_FORMAT_OPTIMIZATION_CONFIG, ...formatConfig };
    this.bandwidthMetrics = {
      currentBandwidthGB: 0,
      requestsThisMinute: 0,
      timestamp: new Date(),
      costOptimizationActive: true,
    };
    this.qualitySelectionCache = new Map();
    this.observers = new Set();
  }

  // Get optimized parameters based on context
  getOptimizedParams(
    originalUrl: string,
    contentType: string,
    context: QualitySelectionConfig
  ): CDNOptimizationParams {
    if (!this.config.enableCostOptimization) {
      return {};
    }

    const params: CDNOptimizationParams = {};

    // Apply quality selection
    if (this.config.enableQualitySelection) {
      Object.assign(params, this.getQualitySelection(contentType, context));
    }

    // Apply format optimization
    if (this.config.enableFormatOptimization) {
      Object.assign(params, this.getFormatOptimization(contentType));
    }

    // Apply compression
    if (this.config.enableCompression) {
      Object.assign(params, this.getCompressionSettings(contentType));
    }

    return params;
  }

  // Get quality selection based on context
  private getQualitySelection(
    contentType: string,
    context: QualitySelectionConfig
  ): Partial<CDNOptimizationParams> {
    // Cache quality selection for performance
    const cacheKey = `${context.deviceType}_${context.networkType}_${context.userPreference}`;
    if (this.qualitySelectionCache.has(cacheKey)) {
      return this.qualitySelectionCache.get(cacheKey)!;
    }

    let quality: number;
    let format: string;
    let width: number;
    let height: number;

    // Determine quality based on network type
    switch (context.networkType) {
      case 'slow-2g':
      case '2g':
        quality = 40;
        break;
      case '3g':
        quality = 60;
        break;
      case '4g':
        quality = 75;
        break;
      case 'wifi':
        quality = 85;
        break;
      default:
        quality = 70;
    }

    // Adjust based on user preference
    switch (context.userPreference) {
      case 'low':
        quality = Math.max(30, quality - 20);
        break;
      case 'high':
        quality = Math.min(95, quality + 10);
        break;
    }

    // Determine format based on content type
    if (contentType.startsWith('image/')) {
      format = 'webp';
      width = this.getOptimalWidth(context.deviceType, context.viewportSize.width);
      height = this.getOptimalHeight(context.deviceType, context.viewportSize.height);
    } else if (contentType.startsWith('audio/')) {
      format = 'aac';
    } else if (contentType.startsWith('video/')) {
      format = 'webm';
    } else {
      format = 'original';
    }

    const result: Partial<CDNOptimizationParams> = { quality, format };
    if (width) result.width = width;
    if (height) result.height = height;

    // Cache the result
    this.qualitySelectionCache.set(cacheKey, result);

    return result;
  }

  // Get format optimization settings
  private getFormatOptimization(contentType: string): Partial<CDNOptimizationParams> {
    const preferredFormat = this.formatConfig.preferredFormats[contentType];

    if (!preferredFormat) {
      return {};
    }

    return {
      format: preferredFormat as any,
    };
  }

  // Get compression settings
  private getCompressionSettings(contentType: string): Partial<CDNOptimizationParams> {
    const compressionLevel = this.formatConfig.compressionLevels[contentType];

    if (!compressionLevel) {
      return {};
    }

    return {
      compression: compressionLevel,
    };
  }

  // Get optimal width based on device type
  private getOptimalWidth(deviceType: string, viewportWidth: number): number {
    switch (deviceType) {
      case 'mobile':
        return Math.min(viewportWidth, 400);
      case 'tablet':
        return Math.min(viewportWidth, 800);
      case 'desktop':
        return Math.min(viewportWidth, 1200);
      default:
        return 400;
    }
  }

  // Get optimal height based on device type
  private getOptimalHeight(deviceType: string, viewportHeight: number): number {
    switch (deviceType) {
      case 'mobile':
        return Math.min(viewportHeight, 300);
      case 'tablet':
        return Math.min(viewportHeight, 600);
      case 'desktop':
        return Math.min(viewportHeight, 800);
      default:
        return 300;
    }
  }

  // Lazy loading utilities
  createLazyLoader(): IntersectionObserver {
    if (!this.config.enableLazyLoading) {
      return new IntersectionObserver(() => {});
    }

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const element = entry.target;
            if (element instanceof HTMLElement) {
              const src = element.dataset.src;
              if (src) {
                element.src = src;
                element.removeAttribute('data-src');
                element.classList.add('loaded');
              }
            }
          }
        });
      },
      {
        rootMargin: '50px',
        threshold: 0.1,
      }
    );

    this.observers.add(observer);
    return observer;
  }

  // Bandwidth monitoring
  recordBandwidthUsage(bytes: number): void {
    if (!this.config.enableBandwidthMonitoring) {
      return;
    }

    const now = new Date();
    const timeDiff = now.getTime() - this.bandwidthMetrics.timestamp.getTime();

    // Reset metrics if a new minute has started
    if (timeDiff >= 60000) {
      this.bandwidthMetrics.currentBandwidthGB = 0;
      this.bandwidthMetrics.requestsThisMinute = 0;
      this.bandwidthMetrics.timestamp = now;
    }

    // Add to bandwidth and request count
    this.bandwidthMetrics.currentBandwidthGB += bytes / (1024 * 1024 * 1024); // Convert to GB
    this.bandwidthMetrics.requestsThisMinute++;

    // Check thresholds
    this.checkCostThresholds();
  }

  // Check cost thresholds and trigger alerts
  private checkCostThresholds(): void {
    const { costThresholds } = this.config;

    if (
      this.bandwidthMetrics.currentBandwidthGB >=
      costThresholds.maxBandwidthGB * (costThresholds.alertThreshold / 100)
    ) {
      this.triggerCostAlert(
        'bandwidth',
        this.bandwidthMetrics.currentBandwidthGB,
        costThresholds.maxBandwidthGB
      );
    }

    if (
      this.bandwidthMetrics.requestsThisMinute >=
      costThresholds.maxRequestsPerMinute * (costThresholds.alertThreshold / 100)
    ) {
      this.triggerCostAlert(
        'requests',
        this.bandwidthMetrics.requestsThisMinute,
        costThresholds.maxRequestsPerMinute
      );
    }
  }

  // Trigger cost alert
  private triggerCostAlert(
    type: 'bandwidth' | 'requests',
    current: number,
    threshold: number
  ): void {
    const percentage = (current / threshold) * 100;
    console.warn(
      `CDN Cost Alert - ${type.toUpperCase()}: ${percentage.toFixed(1)}% of threshold used (${current}/${threshold})`
    );

    // In a real implementation, this would send alerts to monitoring systems
    if (percentage >= 100) {
      console.error(
        `CDN Cost Threshold Exceeded - ${type.toUpperCase()}: ${current} exceeds threshold of ${threshold}`
      );
      this.bandwidthMetrics.costOptimizationActive = false;
    }
  }

  // Get current bandwidth metrics
  getBandwidthMetrics(): BandwidthMetrics {
    return { ...this.bandwidthMetrics };
  }

  // Enable/disable cost optimization
  setCostOptimizationEnabled(enabled: boolean): void {
    this.bandwidthMetrics.costOptimizationActive = enabled;
  }

  // Check if cost optimization is active
  isCostOptimizationActive(): boolean {
    return this.bandwidthMetrics.costOptimizationActive;
  }

  // Get optimized image URL with size selection
  getOptimizedImageUrl(
    originalUrl: string,
    size: 'thumbnail' | 'small' | 'medium' | 'large' | 'original',
    context?: QualitySelectionConfig
  ): string {
    const preset = this.config.qualityPresets[size];
    if (!preset) {
      return originalUrl;
    }

    const contentType = this.detectContentType(originalUrl);
    const qualityContext = context || this.detectQualityContext();

    const params: CDNOptimizationParams = {
      quality: preset.quality,
      format: preset.format as any,
      maxSize: preset.maxSize,
    };

    if (qualityContext) {
      Object.assign(params, this.getQualitySelection(contentType, qualityContext));
    }

    // Apply format optimization
    Object.assign(params, this.getFormatOptimization(contentType));

    // Apply compression
    Object.assign(params, this.getCompressionSettings(contentType));

    // Transform URL with optimization parameters
    return this.transformUrlWithParams(originalUrl, params);
  }

  // Detect content type from URL
  private detectContentType(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();

    const mimeTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      aac: 'audio/aac',
      mp4: 'video/mp4',
      webm: 'video/webm',
    };

    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  // Detect quality context from environment
  private detectQualityContext(): QualitySelectionConfig | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const connection =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;

    let networkType: QualitySelectionConfig['networkType'] = 'wifi';

    if (connection) {
      switch (connection.effectiveType) {
        case 'slow-2g':
          networkType = 'slow-2g';
          break;
        case '2g':
          networkType = '2g';
          break;
        case '3g':
          networkType = '3g';
          break;
        case '4g':
          networkType = '4g';
          break;
      }
    }

    let deviceType: QualitySelectionConfig['deviceType'] = 'desktop';
    if (width <= 768) {
      deviceType = 'tablet';
    }
    if (width <= 480) {
      deviceType = 'mobile';
    }

    return {
      deviceType,
      networkType,
      viewportSize: { width, height },
      userPreference: 'auto',
    };
  }

  // Transform URL with optimization parameters
  private transformUrlWithParams(url: string, params: CDNOptimizationParams): string {
    try {
      const urlObj = new URL(url);
      const searchParams = new URLSearchParams(urlObj.search);

      // Add optimization parameters
      if (params.quality) {
        searchParams.set('q', params.quality.toString());
      }
      if (params.format) {
        searchParams.set('fmt', params.format);
      }
      if (params.width) {
        searchParams.set('w', params.width.toString());
      }
      if (params.height) {
        searchParams.set('h', params.height.toString());
      }
      if (params.compression) {
        searchParams.set('cmp', params.compression.toString());
      }
      if (params.maxSize) {
        searchParams.set('maxsize', params.maxSize.toString());
      }

      urlObj.search = searchParams.toString();
      return urlObj.toString();
    } catch (error) {
      console.warn('Failed to transform URL with optimization parameters:', error);
      return url;
    }
  }

  // Clean up observers
  cleanup(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers.clear();
    this.qualitySelectionCache.clear();
  }

  // Get cost optimization report
  getCostOptimizationReport(): {
    config: CostOptimizationConfig;
    bandwidthMetrics: BandwidthMetrics;
    active: boolean;
    cacheSize: number;
    observerCount: number;
  } {
    return {
      config: this.config,
      bandwidthMetrics: this.bandwidthMetrics,
      active: this.bandwidthMetrics.costOptimizationActive,
      cacheSize: this.qualitySelectionCache.size,
      observerCount: this.observers.size,
    };
  }
}

// Global cost optimizer instance
export const cdnCostOptimizer = new CDNCostOptimizer();

// Utility functions
export const createLazyLoader = () => {
  return cdnCostOptimizer.createLazyLoader();
};

export const recordBandwidthUsage = (bytes: number) => {
  return cdnCostOptimizer.recordBandwidthUsage(bytes);
};

export const getBandwidthMetrics = () => {
  return cdnCostOptimizer.getBandwidthMetrics();
};

export const getOptimizedImageUrl = (
  originalUrl: string,
  size: 'thumbnail' | 'small' | 'medium' | 'large' | 'original',
  context?: QualitySelectionConfig
) => {
  return cdnCostOptimizer.getOptimizedImageUrl(originalUrl, size, context);
};

export const getCostOptimizationReport = () => {
  return cdnCostOptimizer.getCostOptimizationReport();
};

export const setCostOptimizationEnabled = (enabled: boolean) => {
  return cdnCostOptimizer.setCostOptimizationEnabled(enabled);
};

export const isCostOptimizationActive = () => {
  return cdnCostOptimizer.isCostOptimizationActive();
};

// Export types and constants
export type {
  CostOptimizationConfig,
  BandwidthMetrics,
  QualitySelectionConfig,
  FormatOptimizationConfig,
};

export { DEFAULT_COST_OPTIMIZATION_CONFIG, DEFAULT_FORMAT_OPTIMIZATION_CONFIG, CDNCostOptimizer };
