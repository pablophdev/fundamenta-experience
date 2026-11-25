/** Resolve public files against Vite's base, including GitHub project Pages. */
export function assetPath(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;
}
