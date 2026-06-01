/**
 * CDN Configuration Management
 * 
 * Manages CDN configuration across different environments
 * and provides utilities for configuration validation and updates.
 */

import { cdnConfig, CDNConfig } from './cdn';

interface EnvironmentConfig {
  name: 'development' | 'staging' | 'production';
  cdn: Partial<CDNConfig>;
  features: {
    enableCDN: boolean;
    enableOptimization: boolean;
    enableLazyLoading: boolean;
    enableHealthMonitoring: boolean;
    enableAnalytics: boolean;
  };
  performance: {
    cacheTTL: number;
    maxFileSize: number;
    concurrentUploads: number;
    retryAttempts: number;
  };
}

interface ValidationRule {
  key: keyof CDNConfig;
  required: boolean;
  validator: (value: any) => boolean;
  message: string;
}

interface CDNProviderConfig {
  name: string;
  baseUrl: string;
  auth?: {
    apiKey?: string;
    secretKey?: string;
    token?: string;
  };
  regions: string[];
  features: {
    imageOptimization: boolean;
    videoOptimization: boolean;
    audioOptimization: boolean;
    compression: boolean;
    lazyLoading: boolean;
  };
}

// Environment-specific configurations
const ENVIRONMENT_CONFIGS: Record<string, EnvironmentConfig> = {
  development: {
    name: 'development',
    cdn: {
      enabled: false, // Disabled in development for easier debugging
      fallbackToSupabase: true,
      provider: 'supabase',
      cacheSettings: {
        audio: { maxAge: 3600, immutable: false },
        artwork: { maxAge: 3600, immutable: false },
        waveform: { maxAge: 3600, immutable: false },
        avatar: { maxAge: 300, immutable: false },
        banner: { maxAge: 300, immutable: false },
        buzz: { maxAge: 300, immutable: false },
      },
      optimization: {
        lazyLoading: false,
        qualitySelection: false,
        formatOptimization: false,
        compression: false,
      },
    },
    features: {
      enableCDN: false,
      enableOptimization: false,
      enableLazyLoading: false,
      enableHealthMonitoring: true,
      enableAnalytics: false,
    },
    performance: {
      cacheTTL: 3600,
      maxFileSize: 10 * 1024 * 1024, // 10MB
      concurrentUploads: 1,
      retryAttempts: 1,
    },
  },
  staging: {
    name: 'staging',
    cdn: {
      enabled: true,
      fallbackToSupabase: true,
      provider: 'cloudflare',
      baseUrl: process.env.NEXT_PUBLIC_CDN_BASE_URL || 'https://cdn.staging.mixhive.app',
      cacheSettings: {
        audio: { maxAge: 86400, immutable: true, sMaxAge: 3600 },
        artwork: { maxAge: 86400, immutable: true, sMaxAge: 3600 },
        waveform: { maxAge: 86400, immutable: true, sMaxAge: 3600 },
        avatar: { maxAge: 3600, immutable: false, sMaxAge: 1800 },
        banner: { maxAge: 3600, immutable: false, sMaxAge: 1800 },
        buzz: { maxAge: 3600, immutable: false, sMaxAge: 1800 },
      },
      optimization: {
        lazyLoading: true,
        qualitySelection: true,
        formatOptimization: true,
        compression: true,
      },
    },
    features: {
      enableCDN: true,
      enableOptimization: true,
      enableLazyLoading: true,
      enableHealthMonitoring: true,
      enableAnalytics: true,
    },
    performance: {
      cacheTTL: 86400,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      concurrentUploads: 3,
      retryAttempts: 3,
    },
  },
  production: {
    name: 'production',
    cdn: {
      enabled: true,
      fallbackToSupabase: true,
      provider: process.env.NEXT_PUBLIC_CDN_PROVIDER || 'cloudflare',
      baseUrl: process.env.NEXT_PUBLIC_CDN_BASE_URL || 'https://cdn.mixhive.app',
      cacheSettings: {
        audio: { maxAge: 31536000, immutable: true, sMaxAge: 31536000 },
        artwork: { maxAge: 31536000, immutable: true, sMaxAge: 31536000 },
        waveform: { maxAge: 31536000, immutable: true, sMaxAge: 31536000 },
        avatar: { maxAge: 86400, immutable: false, sMaxAge: 3600 },
        banner: { maxAge: 86400, immutable: false, sMaxAge: 3600 },
        buzz: { maxAge: 86400, immutable: false, sMaxAge: 3600 },
      },
      optimization: {
        lazyLoading: true,
        qualitySelection: true,
        formatOptimization: true,
        compression: true,
      },
    },
    features: {
      enableCDN: true,
      enableOptimization: true,
      enableLazyLoading: true,
      enableHealthMonitoring: true,
      enableAnalytics: true,
    },
    performance: {
      cacheTTL: 31536000,
      maxFileSize: 500 * 1024 * 1024, // 500MB
      concurrentUploads: 5,
      retryAttempts: 5,
    },
  },
};

