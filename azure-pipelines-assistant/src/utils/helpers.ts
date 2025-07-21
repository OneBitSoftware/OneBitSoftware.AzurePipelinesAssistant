import { PipelineState, PipelineResult } from '../models/common';

/**
 * Format a date for display
 */
export function formatDate(date: Date | string | undefined, showTime: boolean = true): string {
  if (!date) {
    return 'N/A';
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (showTime) {
    return dateObj.toLocaleString();
  } else {
    return dateObj.toLocaleDateString();
  }
}

/**
 * Format duration between two dates
 */
export function formatDuration(startTime: Date | string | undefined, endTime: Date | string | undefined): string {
  if (!startTime) {
    return 'N/A';
  }
  
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = endTime ? (typeof endTime === 'string' ? new Date(endTime) : endTime) : new Date();
  
  const durationMs = end.getTime() - start.getTime();
  const seconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Get icon for pipeline state
 */
export function getStateIcon(state: PipelineState): string {
  switch (state) {
    case 'completed':
      return '$(check)';
    case 'inProgress':
      return '$(sync~spin)';
    case 'cancelling':
      return '$(loading~spin)';
    case 'cancelled':
      return '$(circle-slash)';
    default:
      return '$(question)';
  }
}

/**
 * Get icon for pipeline result
 */
export function getResultIcon(result: PipelineResult | undefined): string {
  switch (result) {
    case 'succeeded':
      return '$(pass)';
    case 'failed':
      return '$(error)';
    case 'canceled':
      return '$(circle-slash)';
    case 'abandoned':
      return '$(trash)';
    case 'partiallySucceeded':
      return '$(warning)';
    default:
      return '$(question)';
  }
}

/**
 * Get color for pipeline result
 */
export function getResultColor(result: PipelineResult | undefined): string {
  switch (result) {
    case 'succeeded':
      return 'charts.green';
    case 'failed':
      return 'charts.red';
    case 'canceled':
      return 'charts.gray';
    case 'abandoned':
      return 'charts.gray';
    case 'partiallySucceeded':
      return 'charts.yellow';
    default:
      return 'charts.gray';
  }
}

/**
 * Truncate text to specified length
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Sanitize text for display (remove special characters)
 */
export function sanitizeText(text: string): string {
  return text.replace(/[^\w\s-_.]/g, '');
}

/**
 * Check if a pipeline run can be cancelled
 */
export function canCancelRun(state: PipelineState): boolean {
  return state === 'inProgress';
}

/**
 * Get relative time string (e.g., "2 hours ago")
 */
export function getRelativeTime(date: Date | string | undefined): string {
  if (!date) {
    return 'N/A';
  }
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMinutes > 0) {
    return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}