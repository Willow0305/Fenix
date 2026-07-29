export function readCookies(cookieHeader: string | undefined): Readonly<Record<string, string>> {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader.split(';').flatMap((part) => {
      const separatorIndex = part.indexOf('=');

      if (separatorIndex < 1) {
        return [];
      }

      const name = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();

      try {
        return [[name, decodeURIComponent(value)]];
      } catch {
        return [];
      }
    })
  );
}
