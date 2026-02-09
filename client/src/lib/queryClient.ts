import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getCachedSession } from "./session-cache";

// Stale time constants by category (ms)
export const STALE_TIMES = {
  auth: 5 * 60 * 1000,       // 5 min
  userSettings: 10 * 60 * 1000, // 10 min
  dynamic: 2 * 60 * 1000,     // 2 min (leaderboard, etc.)
  catalog: 15 * 60 * 1000,    // 15 min (shop items, etc.)
  admin: 1 * 60 * 1000,       // 1 min
} as const;

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getCachedSession();
  if (session?.access_token) {
    return { "Authorization": `Bearer ${session.access_token}` };
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders };
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
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
    const authHeaders = await getAuthHeaders();
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
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
      staleTime: STALE_TIMES.auth,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
