'use strict';

const crypto = require('crypto');
const express = require('express');
const { TransactionWriter } = require('../writer/transaction-writer');
const { EventProcessor } = require('../processor/event-processor');

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  if (!a.length || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function extractBearerToken(req) {
  const value = req.get('authorization') || '';
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

function isPlausiblePlan(plan) {
  return Boolean(
    plan &&
    typeof plan === 'object' &&
    plan.idempotency_key &&
    plan.event_type &&
    plan.source_event_id &&
    Array.isArray(plan.preconditions) &&
    Array.isArray(plan.writes) &&
    plan.writes.length
  );
}

function createRuntimeApp({
  token = process.env.MAGOS_RUNTIME_TOKEN,
  writerFactory = () => new TransactionWriter(),
  eventProcessorFactory = () => new EventProcessor(),
  version = process.env.MAGOS_RUNTIME_VERSION || 'P2'
} = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  let writer;
  let eventProcessor;

  const getWriter = () => {
    if (!writer) writer = writerFactory();
    return writer;
  };

  const getEventProcessor = () => {
    if (!eventProcessor) eventProcessor = eventProcessorFactory();
    return eventProcessor;
  };

  app.get('/healthz', (req, res) => {
    res.status(200).json({
      service: 'MAGOS Automation Runtime V1',
      status: 'ok',
      version
    });
  });

  app.get('/readyz', (req, res) => {
    const ready = Boolean(token);
    res.status(ready ? 200 : 503).json({
      service: 'MAGOS Automation Runtime V1',
      status: ready ? 'ready' : 'not_ready',
      auth_configured: ready
    });
  });

  function requireRuntimeAuth(req, res, next) {
    if (!token) {
      return res.status(503).json({
        error: 'MAGOS_RUNTIME_NOT_CONFIGURED'
      });
    }

    const supplied = extractBearerToken(req);
    if (!constantTimeEqual(supplied, token)) {
      return res.status(401).json({
        error: 'UNAUTHORIZED'
      });
    }
    return next();
  }

  app.post('/v1/probes/google-sheets', requireRuntimeAuth, async (req, res) => {
    try {
      const runtimeWriter = getWriter();
      await runtimeWriter.audit.getHeaders('Automation_Run_Log');
      return res.status(200).json({
        service: 'MAGOS Automation Runtime V1',
        status: 'ok',
        google_sheets: 'reachable',
        audit_store: 'reachable'
      });
    } catch (error) {
      return res.status(503).json({
        service: 'MAGOS Automation Runtime V1',
        status: 'not_ready',
        google_sheets: 'unreachable',
        error: error.message
      });
    }
  });

  app.post('/v1/events/decide', requireRuntimeAuth, async (req, res) => {
    try {
      const decision = await getEventProcessor().decide(req.body);
      const status =
        decision.decision === 'REJECTED'
          ? 400
          : decision.decision === 'REVIEW_REQUIRED'
            ? 202
            : 200;
      return res.status(status).json(decision);
    } catch (error) {
      return res.status(500).json({
        error: 'EVENT_PROCESSOR_FAILURE',
        detail: error.message
      });
    }
  });

  app.post('/v1/transactions', requireRuntimeAuth, async (req, res) => {
    if (!isPlausiblePlan(req.body)) {
      return res.status(400).json({
        error: 'INVALID_TRANSACTION_PLAN'
      });
    }

    try {
      const result = await getWriter().execute(req.body);
      const status =
        result.state === 'COMMITTED' || result.state === 'DUPLICATE_NO_OP'
          ? 200
          : result.state === 'RETRY_REQUIRED'
            ? 409
            : 500;
      return res.status(status).json(result);
    } catch (error) {
      return res.status(500).json({
        state: 'FAILED',
        error: error.message
      });
    }
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error?.type === 'entity.too.large') {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    }
    if (error instanceof SyntaxError && 'body' in error) {
      return res.status(400).json({ error: 'INVALID_JSON' });
    }
    return res.status(500).json({ error: 'INTERNAL_RUNTIME_ERROR' });
  });

  return app;
}

module.exports = {
  createRuntimeApp,
  constantTimeEqual,
  extractBearerToken,
  isPlausiblePlan
};
