/**
 * The tiny translation function shared by server and client. Given a messages
 * object (nested), returns t(key, vars):
 *   t("home.ethos.title")
 *   t("footer.copyright", { year: 2026 })
 * Missing keys return the key itself (visible in dev, harmless in prod).
 */
export type Messages = Record<string, unknown>;

function lookup(messages: Messages, key: string): unknown {
  return key.split(".").reduce<unknown>((node, part) => {
    if (node && typeof node === "object") {
      return (node as Record<string, unknown>)[part];
    }
    return undefined;
  }, messages);
}

export type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function createTranslator(messages: Messages): TFunction {
  return (key, vars) => {
    const value = lookup(messages, key);
    let str = typeof value === "string" ? value : key;
    if (vars) {
      for (const [name, v] of Object.entries(vars)) {
        str = str.replaceAll(`{${name}}`, String(v));
      }
    }
    return str;
  };
}
