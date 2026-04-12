function parseApiDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTime(value?: string | null) {
  const parsed = parseApiDate(value);
  if (!parsed) {
    return "Not available";
  }
  return parsed.toLocaleString();
}

export function formatDayDateTime(value?: string | null) {
  const date = parseApiDate(value);
  if (!date) {
    return "Not available";
  }
  const now = new Date();
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfNow.getTime() - startOfDate.getTime()) / 86400000);
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  if (diffDays === 0) {
    return `Today, ${time}`;
  }
  if (diffDays === 1) {
    return `Yesterday, ${time}`;
  }

  const weekday = date.toLocaleDateString([], { weekday: "long" });
  const shortDate = date.toLocaleDateString();
  return `${weekday}, ${shortDate} ${time}`;
}

export function formatPercent(value?: number | null) {
  if (value === undefined || value === null) {
    return "--";
  }
  return `${Math.round(value * 100)}%`;
}

export function formatConfidence(value?: number | null) {
  if (value === undefined || value === null) {
    return "--";
  }
  return value.toFixed(2);
}

export function formatDurationSince(startedAt?: string | null) {
  const startDate = parseApiDate(startedAt);
  if (!startDate) {
    return "00:00:00";
  }
  const diffMs = Date.now() - startDate.getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0")).join(":");
}

export function titleCase(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatWholeNumber(value?: number | null) {
  if (value === undefined || value === null) {
    return "--";
  }
  return new Intl.NumberFormat().format(Math.round(value));
}

export function formatTimeAgo(value?: string | null) {
  const parsed = parseApiDate(value);
  if (!parsed) {
    return "Not synced yet";
  }
  const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 1000));
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  return `${diffHours}h ago`;
}

export function displayNameFromEmail(email?: string | null) {
  if (!email) {
    return "Driver";
  }
  const [localPart] = email.split("@");
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function dateValueOf(value?: string | null) {
  return parseApiDate(value)?.getTime() ?? 0;
}
