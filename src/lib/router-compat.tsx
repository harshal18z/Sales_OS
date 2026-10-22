import React, { useMemo } from "react";
import {
  Link as RRLink,
  NavLink as RRNavLink,
  useNavigate as useRRNavigate,
  useLocation as useRRLocation,
  useParams as useRRParams,
  useSearchParams as useRRSearchParams,
  Outlet as RROutlet,
  type LinkProps as RRLinkProps,
  type NavigateOptions,
} from "react-router-dom";

export { RROutlet as Outlet };

// Wrapper for Link that supports TanStack Router's `to` strings or objects
export const Link = React.forwardRef<HTMLAnchorElement, any>(function Link(
  { to, search, params, ...props },
  ref,
) {
  let targetTo = to;
  if (typeof to === "string" && params) {
    for (const [k, v] of Object.entries(params)) {
      targetTo = targetTo.replace(`$${k}`, String(v)).replace(`:${k}`, String(v));
    }
  }
  if (search && typeof search === "object") {
    const sp = new URLSearchParams(search).toString();
    if (sp) {
      targetTo = `${targetTo}?${sp}`;
    }
  }
  return <RRLink ref={ref} to={targetTo} {...props} />;
});

// Wrapper for useNavigate that supports both `navigate('/path')` and `navigate({ to: '/path', replace: true })`
export function useNavigate() {
  const rrNavigate = useRRNavigate();

  return (
    toOrOptions:
      | string
      | number
      | {
          to: string;
          replace?: boolean;
          search?: Record<string, any>;
          params?: Record<string, any>;
        },
    maybeOptions?: NavigateOptions,
  ) => {
    if (typeof toOrOptions === "object" && toOrOptions !== null && "to" in toOrOptions) {
      let dest = toOrOptions.to;
      if (toOrOptions.params) {
        for (const [k, v] of Object.entries(toOrOptions.params)) {
          dest = dest.replace(`$${k}`, String(v)).replace(`:${k}`, String(v));
        }
      }
      if (toOrOptions.search && typeof toOrOptions.search === "object") {
        const sp = new URLSearchParams(toOrOptions.search).toString();
        if (sp) dest = `${dest}?${sp}`;
      }
      return rrNavigate(dest, { replace: toOrOptions.replace });
    }
    return rrNavigate(toOrOptions as any, maybeOptions);
  };
}

export function useLocation() {
  return useRRLocation();
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  return useRRParams() as T;
}

export function useSearch<T = Record<string, string>>(): T {
  const [searchParams] = useRRSearchParams();
  return useMemo(() => {
    return Object.fromEntries(searchParams.entries()) as unknown as T;
  }, [searchParams]);
}

export function useRouterState<T = any>(opts?: {
  select?: (state: { location: { pathname: string; search: string } }) => T;
}): T {
  const location = useRRLocation();
  const state = useMemo(
    () => ({
      location: {
        pathname: location.pathname,
        search: location.search,
      },
    }),
    [location],
  );

  if (opts?.select) {
    return opts.select(state);
  }
  return state as unknown as T;
}

export function useRouter() {
  const navigate = useNavigate();
  return {
    navigate,
    invalidate: () => {},
  };
}

export function redirect(opts: { to: string; search?: any }) {
  let target = opts.to;
  if (opts.search && typeof opts.search === "object") {
    const sp = new URLSearchParams(opts.search).toString();
    if (sp) target = `${target}?${sp}`;
  }
  return { redirect: true, to: target };
}

// Emulate createFileRoute
export function createFileRoute(_path: string) {
  return (options: any = {}) => {
    const routeObj = {
      ...options,
      useParams: () => useRRParams(),
      useSearch: () => {
        const [searchParams] = useRRSearchParams();
        return Object.fromEntries(searchParams.entries());
      },
    };
    return routeObj;
  };
}
