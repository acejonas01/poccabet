"use client";
// react-router-dom, as far as the shared screens use it, on top of Next.js routing.
// next.config.ts points "react-router-dom" here for this site only.
import { Children, createContext, isValidElement, useContext, useEffect, type AnchorHTMLAttributes, type ReactElement, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams as useNextSearchParams } from "next/navigation";

type To = string | number | { pathname?: string; search?: string };

export function useNavigate() {
  const router = useRouter();
  return (to: To, opts?: { replace?: boolean }) => {
    if (typeof to === "number") return to < 0 ? router.back() : router.forward();
    const url = typeof to === "string" ? to : `${to.pathname ?? window.location.pathname}${to.search ?? ""}`;
    if (opts?.replace) router.replace(url);
    else router.push(url);
  };
}

export function useLocation() {
  const pathname = usePathname() || "/";
  const params = useNextSearchParams();
  const search = params && params.toString() ? `?${params.toString()}` : "";
  return { pathname, search, hash: "", state: null, key: "default" };
}

export function useSearchParams() {
  const params = useNextSearchParams();
  return [new URLSearchParams(params ? params.toString() : ""), () => {}] as const;
}

// <Routes>/<Route>: the first route whose pattern ("/league/:slug") matches the path renders,
// and its :params are what useParams() returns below it.
const ParamsContext = createContext<Record<string, string>>({});
export const useParams = <T extends Record<string, string | undefined> = Record<string, string | undefined>>() => useContext(ParamsContext) as T;

function match(pattern: string, pathname: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean);
  const b = pathname.split("/").filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function Routes({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "/";
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const { path, element } = (child as ReactElement<{ path: string; element: ReactNode }>).props;
    const params = match(path, pathname);
    if (params) return <ParamsContext.Provider value={params}>{element}</ParamsContext.Provider>;
  }
  return null;
}

export function Route(_: { path: string; element: ReactNode }) {
  return null; // read by <Routes>
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  const navigate = useNavigate();
  useEffect(() => { navigate(to, { replace }); }, [to]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function Link({ to, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const navigate = useNavigate();
  return <a href={to} {...rest} onClick={(e) => { rest.onClick?.(e); if (!e.defaultPrevented) { e.preventDefault(); navigate(to); } }} />;
}

export const BrowserRouter = ({ children }: { children: ReactNode }) => <>{children}</>;
