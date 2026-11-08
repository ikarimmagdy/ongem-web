declare module 'virtual:ongem-content' {
  import type { RegionContent } from './types';
  const content: Partial<Record<'us' | 'ae', RegionContent>>;
  export default content;
}

declare module 'virtual:ongem-content-ar' {
  import type { RegionContent } from './types';
  const content: Partial<Record<'us' | 'ae', RegionContent>>;
  export default content;
}
