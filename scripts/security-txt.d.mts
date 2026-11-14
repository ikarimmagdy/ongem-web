export const SECURITY_CONTACT: string;
export const DEV_ORIGIN: string;
export const AE_DEV_ORIGIN: string;
export const PROD_ORIGIN: string;
export const SECURITY_TXT_PATH: string;
export function securityTxtOrigin(env: Record<string, string | undefined>): string;
export function securityTxt(origin: string, now?: Date): string;
