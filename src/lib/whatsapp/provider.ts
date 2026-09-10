import 'server-only';

/**
 * Provider-agnostic WhatsApp sending interface.
 *
 * This is the ONLY boundary the rest of the app talks to. It deliberately
 * knows nothing about any specific vendor's API shape. To connect a real
 * provider (Meta WhatsApp Business Cloud API, Twilio, Gupshup, etc.), add
 * a new class implementing WhatsappProvider and wire it up in
 * getWhatsappProvider() below — nothing in src/app/admin/whatsapp needs
 * to change.
 *
 * Hard rule carried over from the spec: no browser automation, no
 * WhatsApp Web session hijacking, no unofficial bulk-sending libraries.
 * Every real implementation here must call an official Business
 * Platform / approved BSP API over HTTPS with real credentials.
 */

export type SendMessageParams = {
  to: string; // E.164 phone number
  templateName?: string;
  templateVariables?: Record<string, string>;
  body?: string; // for providers/modes that support free-form text
  mediaUrl?: string;
};

export type SendMessageResult =
  | { status: 'sent'; providerMessageId: string }
  | { status: 'failed'; failureReason: string };

export interface WhatsappProvider {
  readonly name: string;
  sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}

/**
 * Mock provider — the default. Simulates realistic send outcomes (mostly
 * successful, occasional failure) without making any network call or
 * sending a real message. Lets the whole campaign flow (audience
 * selection, scheduling, recipient status tracking) be exercised and
 * demoed on localhost with zero external dependencies or cost.
 */
class MockWhatsappProvider implements WhatsappProvider {
  readonly name = 'mock';

  async sendMessage(_params: SendMessageParams): Promise<SendMessageResult> {
    await new Promise((resolve) => setTimeout(resolve, 150 + Math.random() * 250));

    if (Math.random() < 0.08) {
      return { status: 'failed', failureReason: 'Simulated delivery failure (mock provider)' };
    }

    return {
      status: 'sent',
      providerMessageId: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    };
  }
}

/**
 * Meta WhatsApp Business Cloud API provider — the reference real
 * implementation. Requires WHATSAPP_API_URL, WHATSAPP_API_TOKEN and
 * WHATSAPP_PHONE_NUMBER_ID to be set. Only used when WHATSAPP_PROVIDER is
 * explicitly set to something other than "mock" AND those env vars are
 * present — see getWhatsappProvider().
 *
 * This talks to Meta's official Graph API endpoint for WhatsApp
 * messages. It does not implement template creation/approval — that
 * happens in Meta Business Manager; this class only sends already-
 * approved templates.
 */
class MetaCloudApiProvider implements WhatsappProvider {
  readonly name = 'meta_cloud_api';

  constructor(
    private readonly apiUrl: string,
    private readonly token: string,
    private readonly phoneNumberId: string
  ) {}

  async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
    try {
      const response = await fetch(`${this.apiUrl}/${this.phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          params.templateName
            ? {
                messaging_product: 'whatsapp',
                to: params.to,
                type: 'template',
                template: {
                  name: params.templateName,
                  language: { code: 'en' },
                  components: params.templateVariables
                    ? [
                        {
                          type: 'body',
                          parameters: Object.values(params.templateVariables).map((text) => ({
                            type: 'text',
                            text,
                          })),
                        },
                      ]
                    : undefined,
                },
              }
            : {
                messaging_product: 'whatsapp',
                to: params.to,
                type: 'text',
                text: { body: params.body ?? '' },
              }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          status: 'failed',
          failureReason: data?.error?.message ?? `HTTP ${response.status}`,
        };
      }

      return {
        status: 'sent',
        providerMessageId: data?.messages?.[0]?.id ?? 'unknown',
      };
    } catch (err) {
      return {
        status: 'failed',
        failureReason: err instanceof Error ? err.message : 'Unknown network error',
      };
    }
  }
}

let cachedProvider: WhatsappProvider | null = null;

export function getWhatsappProvider(): WhatsappProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = process.env.WHATSAPP_PROVIDER ?? 'mock';
  const apiUrl = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (providerName !== 'mock' && apiUrl && token && phoneNumberId) {
    cachedProvider = new MetaCloudApiProvider(apiUrl, token, phoneNumberId);
  } else {
    cachedProvider = new MockWhatsappProvider();
  }

  return cachedProvider;
}

export function isUsingMockProvider(): boolean {
  return getWhatsappProvider().name === 'mock';
}
