import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

function getFallbackHeaders() {
  try {
    const uid = localStorage.getItem('PRISMX_USER_ID') || localStorage.getItem('x-user-id');
    return uid ? { 'x-user-id': uid } : {};
  } catch {
    return {};
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { ...(data ? { "Content-Type": "application/json" } : {}), ...getFallbackHeaders() },
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
    const url = queryKey.join("/") as string;
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
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
