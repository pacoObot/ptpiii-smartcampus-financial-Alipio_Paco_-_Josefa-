import { z } from 'zod';
import { env } from '../../../config/env';
import type { FinancialNotificationEvent } from '@smart-campus/shared-types';

const acknowledgementSchema = z.object({
  data: z.object({
    id: z.string().min(1).max(200),
    sourceEventId: z.string().min(1),
    status: z.literal('ACCEPTED'),
  }),
});

export function notificationsConfigured(): boolean {
  if (!env.NOTIFICATIONS_API_TOKEN) return false;
  try {
    const url = new URL(env.NOTIFICATIONS_API_URL);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

// The receiver must deduplicate by (sourceModule, sourceEventId).
export async function sendToNotifications(event: FinancialNotificationEvent, correlationId: string): Promise<string> {
  const response = await fetch(env.NOTIFICATIONS_API_URL, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(env.NOTIFICATIONS_TIMEOUT_MS),
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.NOTIFICATIONS_API_TOKEN}`,
      'Idempotency-Key': `financial:${event.sourceEventId}`,
      'x-correlation-id': correlationId,
    },
    body: JSON.stringify(event),
  });
  if (response.status !== 200 && response.status !== 201) {
    await response.body?.cancel();
    throw new Error(`NOTIFICATIONS_HTTP_${response.status}`);
  }
  const parsed = acknowledgementSchema.safeParse(await response.json());
  if (!parsed.success || parsed.data.data.sourceEventId !== event.sourceEventId) {
    throw new Error('NOTIFICATIONS_INVALID_ACK');
  }
  return parsed.data.data.id;
}
