interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const defaultTTL = 120000;

const cache = new Map<string, CacheEntry<any>>();
const inflight = new Map<string, Promise<any>>();

export class DataCache {
  static get<T>(key: string): T | null {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  static set<T>(key: string, data: T, ttl: number = defaultTTL): void {
    cache.set(key, { data, timestamp: Date.now(), ttl });
  }

  static invalidate(prefix?: string): void {
    if (!prefix) {
      cache.clear();
      return;
    }
    for (const key of cache.keys()) {
      if (key.startsWith(prefix)) {
        cache.delete(key);
      }
    }
  }

  static async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttl: number = defaultTTL): Promise<T> {
    const entry = cache.get(key);
    if (entry) {
      const age = Date.now() - entry.timestamp;
      if (age < entry.ttl) {
        if (age > entry.ttl * 0.5 && !inflight.has(key)) {
          const promise = fetcher().then(data => {
            this.set(key, data, ttl);
            inflight.delete(key);
            return data;
          }).catch(() => {
            inflight.delete(key);
          });
          inflight.set(key, promise);
        }
        return entry.data as T;
      }
      cache.delete(key);
    }

    const pending = inflight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = fetcher().then(data => {
      this.set(key, data, ttl);
      inflight.delete(key);
      return data;
    }).catch(err => {
      inflight.delete(key);
      throw err;
    });

    inflight.set(key, promise);
    return promise;
  }
}
