import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getFallbackHeaders(): Record<string, string> {
  try {
    const uid = localStorage.getItem('PRISMX_USER_ID') || localStorage.getItem('x-user-id');
    return uid ? { 'x-user-id': uid } : {} as Record<string, string>;
  } catch {
    return {} as Record<string, string>;
  }
}

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const cookie = document.cookie || '';
  const parts = cookie.split(';').map(c => c.trim());
  for (const p of parts) {
    if (p.startsWith('XSRF-TOKEN=')) return decodeURIComponent(p.slice('XSRF-TOKEN='.length));
  }
  return undefined;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const csrf = method === 'GET' ? undefined : getCsrfToken();
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (csrf) headers['x-csrf-token'] = csrf;
  Object.assign(headers, getFallbackHeaders());
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let base = String(queryKey[0] || "");
    let url = base;

    const params = queryKey[1];
    if (typeof params === "string") {
      url = params.startsWith("?") ? `${base}${params}` : `${base}?${params}`;
    } else if (params && typeof params === "object") {
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(params as Record<string, unknown>)) {
        if (v === undefined || v === null) continue;
        usp.append(k, String(v));
      }
      const qs = usp.toString();
      if (qs) url = `${base}?${qs}`;
    }

    let res = await fetch(url, { credentials: "include", headers: getFallbackHeaders() });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    if (!res.ok && res.status === 401) {
      try {
        // try open-access fallback with demo id
        localStorage.setItem('PRISMX_USER_ID', 'demo-user');
        localStorage.setItem('x-user-id', 'demo-user');
      } catch {}
      res = await fetch(url, { credentials: "include", headers: getFallbackHeaders() });
    }
    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      gcTime: 1000 * 60 * 30,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
