/** Extension point for Meta WhatsApp Business Platform or an approved BSP.
 * Never use personal-session automation. Configure credentials only on the server.
 * A future adapter must verify opt-in, approved template, locale and E.164 phone.
 * WhatsApp delivery needs its own outbox status/idempotency, separate from email.
 */
export type WhatsAppNotice = {
  recipientId: string;
  templateName: string;
  locale: string;
  parameters: string[];
  idempotencyKey: string;
};
export interface WhatsAppProvider {
  sendTemplate(message: WhatsAppNotice): Promise<{ providerId: string }>;
}
export function whatsappProvider(): WhatsAppProvider | null {
  // SETUP: implement an approved provider adapter and persist recipient opt-in before enabling.
  return null;
}