// CDN provider configurations
const CDN_PROVIDERS: Record<string, CDNProviderConfig> = {
  cloudflare: {
    name: 'Cloudflare',
    baseUrl: 'https://cdn.mixhive.app',
    regions: ['global'],
    features: {
      imageOptimization: true,
      videoOptimization: true,
      audioOptimization: true,
      compression: true,
      lazyLoading: true,
    },
  },
  'aws-cloudfront': {
    name: 'AWS CloudFront',
    baseUrl: 'https://d1234567890.cloudfront.net',
    auth: {
      apiKey: process.env.AWS_CLOUDFRONT_API_KEY,
      secretKey: process.env.AWS_CLOUDFRONT_SECRET_KEY,
    },
    regions: ['us-east-1', 'us-west-2', 'eu-west-1'],
    features: {
      imageOptimization: true,
      videoOptimization: true,
      audioOptimization: true,
      compression: true,
      lazyLoading: true,
    },
  },
  custom: {
    name: 'Custom CDN',
    baseUrl: process.env.NEXT_PUBLIC_CDN_BASE_URL || 'https://cdn.mixhive.app',
    regions: ['global'],
    features: {
      imageOptimization: false,
      videoOptimization: false,
      audioOptimization: false,
      compression: false,
      lazyLoading: false,
    },
  },
  supabase: {
    name: 'Supabase CDN',
    baseUrl: 'https://your-project.supabase.co',
    regions: ['global'],
    features: {
      imageOptimization: false,
      videoOptimization: false,
      audioOptimization: false,
      compression: false,
      lazyLoading: false,
    },
  },
};

class CDNConfigManager {
  private currentEnvironment: string;
  private currentConfig: CDNConfig;
  private validationRules: ValidationRule[];

  constructor(environment: string = 'development') {
    this.currentEnvironment = environment;
    this.currentConfig = this.loadEnvironmentConfig(environment);
    this.validationRules = this.createValidationRules();
  }

  // Load environment-specific configuration
  private loadEnvironmentConfig(environment: string): CDNConfig {
    const envConfig = ENVIRONMENT_CONFIGS[environment] || ENVIRONMENT_CONFIGS.development;
    const baseConfig = cdnConfig;
    
    // Merge environment-specific config with base config
    return {
      ...baseConfig,
      ...envConfig.cdn,
    };
  }

  // Create validation rules
  private createValidationRules(): ValidationRule[] {
    return [
      {
        key: 'provider',
        required: true,
        validator: (value) => ['cloudflare', 'aws-cloudfront', 'custom', 'supabase'].includes(value),
        message: 'CDN provider must be one of: cloudflare, aws-cloudfront, custom, supabase',
      },
      {
        key: 'enabled',
        required: true,
        validator: (value) => typeof value === 'boolean',
        message: 'CDN enabled must be a boolean',
      },
      {
        key: 'fallbackToSupabase',
        required: true,
        validator: (value) => typeof value === 'boolean',
        message: 'Fallback to Supabase must be a boolean',
      },
      {
        key: 'baseUrl',
        required: false,
        validator: (value) => !value || typeof value === 'string',
        message: 'CDN base URL must be a string',
      },
      {
        key: 'cacheSettings',
        required: true,
        validator: (value) => typeof value === 'object',
        message: 'Cache settings must be an object',
      },
      {
        key: 'optimization',
        required: true,
        validator: (value) => typeof value === 'object',
        message: 'Optimization settings must be an object',
      },
    ];
  }

