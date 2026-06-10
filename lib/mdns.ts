// lib/mdns.ts
// mDNS discovery for LM Studio on the local network.
// LM Studio broadcasts as _lmstudio._tcp (port 1234) via Bonjour/mDNS.
// Falls back to _http._tcp scan if needed.

import { useEffect, useRef, useState } from "react";

export interface DiscoveredServer {
  name: string;      // e.g. "LM Studio on MacBook-Pro"
  host: string;      // hostname or IP
  port: number;      // usually 1234
  url: string;       // http://host:port/v1
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function loadZeroconf(): (new () => any) | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-zeroconf");
    const ZC = mod?.default ?? mod;
    if (typeof ZC !== "function") return null;
    return ZC;
  } catch {
    return null;
  }
}

export function useMDNSDiscovery(enabled: boolean) {
  const [servers, setServers] = useState<DiscoveredServer[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const zeroconfRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ZeroconfClass = useRef<(new () => any) | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Lazy-load on first use so a native init crash can't kill the whole app
    if (!ZeroconfClass.current) {
      ZeroconfClass.current = loadZeroconf();
    }
    const Zeroconf = ZeroconfClass.current;
    if (!Zeroconf) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let zc: any = null;
    try {
      zc = new Zeroconf();
    } catch {
      return;
    }
    if (!zc || typeof zc.scan !== "function") return;

    zeroconfRef.current = zc;
    setIsScanning(true);
    setServers([]);

    zc.on("resolved", (service: { name?: string; host?: string; port: number; addresses?: string[] }) => {
      const host = service.addresses?.[0] ?? service.host;
      if (!host) return;
      const url = `http://${host}:${service.port}/v1`;
      const discovered: DiscoveredServer = {
        name: service.name || "LM Studio",
        host,
        port: service.port,
        url,
      };
      setServers(prev => {
        if (prev.find(s => s.url === url)) return prev;
        return [...prev, discovered];
      });
    });

    zc.on("error", (_err: unknown) => {
      // Ignore mDNS errors silently — fallback to IP scan handles discovery
    });

    const scanTimers: ReturnType<typeof setTimeout>[] = [];

    // LM Studio service types to try (in order of specificity)
    try {
      zc.scan("lmstudio", "tcp", "local.");
    } catch {}
    scanTimers.push(
      setTimeout(() => {
        try {
          zc!.scan("lmstudio-server", "tcp", "local.");
        } catch {}
      }, 1000)
    );
    scanTimers.push(
      setTimeout(() => {
        try {
          zc!.scan("http", "tcp", "local.");
        } catch {}
      }, 2000)
    );

    return () => {
      for (const timer of scanTimers) clearTimeout(timer);
      try {
        zc!.stop();
      } catch {}
      setIsScanning(false);
    };
  }, [enabled]);

  const stop = () => {
    try { zeroconfRef.current?.stop(); } catch {}
    setIsScanning(false);
  };

  return { servers, isScanning, stop, available: !!ZeroconfClass.current || !!loadZeroconf() };
}

/** One-shot mDNS discovery (Bonjour) for LM Studio on the local network. */
export function discoverServersViaMDNS(timeoutMs = 4500): Promise<DiscoveredServer[]> {
  const Zeroconf = loadZeroconf();
  if (!Zeroconf) return Promise.resolve([]);

  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let zc: any;
    try {
      zc = new Zeroconf();
    } catch {
      resolve([]);
      return;
    }
    if (!zc || typeof zc.scan !== "function") {
      resolve([]);
      return;
    }

    const servers: DiscoveredServer[] = [];
    const seen = new Set<string>();

    const scanTimers: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      clearTimeout(timer);
      for (const scanTimer of scanTimers) clearTimeout(scanTimer);
      try {
        zc.stop();
      } catch {}
      resolve(servers);
    };

    const timer = setTimeout(finish, timeoutMs);

    zc.on(
      "resolved",
      (service: { name?: string; host?: string; port: number; addresses?: string[] }) => {
        const host = service.addresses?.[0] ?? service.host;
        if (!host) return;
        const url = `http://${host}:${service.port}/v1`;
        if (seen.has(url)) return;
        seen.add(url);
        servers.push({
          name: service.name || "LM Studio",
          host,
          port: service.port,
          url,
        });
      }
    );

    zc.on("error", () => {});

    try {
      zc.scan("lmstudio", "tcp", "local.");
    } catch {}
    scanTimers.push(
      setTimeout(() => {
        try {
          zc.scan("lmstudio-server", "tcp", "local.");
        } catch {}
      }, 800)
    );
    scanTimers.push(
      setTimeout(() => {
        try {
          zc.scan("http", "tcp", "local.");
        } catch {}
      }, 1600)
    );
  });
}
