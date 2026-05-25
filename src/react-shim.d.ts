/*
  Temporary minimal React type shim.
  The repo currently lacks @types/react, and tsc is failing.
  This shim is intentionally small: it provides just enough types
  for the existing code to compile.
*/

declare module "react" {
  export type ReactNode = any;

  export type FormEvent<T = Element> = any;
  export type ChangeEvent<T = Element> = any;
  export type MouseEvent<T = Element> = any;
  export type DragEvent<T = Element> = any;

  export function useState<S>(initial: S): [S, (v: S) => void];
  export function useState<S>(initial: S | (() => S)): [S, (v: S) => void];

  export function useEffect(effect: any, deps?: any[]): void;
  export function useMemo<T>(factory: () => T, deps: any[]): T;

  export function useRef<T>(initialValue: T): { current: T };
  export function useRef<T>(initialValue: T | null): { current: T | null };

  const StrictMode: any;
  export { StrictMode };

  const Fragment: any;
  export { Fragment };

  export type FC<P = {}> = any;
  export type ComponentType<P = {}> = any;

  const React: any;
  export default React;
}

declare module "react/jsx-runtime" {
  export const jsx: any;
  export const jsxs: any;
  export const Fragment: any;
}
