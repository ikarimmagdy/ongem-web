const ISO = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** An ISO 8601 duration of days, hours, minutes and seconds (PT168H, PT15M, P30D) in milliseconds; null when it is not one. */
export function durationMs(iso: string): number | null {
  const m = ISO.exec(iso.trim());
  if (!m || iso.trim() === 'P' || iso.trim().endsWith('T')) return null;
  const [d, h, min, s] = [m[1], m[2], m[3], m[4]].map((x) => Number(x ?? 0));
  return (((d! * 24 + h!) * 60 + min!) * 60 + s!) * 1000;
}
