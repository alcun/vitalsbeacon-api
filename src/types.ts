export interface AuditOptions {
  url: string;
  categories: string[];
}

export interface AuditResult {
  url: string;
  timestamp: string;
  scores: {
    performance?: number;
    accessibility?: number;
    bestPractices?: number;
    seo?: number;
  };
  coreWebVitals: {
    largestContentfulPaint: VitalMetric;
    firstContentfulPaint: VitalMetric;
    speedIndex: VitalMetric;
    timeToInteractive: VitalMetric;
    totalBlockingTime: VitalMetric;
    cumulativeLayoutShift: VitalMetric;
  };
  categories: string[];
}

export interface VitalMetric {
  value: string;
  score: number;
  numericValue?: number;
  rating?: 'good' | 'needs-improvement' | 'poor' | 'unknown';
}