  // Get current environment
  getCurrentEnvironment(): string {
    return this.currentEnvironment;
  }

  // Get current configuration
  getCurrentConfig(): CDNConfig {
    return this.currentConfig;
  }

  // Get environment-specific configuration
  getEnvironmentConfig(environment: string): EnvironmentConfig | null {
    return ENVIRONMENT_CONFIGS[environment] || null;
  }

  // Switch environment
  switchEnvironment(environment: string): void {
    if (!ENVIRONMENT_CONFIGS[environment]) {
      throw new Error(`Unknown environment: ${environment}`);
    }

    this.currentEnvironment = environment;
    this.currentConfig = this.loadEnvironmentConfig(environment);
  }

  // Validate configuration
  validateConfiguration(config: Partial<CDNConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const rule of this.validationRules) {
      const value = config[rule.key];
      
      if (rule.required && (value === undefined || value === null)) {
        errors.push(`Missing required configuration: ${rule.key}`);
        continue;
      }

      if (value !== undefined && !rule.validator(value)) {
        errors.push(rule.message);
      }
    }

    // Additional validation for environment-specific settings
    if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
      errors.push('CDN base URL must be a valid URL');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // Check if URL is valid
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Get CDN provider configuration
  getCDNProvider(provider: string): CDNProviderConfig | null {
    return CDN_PROVIDERS[provider] || null;
  }

  // Get available providers
  getAvailableProviders(): string[] {
    return Object.keys(CDN_PROVIDERS);
  }

  // Update configuration
  updateConfiguration(updates: Partial<CDNConfig>): void {
    const updatedConfig = { ...this.currentConfig, ...updates };
    const validation = this.validateConfiguration(updatedConfig);

    if (!validation.valid) {
      throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
    }

    this.currentConfig = updatedConfig;
  }

  // Get feature flags for current environment
  getFeatureFlags(): EnvironmentConfig['features'] {
    const envConfig = ENVIRONMENT_CONFIGS[this.currentEnvironment];
    return envConfig?.features || ENVIRONMENT_CONFIGS.development.features;
  }

  // Get performance settings for current environment
  getPerformanceSettings(): EnvironmentConfig['performance'] {
    const envConfig = ENVIRONMENT_CONFIGS[this.currentEnvironment];
    return envConfig?.performance || ENVIRONMENT_CONFIGS.development.performance;
  }

  // Check if a feature is enabled
  isFeatureEnabled(feature: keyof EnvironmentConfig['features']): boolean {
    return this.getFeatureFlags()[feature];
  }

  // Get cache TTL for specific bucket
  getCacheTTL(bucket: string): number {
    const envConfig = ENVIRONMENT_CONFIGS[this.currentEnvironment];
    const cacheSettings = envConfig?.cdn?.cacheSettings;
    
    if (!cacheSettings) return 3600; // Default 1 hour
    
    const bucketConfig = cacheSettings[bucket as keyof typeof cacheSettings];
    return bucketConfig?.maxAge || 3600;
  }

  // Get max file size for uploads
  getMaxFileSize(): number {
    const envConfig = ENVIRONMENT_CONFIGS[this.currentEnvironment];
    return envConfig?.performance.maxFileSize || 10 * 1024 * 1024; // 10MB default
  }

  // Get concurrent upload limit
  getConcurrentUploads(): number {
    const envConfig = ENVIRONMENT_CONFIGS[this.currentEnvironment];
    return envConfig?.performance.concurrentUploads || 1;
  }

  // Get retry attempts
  getRetryAttempts(): number {
    const envConfig = ENVIRONMENT_CONFIGS[this.currentEnvironment];
    return envConfig?.performance.retryAttempts || 1;
  }

