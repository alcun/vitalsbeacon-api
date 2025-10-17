import { runLighthouseAudit } from './lighthouse';
import type { AuditOptions, AuditResult } from './types';

interface QueueItem {
  options: AuditOptions;
  resolve: (result: AuditResult) => void;
  reject: (error: Error) => void;
}

const queue: QueueItem[] = [];
let activeRequests = 0;
const MAX_CONCURRENT = 2;
const MAX_QUEUE_SIZE = 10;

export async function queueAudit(options: AuditOptions): Promise<AuditResult> {
  return new Promise((resolve, reject) => {
    if (queue.length >= MAX_QUEUE_SIZE) {
      reject(new Error('Queue is full'));
      return;
    }
    
    queue.push({ options, resolve, reject });
    processQueue();
  });
}

async function processQueue() {
  if (activeRequests >= MAX_CONCURRENT || queue.length === 0) {
    return;
  }
  
  const item = queue.shift();
  if (!item) return;
  
  activeRequests++;
  console.log(`🔍 Processing audit (${activeRequests}/${MAX_CONCURRENT} active, ${queue.length} queued)`);
  
  try {
    const result = await runLighthouseAudit(item.options);
    item.resolve(result);
  } catch (error) {
    item.reject(error as Error);
  } finally {
    activeRequests--;
    processQueue();
  }
}

export function getQueueStats() {
  return {
    activeRequests,
    queuedRequests: queue.length,
    maxConcurrent: MAX_CONCURRENT,
    maxQueueSize: MAX_QUEUE_SIZE
  };
}