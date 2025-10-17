import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import type { AuditOptions, AuditResult } from './types';

const AUDIT_TIMEOUT = 60000; // 60 seconds

function getVitalRating(value: number | undefined, metric: 'lcp' | 'cls'): 'good' | 'needs-improvement' | 'poor' | 'unknown' {
  if (!value) return 'unknown';
  
  switch(metric) {
    case 'lcp':
      if (value <= 2500) return 'good';
      if (value <= 4000) return 'needs-improvement';
      return 'poor';
    case 'cls':
      if (value <= 0.1) return 'good';
      if (value <= 0.25) return 'needs-improvement';
      return 'poor';
    default:
      return 'unknown';
  }
}

export async function runLighthouseAudit(options: AuditOptions): Promise<AuditResult> {
  let chrome = null;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Audit timed out after 60 seconds')), AUDIT_TIMEOUT);
  });
  
  const auditPromise = (async () => {
    try {
      console.log(`🚨 Running Lighthouse audit for: ${options.url}`);
      
      chrome = await chromeLauncher.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium-browser',
        chromeFlags: [
          '--headless',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions'
        ]
      });

      const lighthouseOptions = {
        logLevel: 'error' as const,
        output: 'json' as const,
        onlyCategories: options.categories,
        port: chrome.port,
        maxWaitForLoad: 45000 // 45s max page load
      };

      const runnerResult = await lighthouse(options.url, lighthouseOptions);
      if (!runnerResult) throw new Error('Lighthouse returned no results');
      
      const lhr = runnerResult.lhr;
      
      const scores: AuditResult['scores'] = {};
      if (lhr.categories.performance) 
        scores.performance = Math.round(lhr.categories.performance.score * 100);
      if (lhr.categories.accessibility) 
        scores.accessibility = Math.round(lhr.categories.accessibility.score * 100);
      if (lhr.categories['best-practices']) 
        scores.bestPractices = Math.round(lhr.categories['best-practices'].score * 100);
      if (lhr.categories.seo) 
        scores.seo = Math.round(lhr.categories.seo.score * 100);

      const coreWebVitals = {
        largestContentfulPaint: {
          value: lhr.audits['largest-contentful-paint']?.displayValue || 'N/A',
          score: Math.round((lhr.audits['largest-contentful-paint']?.score || 0) * 100),
          numericValue: lhr.audits['largest-contentful-paint']?.numericValue,
          rating: getVitalRating(lhr.audits['largest-contentful-paint']?.numericValue, 'lcp')
        },
        firstContentfulPaint: {
          value: lhr.audits['first-contentful-paint']?.displayValue || 'N/A',
          score: Math.round((lhr.audits['first-contentful-paint']?.score || 0) * 100),
          numericValue: lhr.audits['first-contentful-paint']?.numericValue
        },
        speedIndex: {
          value: lhr.audits['speed-index']?.displayValue || 'N/A',
          score: Math.round((lhr.audits['speed-index']?.score || 0) * 100),
          numericValue: lhr.audits['speed-index']?.numericValue
        },
        timeToInteractive: {
          value: lhr.audits['interactive']?.displayValue || 'N/A',
          score: Math.round((lhr.audits['interactive']?.score || 0) * 100),
          numericValue: lhr.audits['interactive']?.numericValue
        },
        totalBlockingTime: {
          value: lhr.audits['total-blocking-time']?.displayValue || 'N/A',
          score: Math.round((lhr.audits['total-blocking-time']?.score || 0) * 100),
          numericValue: lhr.audits['total-blocking-time']?.numericValue
        },
        cumulativeLayoutShift: {
          value: lhr.audits['cumulative-layout-shift']?.displayValue || 'N/A',
          score: Math.round((lhr.audits['cumulative-layout-shift']?.score || 0) * 100),
          numericValue: lhr.audits['cumulative-layout-shift']?.numericValue,
          rating: getVitalRating(lhr.audits['cumulative-layout-shift']?.numericValue, 'cls')
        }
      };
      
      console.log(`✅ Audit complete: ${options.url}`);
      
      return {
        url: options.url,
        timestamp: new Date().toISOString(),
        scores,
        coreWebVitals,
        categories: options.categories
      };
      
    } finally {
      if (chrome) {
        await chrome.kill();
      }
    }
  })();
  
  return Promise.race([auditPromise, timeoutPromise]);
}