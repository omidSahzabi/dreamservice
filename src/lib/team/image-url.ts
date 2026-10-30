function controlCharacters(value: string): boolean {
  return [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);
}

function unsafeCharacters(value: string): boolean {
  return /[\s\\]/.test(value) || controlCharacters(value);
}

export function publicTeamImageUrl(value: string): string | null {
  if (unsafeCharacters(value)) return null;

  if (value.startsWith('/images/')) {
    try {
      const decoded = decodeURIComponent(value);
      if (unsafeCharacters(decoded) || /[?#%]/.test(decoded) || /%2f|%5c/i.test(value)) return null;
      if (decoded.split('/').slice(1).some(segment => !segment || segment === '.' || segment === '..')) return null;
      return value;
    } catch {
      return null;
    }
  }

  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const decoded = decodeURIComponent(value);
    if (controlCharacters(decoded) || decoded.includes('\\')) return null;
    const url = new URL(value);
    return url.hostname && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
