export type EditableVersionValue = {
  manual_edit_content: string;
  saved_at: string | null;
};

function fromObject(raw: unknown): EditableVersionValue | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (typeof data.manual_edit_content !== "string") return null;
  return {
    manual_edit_content: data.manual_edit_content,
    saved_at: typeof data.saved_at === "string" ? data.saved_at : null
  };
}

function fromString(text: string): EditableVersionValue {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      manual_edit_content: "",
      saved_at: null
    };
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    const fromParsedObject = fromObject(parsed);
    if (fromParsedObject) {
      return fromParsedObject;
    }

    if (typeof parsed === "string") {
      // 兼容历史“JSON 字符串里再包一层字符串”的写法。
      return {
        manual_edit_content: parsed.trim(),
        saved_at: null
      };
    }
  } catch {
    // Keep backward compatibility for historical plain-text values.
  }

  return {
    manual_edit_content: trimmed,
    saved_at: null
  };
}

export function parseEditableVersion(raw: unknown) {
  const fromRawObject = fromObject(raw);
  if (fromRawObject) return fromRawObject;

  if (typeof raw === "string") {
    return fromString(raw);
  }

  return {
    manual_edit_content: "",
    saved_at: null
  };
}

export function buildEditableVersion(content: string): EditableVersionValue {
  return {
    manual_edit_content: content,
    saved_at: new Date().toISOString()
  };
}
