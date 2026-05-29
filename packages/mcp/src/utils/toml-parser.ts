/**
 * Minimal TOML parser for bmad-method customize.toml files.
 * Handles sections ([section]), key=value, arrays, and arrays-of-tables.
 */

interface TomlSection {
  [key: string]: TomlValue;
}

type TomlValue = string | string[] | TomlSection[] | TomlSection;

interface TomlDocument {
  [section: string]: TomlValue;
}

export function parseSimpleToml(content: string): TomlDocument {
  const lines = content.split('\n');
  const doc: TomlDocument = {};
  let currentSection: TomlSection = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === '' || line.startsWith('#')) continue;

    // Array of tables: [[section]]
    const arrayTableMatch = line.match(/^\[\[(.+)\]\]$/);
    if (arrayTableMatch) {
      const name = arrayTableMatch[1].trim();
      const existing = doc[name];
      const arr: TomlSection[] = Array.isArray(existing) ? (existing as TomlSection[]) : [];
      const item: TomlSection = {};
      arr.push(item);
      doc[name] = arr;
      currentSection = item;
      continue;
    }

    // Section: [section]
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      const name = sectionMatch[1].trim();
      let existing = doc[name];
      if (Array.isArray(existing)) {
        // Already an array of tables, don't overwrite
        currentSection = {};
      } else if (typeof existing === 'object' && existing !== null) {
        currentSection = existing as TomlSection;
      } else {
        currentSection = {};
        doc[name] = currentSection;
      }
      continue;
    }

    // Key = value
    const kvMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const rawValue = kvMatch[2].trim();

      if (rawValue === '[]') {
        currentSection[key] = [];
      } else if (rawValue.startsWith('[')) {
        // Parse inline TOML array
        const arrayContent = rawValue.slice(1, -1);
        const items: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < arrayContent.length; i++) {
          const ch = arrayContent[i];
          if (ch === '"') {
            inQuotes = !inQuotes;
            current += ch;
          } else if (ch === ',' && !inQuotes) {
            items.push(current.trim().replace(/^"(.*)"$/, '$1'));
            current = '';
          } else {
            current += ch;
          }
        }
        if (current.trim()) {
          items.push(current.trim().replace(/^"(.*)"$/, '$1'));
        }
        currentSection[key] = items;
      } else {
        // String value (strip surrounding quotes)
        let val = rawValue;
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        currentSection[key] = val;
      }
    }
  }

  return doc;
}

export function getTomlSection(doc: TomlDocument, section: string): TomlSection {
  const s = doc[section];
  if (Array.isArray(s)) return {};
  if (s && typeof s === 'object') return s as TomlSection;
  return {};
}

export function getTomlString(section: TomlSection, key: string, fallback = ''): string {
  const val = section[key];
  if (typeof val === 'string') return val;
  return fallback;
}

export function getTomlStringArray(section: TomlSection, key: string): string[] {
  const val = section[key];
  if (Array.isArray(val)) return val.filter((v): v is string => typeof v === 'string');
  return [];
}

export function getTomlTableArray(doc: TomlDocument, section: string): TomlSection[] {
  const val = doc[section];
  if (Array.isArray(val)) return val.filter((v): v is TomlSection => typeof v === 'object' && !Array.isArray(v));
  return [];
}
