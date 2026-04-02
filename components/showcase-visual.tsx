type ShowcaseVisualProps = {
  title: string;
  category: string;
  imageUrl?: string | null;
  className?: string;
};

const visualThemes: Record<
  string,
  {
    label: string;
    background: string;
    foreground: string;
    accent: string;
    accentSecondary: string;
    accentTertiary: string;
  }
> = {
  "城市文创": {
    label: "城",
    background: "from-[#f8f7f3] via-[#f3f1eb] to-[#ece9e1]",
    foreground: "#1f2937",
    accent: "#d97706",
    accentSecondary: "#e8dcc7",
    accentTertiary: "#f6efe1"
  },
  "高校主题": {
    label: "校",
    background: "from-[#f8f7fa] via-[#f2eef8] to-[#ebe7f4]",
    foreground: "#111827",
    accent: "#7c3aed",
    accentSecondary: "#ddd6f3",
    accentTertiary: "#f2effc"
  },
  "文博纪念": {
    label: "博",
    background: "from-[#f5f8f2] via-[#edf4ea] to-[#e6eee1]",
    foreground: "#0f172a",
    accent: "#15803d",
    accentSecondary: "#dcead7",
    accentTertiary: "#eef6eb"
  },
  "家庭场景": {
    label: "家",
    background: "from-[#f4f8fb] via-[#edf3f9] to-[#e6eef6]",
    foreground: "#1e293b",
    accent: "#0284c7",
    accentSecondary: "#d8e9f4",
    accentTertiary: "#edf6fb"
  },
  "奇幻场景": {
    label: "幻",
    background: "from-[#f8f4fb] via-[#f2eef8] to-[#ebe7f1]",
    foreground: "#111827",
    accent: "#9333ea",
    accentSecondary: "#e4d8f4",
    accentTertiary: "#f3ecfb"
  },
  "机械载具": {
    label: "机",
    background: "from-[#f4f6f8] via-[#edf1f4] to-[#e6eaee]",
    foreground: "#0f172a",
    accent: "#475569",
    accentSecondary: "#d7dde4",
    accentTertiary: "#eef2f6"
  }
};

function resolveTheme(category: string) {
  return (
    visualThemes[category] || {
      label: "玩",
      background: "from-[#f8f7f3] via-[#f1f2f4] to-[#eceff3]",
      foreground: "#111827",
      accent: "#d97706",
      accentSecondary: "#dde3ea",
      accentTertiary: "#f4f6f8"
    }
  );
}

export default function ShowcaseVisual({ title, category, imageUrl, className = "" }: ShowcaseVisualProps) {
  const theme = resolveTheme(category);

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br ${theme.background} ${className}`}>
      {imageUrl ? (
        // Real project covers use dynamic signed URLs, so keep a plain img here.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
      ) : (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,255,255,0.88),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.18),rgba(15,23,42,0.02))]" />
          <div className="absolute inset-0 opacity-[0.08]" style={{
            backgroundImage:
              "radial-gradient(circle at 10px 10px, rgba(15,23,42,0.48) 0, rgba(15,23,42,0.48) 2px, transparent 2.5px)"
          }} />
          <svg
            viewBox="0 0 480 320"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid slice"
          >
            <rect x="20" y="18" width="440" height="284" rx="40" fill="white" fillOpacity="0.2" />
            <rect x="34" y="32" width="412" height="256" rx="36" fill="white" fillOpacity="0.16" />
            <circle cx="390" cy="84" r="70" fill={theme.accentSecondary} fillOpacity="0.9" />
            <rect x="208" y="60" width="168" height="16" rx="8" fill="white" fillOpacity="0.88" />
            <rect x="208" y="88" width="148" height="12" rx="6" fill="white" fillOpacity="0.68" />
            <rect x="208" y="112" width="110" height="12" rx="6" fill="white" fillOpacity="0.5" />
            <rect x="44" y="176" width="156" height="112" rx="34" fill={theme.accentSecondary} fillOpacity="0.96" />
            <rect x="44" y="170" width="156" height="16" rx="8" fill={theme.accent} fillOpacity="0.34" />
            <circle cx="78" cy="192" r="10" fill="white" fillOpacity="0.96" />
            <circle cx="112" cy="192" r="10" fill="white" fillOpacity="0.96" />
            <circle cx="146" cy="192" r="10" fill="white" fillOpacity="0.96" />
            <rect x="216" y="194" width="82" height="66" rx="22" fill={theme.accentTertiary} fillOpacity="0.96" />
            <rect x="308" y="194" width="110" height="66" rx="22" fill="white" fillOpacity="0.82" />
            <circle cx="242" cy="210" r="10" fill="white" fillOpacity="0.9" />
            <circle cx="276" cy="210" r="10" fill="white" fillOpacity="0.9" />
            <rect x="58" y="58" width="102" height="102" rx="28" fill="white" fillOpacity="0.98" />
            <rect x="48" y="46" width="382" height="230" rx="34" fill="none" stroke="white" strokeOpacity="0.25" />
            <text
              x="109"
              y="128"
              textAnchor="middle"
              fontSize="56"
              fontWeight="600"
              fill={theme.foreground}
              fontFamily="'Iowan Old Style', 'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', serif"
            >
              {theme.label}
            </text>
            <rect x="236" y="156" width="124" height="10" rx="5" fill="white" fillOpacity="0.34" />
            <rect x="270" y="174" width="88" height="8" rx="4" fill="white" fillOpacity="0.24" />
            <path
              d="M34 256C108 212 152 212 192 224C230 236 262 252 312 248C360 244 404 224 446 194V286H34V256Z"
              fill="url(#shadowWash)"
              fillOpacity="0.74"
            />
            <defs>
              <linearGradient id="shadowWash" x1="240" y1="196" x2="240" y2="286" gradientUnits="userSpaceOnUse">
                <stop stopColor={theme.foreground} stopOpacity="0" />
                <stop offset="1" stopColor={theme.foreground} stopOpacity="0.18" />
              </linearGradient>
            </defs>
          </svg>
        </>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/34 via-slate-950/8 to-white/8" />
      <div className="absolute inset-0 shadow-[inset_0_-56px_92px_rgba(15,23,42,0.22)]" />
    </div>
  );
}
