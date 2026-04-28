import { describe, it, expect } from 'vitest';
import { authMiddleware } from '../src/middleware/auth.js';
import { Request, Response, NextFunction } from 'express';

function createMockReq(headers: Record<string, string> = {}, query: Record<string, string> = {}): Partial<Request> {
  return {
    headers,
    query,
    path: '/api/test',
  } as Partial<Request>;
}

function createMockRes(): Partial<Response> {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) { res.statusCode = code; return res; },
    json(data: any) { res.body = data; return res; },
  };
  return res;
}

describe('Auth Middleware', () => {
  const originalApiKey = process.env.API_KEY;

  it('should pass through when API_KEY is not set', () => {
    delete process.env.API_KEY;
    let nextCalled = false;
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = () => { nextCalled = true; };

    authMiddleware(req as Request, res as Response, next);
    expect(nextCalled).toBe(true);
  });

  it('should allow health check without API key', () => {
    process.env.API_KEY = 'test-key';
    let nextCalled = false;
    const req = { ...createMockReq(), path: '/health' };
    const res = createMockRes();
    const next: NextFunction = () => { nextCalled = true; };

    authMiddleware(req as Request, res as Response, next);
    expect(nextCalled).toBe(true);
  });

  it('should reject request without API key', () => {
    process.env.API_KEY = 'test-key';
    let nextCalled = false;
    const req = createMockReq();
    const res = createMockRes();
    const next: NextFunction = () => { nextCalled = true; };

    authMiddleware(req as Request, res as Response, next);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(401);
  });

  it('should accept valid API key in header', () => {
    process.env.API_KEY = 'test-key';
    let nextCalled = false;
    const req = createMockReq({ 'x-api-key': 'test-key' });
    const res = createMockRes();
    const next: NextFunction = () => { nextCalled = true; };

    authMiddleware(req as Request, res as Response, next);
    expect(nextCalled).toBe(true);
  });

  it('should reject invalid API key', () => {
    process.env.API_KEY = 'test-key';
    let nextCalled = false;
    const req = createMockReq({ 'x-api-key': 'wrong-key' });
    const res = createMockRes();
    const next: NextFunction = () => { nextCalled = true; };

    authMiddleware(req as Request, res as Response, next);
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
  });

  it('should accept API key in query parameter', () => {
    process.env.API_KEY = 'test-key';
    let nextCalled = false;
    const req = createMockReq({}, { apiKey: 'test-key' });
    const res = createMockRes();
    const next: NextFunction = () => { nextCalled = true; };

    authMiddleware(req as Request, res as Response, next);
    expect(nextCalled).toBe(true);
  });

  if (originalApiKey !== undefined) {
    process.env.API_KEY = originalApiKey;
  } else {
    delete process.env.API_KEY;
  }
});
