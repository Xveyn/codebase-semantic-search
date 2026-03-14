export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function groupBy<T>(items: T[], key: keyof T): Record<string, T[]> {
  return items.reduce(
    (groups, item) => {
      const groupKey = String(item[key]);
      (groups[groupKey] ||= []).push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

export function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delay: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const attempt = async () => {
      try {
        resolve(await fn());
      } catch (error) {
        attempts++;
        if (attempts >= maxAttempts) {
          reject(error);
        } else {
          setTimeout(attempt, delay);
        }
      }
    };
    attempt();
  });
}
