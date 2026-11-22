export interface HeadersPolicy {
  Name: string;
  Comment: string;
  SecurityHeadersConfig: {
    ContentSecurityPolicy: { ContentSecurityPolicy: string };
    FrameOptions: { FrameOption: string };
    ReferrerPolicy: { ReferrerPolicy: string };
  };
  CustomHeadersConfig: { Items: Array<{ Header: string; Value: string }> };
}
export function acceptanceHeaders(env?: 'sandbox' | 'production', base?: HeadersPolicy): HeadersPolicy;
export function writeAcceptanceHeaders(env?: 'sandbox' | 'production'): void;
