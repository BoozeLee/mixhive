import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

/**
 * Shared error handling utilities for all Mythic API routes.
 * Provides consistent error responses across the platform.
 */

export function handleApiError(error: unknown, context?: string) {
  console.error(`[Mythic API Error${context ? ` - ${context}` : ''}]`, error);

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    // Common known errors
    if (error.message.includes('Not authenticated') || error.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (error.message.includes('Not authorized') || error.message.includes('permission')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Generic safe error for client
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function badRequest(message: string, issues?: any) {
  return NextResponse.json(
    { error: message, ...(issues && { issues }) },
    { status: 400 }
  );
}

export function notFound(message = 'Resource not found') {
  return NextResponse.json({ error: message }, { status: 404 });
}