'use strict';

const DEFAULT_MAX_RETRIES = 3;

const RETRYABLE_CODES = new Set([
  'PRECONDITION_FAILED',
  'TEMPORARY_GOOGLE_API_FAILURE',
  'TEMPORARY_PROVIDER_FAILURE',
  'RATE_LIMITED',
  'NETWORK_TIMEOUT',
  'LOCK_CONTENTION'
]);

const NON_RETRYABLE_CODES = new Set([
  'AUTHORITY_MISMATCH',
  'SCHEMA_MISMATCH',
  'INVALID_EVENT_ENVELOPE',
  'GUARD_BLOCKED',
  'AMBIGUOUS_MATCH',
  'CONFLICTING_MATCH',
  'NO_DETERMINISTIC_MATCH',
  'IDEMPOTENCY_KEY_MISMATCH'
]);

function classifyRetry({
  reasonCode,
  retryCount = 0,
  maxRetries = DEFAULT_MAX_RETRIES
} = {}) {
  const code = String(reasonCode || '').toUpperCase();
  const count = Number(retryCount || 0);

  if (NON_RETRYABLE_CODES.has(code)) {
    return {
      action: 'REVIEW_REQUIRED',
      reason_code: 'NON_RETRYABLE_FAILURE',
      original_reason_code: code,
      retry_count: count,
      max_retries: maxRetries
    };
  }

  if (!RETRYABLE_CODES.has(code)) {
    return {
      action: 'REVIEW_REQUIRED',
      reason_code: 'UNKNOWN_RETRY_CLASSIFICATION',
      original_reason_code: code || 'UNKNOWN',
      retry_count: count,
      max_retries: maxRetries
    };
  }

  if (count >= maxRetries) {
    return {
      action: 'DEAD_LETTER',
      reason_code: 'RETRY_LIMIT_EXCEEDED',
      original_reason_code: code,
      retry_count: count,
      max_retries: maxRetries
    };
  }

  return {
    action: 'RETRY',
    reason_code: 'RETRYABLE_FAILURE',
    original_reason_code: code,
    retry_count: count,
    next_retry_count: count + 1,
    max_retries: maxRetries
  };
}

module.exports = {
  DEFAULT_MAX_RETRIES,
  RETRYABLE_CODES,
  NON_RETRYABLE_CODES,
  classifyRetry
};