  // Generate configuration for different environments
  generateConfigsForAllEnvironments(): Record<string, CDNConfig> {
    const configs: Record<string, CDNConfig> = {};

    for (const env of Object.keys(ENVIRONMENT_CONFIGS)) {
      configs[env] = this.loadEnvironmentConfig(env);
    }

    return configs;
  }

  // Export configuration
  exportConfiguration(): string {
    return JSON.stringify({
      environment: this.currentEnvironment,
      config: this.currentConfig,
      featureFlags: this.getFeatureFlags(),
      performance: this.getPerformanceSettings(),
      exportedAt: new Date().toISOString(),
    }, null, 2);
  }

  // Import configuration
  importConfiguration(configJson: string): void {
    try {
      const imported = JSON.parse(configJson);
      
      if (imported.environment) {
        this.switchEnvironment(imported.environment);
      }
      
      if (imported.config) {
        const validation = this.validateConfiguration(imported.config);
        if (!validation.valid) {
          throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
        }
        
        this.currentConfig = { ...this.currentConfig, ...imported.config };
      }
    } catch (error) {
      throw new Error(`Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Get environment-specific CDN URL
  getCDNUrl(path: string): string {
    if (!this.currentConfig.baseUrl) {
      return path;
    }

    // Ensure path starts with /
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.currentConfig.baseUrl}${normalizedPath}`;
  }

  // Get environment-specific optimization settings
  getOptimizationSettings(): CDNConfig['optimization'] {
    return this.currentConfig.optimization;
  }

  // Check if CDN is available in current environment
  isCDNAvailable(): boolean {
    return this.currentConfig.enabled && !!this.currentConfig.baseUrl;
  }

  // Get CDN status summary
  getStatusSummary(): {
    environment: string;
    enabled: boolean;
    provider: string;
    baseUrl: string | undefined;
    features: EnvironmentConfig['features'];
    performance: EnvironmentConfig['performance'];
  } {
    return {
      environment: this.currentEnvironment,
      enabled: this.currentConfig.enabled,
      provider: this.currentConfig.provider,
      baseUrl: this.currentConfig.baseUrl,
      features: this.getFeatureFlags(),
      performance: this.getPerformanceSettings(),
    };
  }
}

// Global configuration manager instance
export const cdnConfigManager = new CDNConfigManager();

// Utility functions
export const getCDNConfigForEnvironment = (environment: string): CDNConfig | null => {
  return cdnConfigManager.getEnvironmentConfig(environment)?.cdn || null;
};

export const validateCDNConfig = (config: Partial<CDNConfig>): { valid: boolean; errors: string[] } => {
  return cdnConfigManager.validateConfiguration(config);
};

export const getCDNStatus = () => {
  return cdnConfigManager.getStatusSummary();
};

export const switchCDNEnvironment = (environment: string): void => {
  cdnConfigManager.switchEnvironment(environment);
};

export const exportCDNConfig = (): string => {
  return cdnConfigManager.exportConfiguration();
};

export const importCDNConfig = (configJson: string): void => {
  cdnConfigManager.importConfiguration(configJson);
};

// Environment detection utilities
export const detectEnvironment = (): string => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Override for specific conditions
  if (process.env.VERCEL_ENV === 'production') {
    return 'production';
  }
  
  if (process.env.VERCEL_ENV === 'preview') {
    return 'staging';
  }
  
  return nodeEnv;
};

// Initialize configuration based on detected environment
export const initializeCDNConfig = (): void => {
  const detectedEnv = detectEnvironment();
  cdnConfigManager.switchEnvironment(detectedEnv);
};

// Auto-initialize on import
if (typeof window !== 'undefined') {
  initializeCDNConfig();
}

// Export all utilities
export const CDN_CONFIG_UTILS = {
  cdnConfigManager,
  getCDNConfigForEnvironment,
  validateCDNConfig,
  getCDNStatus,
  switchCDNEnvironment,
  exportCDNConfig,
  importCDNConfig,
  detectEnvironment,
  initializeCDNConfig,
  ENVIRONMENT_CONFIGS,
  CDN_PROVIDERS,
} as const;