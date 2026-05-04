import { useForm } from "@inertiajs/react";
import { useState, useEffect, useRef } from "react";

// ─── Breakpoint Hook ──────────────────────────────────────────────────────────

function useBreakpoint() {
    const getBreakpoint = () => {
        const w = window.innerWidth;
        if (w < 640)  return "mobile";
        if (w < 1024) return "tablet";
        return "desktop";
    };
    const [bp, setBp] = useState(() => (typeof window !== "undefined" ? getBreakpoint() : "desktop"));
    useEffect(() => {
        const handler = () => setBp(getBreakpoint());
        window.addEventListener("resize", handler);
        return () => window.removeEventListener("resize", handler);
    }, []);
    return bp;
}

// ─── Validation Constants ─────────────────────────────────────────────────────

const MAX_LINES = 300;
const MAX_CHARS = 10000;

function isOverLimit(value) {
    if (!value) return false;
    return value.split("\n").length > MAX_LINES || value.length > MAX_CHARS;
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

function tokenize(code) {
    const tokens = [];
    let i = 0;

    const KEYWORDS = /^(function|const|let|var|return|if|else|for|while|class|new|import|export|default|from|of|in|typeof|instanceof|throw|try|catch|finally|async|await|public|protected|private|static|void|null|undefined|true|false|this|super|extends|implements|interface|type|namespace|enum|abstract|readonly|override|declare|require|module)(?=\W|$)/;
    const PHP_KEYWORDS = /^(function|class|return|if|else|foreach|for|while|echo|new|use|namespace|public|protected|private|static|abstract|interface|extends|implements|true|false|null|void|readonly|match|throw|try|catch|finally|yield|fn)(?=\W|$)/;

    while (i < code.length) {
        const remaining = code.slice(i);

        if (remaining.startsWith("//")) {
            const end = remaining.indexOf("\n");
            const len = end === -1 ? remaining.length : end;
            tokens.push({ type: "comment", value: remaining.slice(0, len) });
            i += len; continue;
        }
        if (remaining.startsWith("#") && (i === 0 || code[i - 1] === "\n")) {
            const end = remaining.indexOf("\n");
            const len = end === -1 ? remaining.length : end;
            tokens.push({ type: "comment", value: remaining.slice(0, len) });
            i += len; continue;
        }
        if (remaining.startsWith("/*")) {
            const end = remaining.indexOf("*/");
            const len = end === -1 ? remaining.length : end + 2;
            tokens.push({ type: "comment", value: remaining.slice(0, len) });
            i += len; continue;
        }
        if (remaining[0] === "`") {
            let j = 1;
            while (j < remaining.length && remaining[j] !== "`") { if (remaining[j] === "\\") j++; j++; }
            tokens.push({ type: "string", value: remaining.slice(0, j + 1) });
            i += j + 1; continue;
        }
        if (remaining[0] === '"' || remaining[0] === "'") {
            const q = remaining[0]; let j = 1;
            while (j < remaining.length && remaining[j] !== q) { if (remaining[j] === "\\") j++; j++; }
            tokens.push({ type: "string", value: remaining.slice(0, j + 1) });
            i += j + 1; continue;
        }
        if (/^[0-9]/.test(remaining)) {
            const match = remaining.match(/^[0-9]+(\.[0-9]+)?/);
            tokens.push({ type: "number", value: match[0] });
            i += match[0].length; continue;
        }
        if (remaining[0] === "$") {
            const match = remaining.match(/^\$[a-zA-Z_][a-zA-Z0-9_]*/);
            if (match) { tokens.push({ type: "variable", value: match[0] }); i += match[0].length; continue; }
        }
        if (/^[a-zA-Z_]/.test(remaining)) {
            const kwMatch = remaining.match(KEYWORDS) || remaining.match(PHP_KEYWORDS);
            if (kwMatch) { tokens.push({ type: "keyword", value: kwMatch[0] }); i += kwMatch[0].length; continue; }
            const fnMatch = remaining.match(/^([a-zA-Z_][a-zA-Z0-9_]*)(?=\s*\()/);
            if (fnMatch) { tokens.push({ type: "function", value: fnMatch[1] }); i += fnMatch[1].length; continue; }
            const idMatch = remaining.match(/^[a-zA-Z_][a-zA-Z0-9_]*/);
            tokens.push({ type: "identifier", value: idMatch[0] });
            i += idMatch[0].length; continue;
        }
        tokens.push({ type: "punct", value: remaining[0] });
        i++;
    }

    return tokens;
}

const TOKEN_COLORS = {
    keyword:    "#c792ea",
    string:     "#c3e88d",
    comment:    "#546e7a",
    number:     "#f78c6c",
    function:   "#82aaff",
    variable:   "#eeffff",
    identifier: "#b8c0d4",
    punct:      "#89ddff",
};

// ─── Highlighted Code Layer ───────────────────────────────────────────────────

function HighlightedCode({ code }) {
    const lines = (code + "\n").split("\n");
    return (
        <div aria-hidden="true" style={{ fontFamily: "'DM Mono', 'Fira Code', monospace", fontSize: "12px", lineHeight: "1.75", pointerEvents: "none" }}>
            {lines.map((line, lineIdx) => (
                <div key={lineIdx} style={{ whiteSpace: "pre", minHeight: "1.75em" }}>
                    {tokenize(line).map((tok, tokIdx) => (
                        <span key={tokIdx} style={{ color: TOKEN_COLORS[tok.type] || "#b8c0d4" }}>
                            {tok.value}
                        </span>
                    ))}
                </div>
            ))}
        </div>
    );
}

// ─── Editor Pane ──────────────────────────────────────────────────────────────

function EditorPane({ value, onChange, placeholder }) {
    const textareaRef = useRef(null);
    const highlightRef = useRef(null);
    const lineNumRef = useRef(null);

    const lines = value ? value.split("\n").length : 1;
    const chars = value ? value.length : 0;

    const linesOver = lines > MAX_LINES;
    const charsOver = chars > MAX_CHARS;
    const counterRed = linesOver || charsOver;
    const counterAmber = !counterRed && (lines > MAX_LINES * 0.85 || chars > MAX_CHARS * 0.85);

    const syncScroll = () => {
        if (!textareaRef.current) return;
        const { scrollTop, scrollLeft } = textareaRef.current;
        if (highlightRef.current) { highlightRef.current.scrollTop = scrollTop; highlightRef.current.scrollLeft = scrollLeft; }
        if (lineNumRef.current)   { lineNumRef.current.scrollTop = scrollTop; }
    };

    const EDITOR_STYLE = {
        fontFamily: "'DM Mono', 'Fira Code', monospace",
        fontSize: "12px",
        lineHeight: "1.75",
        padding: "12px",
        whiteSpace: "pre",
        overflowWrap: "normal",
        wordBreak: "normal",
    };

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
                <span style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: counterRed ? "#f87171" : counterAmber ? "#fb923c" : "#c4c9d8",
                    transition: "color 0.2s",
                    userSelect: "none",
                }}>
                    {lines}/{MAX_LINES} lines
                </span>
            </div>
            <div style={{
                display: "flex", borderRadius: "10px", overflow: "hidden", flex: 1, minHeight: 0,
                background: "#0f1117",
                border: `1px solid ${counterRed ? "rgba(248,113,113,0.5)" : "#2a2e3f"}`,
                transition: "border-color 0.2s",
            }}>
                <div
                    ref={lineNumRef}
                    style={{
                        width: "44px", flexShrink: 0, paddingTop: "12px",
                        textAlign: "right", fontFamily: "'DM Mono', monospace",
                        fontSize: "12px", lineHeight: "1.75", color: "#3a3f55",
                        background: "#0d1016", overflowY: "hidden", overflowX: "hidden", userSelect: "none",
                    }}
                >
                    {Array.from({ length: Math.max(lines, 1) }, (_, i) => (
                        <div key={i} style={{ paddingRight: "10px" }}>{i + 1}</div>
                    ))}
                </div>
                <div style={{ position: "relative", flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div
                        ref={highlightRef}
                        style={{ ...EDITOR_STYLE, color: "transparent", position: "absolute", inset: 0, overflow: "auto", pointerEvents: "none" }}
                    >
                        <HighlightedCode code={value || ""} />
                    </div>
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onScroll={syncScroll}
                        placeholder={placeholder}
                        spellCheck={false}
                        style={{
                            ...EDITOR_STYLE,
                            position: "absolute", inset: 0,
                            width: "100%", height: "100%",
                            resize: "none", outline: "none", border: "none",
                            background: "transparent", color: "transparent",
                            caretColor: "#e8edf2", overflow: "auto", zIndex: 1,
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────

function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <button
            onClick={handleCopy}
            style={{
                fontSize: "12px", fontWeight: 600,
                color: copied ? "#00d4a4" : "#6b7394",
                background: "#1e2235", border: "1px solid #2a2e3f",
                borderRadius: "6px", padding: "4px 10px",
                cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s",
            }}
        >
            {copied ? "Copied!" : "Copy"}
        </button>
    );
}

// ─── Kebab Menu ───────────────────────────────────────────────────────────────

function KebabMenu({ onPdf, onTxt }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    return (
        <div ref={ref} style={{ position: "relative" }}>
            <button
                onClick={() => setOpen((o) => !o)}
                style={{
                    width: "26px", height: "26px", borderRadius: "6px",
                    background: "#1e2235", border: "1px solid #2a2e3f",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "2px",
                }}
            >
                {[0, 1, 2].map((i) => (
                    <span key={i} style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#6b7394", display: "block" }} />
                ))}
            </button>
            {open && (
                <div style={{
                    position: "absolute", top: "30px", right: 0,
                    background: "#1e2235", border: "1px solid #2a2e3f",
                    borderRadius: "8px", overflow: "hidden", zIndex: 10,
                    minWidth: "110px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                }}>
                    {[
                        { label: "↓ PDF", action: () => { onPdf(); setOpen(false); } },
                        { label: "↓ TXT", action: () => { onTxt(); setOpen(false); } },
                    ].map(({ label, action }) => (
                        <button
                            key={label}
                            onClick={action}
                            style={{
                                display: "block", width: "100%", padding: "8px 14px",
                                fontSize: "13px", color: "#b8c0d4", background: "none",
                                border: "none", textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = "#252940"; e.currentTarget.style.color = "#e8edf2"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#b8c0d4"; }}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Download Helpers ─────────────────────────────────────────────────────────

function downloadTxt(content, filename) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

function downloadPdf(content, title) {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
        body { font-family: 'Georgia', serif; font-size: 14px; line-height: 1.8; color: #1a1a1a; max-width: 720px; margin: 48px auto; padding: 0 32px; }
        h1 { font-size: 20px; font-weight: 700; margin-bottom: 24px; padding-bottom: 12px; border-bottom: 2px solid #00d4a4; color: #00d4a4; letter-spacing: -0.02em; }
        pre { white-space: pre-wrap; word-break: break-word; font-family: monospace; font-size: 13px; line-height: 1.7; background: #f4f4f4; border: 1px solid #e0e0e0; border-radius: 6px; padding: 20px; }
        @media print { body { margin: 24px; } }
    </style></head><body>
        <h1>${title}</h1>
        <pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
    </body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.focus(); printWindow.print(); printWindow.close(); };
}

// ─── Output Block ─────────────────────────────────────────────────────────────

function OutputBlock({ label, content, onContentChange, placeholder, filename = "output", flex: flexGrow = false, fixedHeight, className = "" }) {
    const isEmpty = !content || content.trim() === "";

    return (
        <div
            className={className}
            style={flexGrow ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: "12px" } : { height: fixedHeight, flexShrink: 0, display: "flex", flexDirection: "column", gap: "12px" }}
        >
            <p style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff", margin: 0, flexShrink: 0 }}>
                {label}
            </p>
            <div style={{
                background: "#13161e", border: "1px solid #2a2e3f", borderRadius: "12px",
                overflow: "hidden", display: "flex", flexDirection: "column",
                flex: flexGrow ? 1 : undefined,
                height: fixedHeight ? "calc(100% - 28px)" : undefined,
                minHeight: 0,
            }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", padding: "10px 16px", flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <CopyButton text={content} />
                        <KebabMenu
                            onPdf={() => downloadPdf(content, label)}
                            onTxt={() => downloadTxt(content, `${filename}.txt`)}
                        />
                    </div>
                </div>
                {isEmpty ? (
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80px" }}>
                        <p style={{ fontSize: "14px", color: "#3a3f55" }}>{placeholder}</p>
                    </div>
                ) : (
                    <textarea
                        value={content}
                        onChange={(e) => onContentChange(e.target.value)}
                        spellCheck={false}
                        style={{
                            flex: 1, width: "100%", padding: "0 16px 16px",
                            background: "transparent", color: "#ffffff",
                            fontSize: "13.5px", lineHeight: "1.75", fontFamily: "inherit",
                            resize: "none", outline: "none", border: "none",
                            boxSizing: "border-box", minHeight: 0,
                        }}
                    />
                )}
            </div>
        </div>
    );
}

// ─── Visual Diff ──────────────────────────────────────────────────────────────

function computeDiff(oldText, newText) {
    const oldLines = oldText ? oldText.split("\n") : [];
    const newLines = newText ? newText.split("\n") : [];
    const m = oldLines.length, n = newLines.length;

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--)
        for (let j = n - 1; j >= 0; j--)
            dp[i][j] = oldLines[i] === newLines[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);

    const raw = [];
    let i = 0, j = 0;
    while (i < m || j < n) {
        if (i < m && j < n && oldLines[i] === newLines[j]) {
            raw.push({ type: "equal", oldText: oldLines[i], newText: newLines[j] }); i++; j++;
        } else if (j < n && (i >= m || dp[i][j + 1] >= dp[i + 1][j])) {
            raw.push({ type: "add", oldText: null, newText: newLines[j] }); j++;
        } else {
            raw.push({ type: "remove", oldText: oldLines[i], newText: null }); i++;
        }
    }

    const paired = [];
    let k = 0;
    while (k < raw.length) {
        if (raw[k].type === "remove" && k + 1 < raw.length && raw[k + 1].type === "add") {
            paired.push({ type: "change", oldText: raw[k].oldText, newText: raw[k + 1].newText }); k += 2;
        } else {
            paired.push(raw[k]); k++;
        }
    }
    return paired;
}

function DiffPane({ lines, side, scrollRef, onScroll }) {
    const MONO = "'DM Mono', 'Fira Code', monospace";
    const LINE_H = 21;
    const GUTTER_W = 52;
    const isOld = side === "old";

    return (
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{
                padding: "6px 12px", fontSize: "0.8rem", fontWeight: 1000,
                letterSpacing: "0.1em", textTransform: "uppercase",
                color: isOld ? "#e06c75" : "#4ec994",
                background: isOld ? "rgba(224,108,117,0.08)" : "rgba(78,201,148,0.08)",
                borderBottom: `1px solid ${isOld ? "rgba(224,108,117,0.2)" : "rgba(78,201,148,0.2)"}`,
                flexShrink: 0, userSelect: "none",
            }}>
                {isOld ? "− Original" : "+ Modified"}
            </div>

            {/* Single scroll container — gutter is sticky so it never desyncs */}
            <div ref={scrollRef} onScroll={onScroll} style={{ flex: 1, overflowY: "auto", overflowX: "auto", minHeight: 0, background: "#0f1117", position: "relative" }}>
                <div style={{ display: "inline-block", minWidth: "100%" }}>
                {lines.map((row, idx) => {
                    const text     = isOld ? row.oldText : row.newText;
                    const isActive = isOld ? (row.type === "remove" || row.type === "change") : (row.type === "add" || row.type === "change");
                    const isEmpty  = text === null;
                    const activeBg = isOld ? "rgba(200,60,60,0.18)" : "rgba(40,180,100,0.15)";
                    const gutterActiveBg = isOld ? "rgba(200,60,60,0.25)" : "rgba(40,180,100,0.22)";
                    return (
                        <div key={idx} style={{
                            height: `${LINE_H}px`,
                            display: "flex",
                            background: isActive ? activeBg : "#0f1117",
                            fontFamily: MONO, fontSize: "12px", lineHeight: `${LINE_H}px`,
                        }}>
                            {/* Sticky gutter cell */}
                            <div style={{
                                position: "sticky", left: 0, zIndex: 1,
                                width: `${GUTTER_W}px`, flexShrink: 0,
                                display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px",
                                padding: "0 6px",
                                background: isActive ? gutterActiveBg : "#0d1016",
                                color: isActive ? (isOld ? "#e06c75" : "#4ec994") : "#3a3f55",
                                fontSize: "11px", userSelect: "none",
                            }}>
                                <span style={{ minWidth: "20px", textAlign: "right" }}>{isEmpty ? "" : idx + 1}</span>
                                <span style={{ minWidth: "10px", textAlign: "center", fontWeight: 700 }}>
                                    {isEmpty ? "" : isActive ? (isOld ? "−" : "+") : " "}
                                </span>
                            </div>
                            {/* Code cell */}
                            <div style={{
                                flex: 1, whiteSpace: "pre", padding: "0 12px",
                                color: isEmpty ? "transparent" : (isActive ? (isOld ? "#f4a0a8" : "#7dd9b0") : "#b8c0d4"),
                            }}>
                                {isEmpty ? "\u00A0" : tokenize(text ?? "").map((tok, ti) => (
                                    <span key={ti} style={{ color: isActive ? undefined : TOKEN_COLORS[tok.type] || "#b8c0d4" }}>
                                        {tok.value}
                                    </span>
                                ))}
                            </div>
                        </div>
                    );
                })}
                {lines.length === 0 && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80px" }}>
                        <span style={{ fontSize: "13px", color: "#3a3f55" }}>Paste code in the left panel to see the diff</span>
                    </div>
                )}
                </div>{/* end minWidth wrapper */}
            </div>
        </div>
    );
}

function VisualDiff({ oldCode, newCode }) {
    const leftScrollRef  = useRef(null);
    const rightScrollRef = useRef(null);
    const syncingRef     = useRef(false);
    const diffRows       = computeDiff(oldCode, newCode);

    const handleScroll = (source) => {
        if (syncingRef.current) return;
        syncingRef.current = true;
        const from = source === "left" ? leftScrollRef.current : rightScrollRef.current;
        const to   = source === "left" ? rightScrollRef.current : leftScrollRef.current;
        if (from && to) to.scrollTop = from.scrollTop;
        requestAnimationFrame(() => { syncingRef.current = false; });
    };

    const statsAdd    = diffRows.filter(r => r.type === "add"    || r.type === "change").length;
    const statsRemove = diffRows.filter(r => r.type === "remove" || r.type === "change").length;

    return (
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <p style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff", margin: "0 0 12px", flexShrink: 0 }}>
                Visual Comparison
            </p>
            <div style={{ background: "#13161e", border: "1px solid #2a2e3f", borderRadius: "12px", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 14px", borderBottom: "1px solid #2a2e3f", flexShrink: 0, background: "#0f1117" }}>
                    <span style={{ fontSize: "0.8rem", fontWeight: 1000, color: "#fff", letterSpacing: "0.06em" }}>SPLIT VIEW</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        {statsRemove > 0 && <span style={{ fontSize: "11px", color: "#e06c75", fontFamily: "'DM Mono', monospace" }}>−{statsRemove}</span>}
                        {statsAdd    > 0 && <span style={{ fontSize: "11px", color: "#4ec994", fontFamily: "'DM Mono', monospace" }}>+{statsAdd}</span>}
                        {diffRows.length === 0 && <span style={{ fontSize: "11px", color: "#3a3f55" }}>no diff yet</span>}
                    </div>
                </div>
                <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
                    <DiffPane lines={diffRows} side="old" scrollRef={leftScrollRef}  onScroll={() => handleScroll("left")} />
                    <div style={{ width: "1px", background: "#2a2e3f", flexShrink: 0 }} />
                    <DiffPane lines={diffRows} side="new" scrollRef={rightScrollRef} onScroll={() => handleScroll("right")} />
                </div>
            </div>
        </div>
    );
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_OLD_CODE = `// utils/api.js
function getUser(id, callback) {
  fetch('/api/users/' + id)
    .then(function(res) {
      return res.json();
    })
    .then(function(data) {
      callback(null, data);
    })
    .catch(function(err) {
      console.log('Error:', err);
      callback(err, null);
    });
}

function updateUser(id, payload, callback) {
  fetch('/api/users/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
    .then(function(res) { return res.json(); })
    .then(function(data) { callback(null, data); })
    .catch(function(err) { callback(err, null); });
}`;

const SEED_NEW_CODE = `// utils/api.ts
const BASE = '/api/v2';

export async function getUser(id: string): Promise<User> {
  const res = await fetch(\`\${BASE}/users/\${id}\`);
  if (!res.ok) throw new Error(\`getUser failed: \${res.status}\`);
  return res.json() as Promise<User>;
}

export async function updateUser(
  id: string,
  payload: Partial<User>
): Promise<User> {
  const res = await fetch(\`\${BASE}/users/\${id}\`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(\`updateUser failed: \${res.status}\`);
  return res.json() as Promise<User>;
}`;

// ─── Shared Styles ────────────────────────────────────────────────────────────

const SHARED_STYLES = `
    @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&display=swap');
    *, *::before, *::after { font-family: 'Satoshi', sans-serif; }
    html, body { background: #10111a !important; margin: 0; padding: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .generate-btn { position: relative; overflow: hidden; }
    .generate-btn-default {
        display: inline-flex; align-items: center; justify-content: center;
        width: 100%; height: 100%;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .generate-btn-hover {
        position: absolute; inset: 0;
        display: inline-flex; align-items: center; justify-content: center;
        background-color: #00f5c9; color: #081a14;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .generate-btn:not(:disabled):hover .generate-btn-default { transform: translateY(-150%); }
    .generate-btn:not(:disabled):hover .generate-btn-hover   { transform: translateY(0); }
    .generate-btn:not(:disabled):active { opacity: 0.9; }
`;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function Dashboard({
    old_code: initialOldCode = "",
    new_code: initialNewCode = "",
    technical_docs = "",
    pr_summary = "",
}) {
    const { data, setData, post, processing, wasSuccessful } = useForm({
        old_code: initialOldCode || SEED_OLD_CODE,
        new_code: initialNewCode || SEED_NEW_CODE,
    });

    const [liveDocs, setLiveDocs] = useState(technical_docs || "");
    const [livePR,   setLivePR]   = useState(pr_summary || "");

    useEffect(() => { setLiveDocs(technical_docs); setLivePR(pr_summary); }, [technical_docs, pr_summary]);

    useEffect(() => {
        if (!window.Echo) return;
        window.Echo.channel("docs").listen("DocGenerated", (e) => {
            setLiveDocs(e.result.technical_docs);
            setLivePR(e.result.pr_summary);
        });
        return () => window.Echo.leaveChannel("docs");
    }, []);

    const handleSubmit = (e) => { e.preventDefault(); post("/process"); };

    const bp       = useBreakpoint();
    const isMobile = bp === "mobile";
    const isTablet = bp === "tablet";

    const inputError = isOverLimit(data.old_code) || isOverLimit(data.new_code);
    const isDisabled = processing || (!data.old_code && !data.new_code) || inputError;

    const outputClass = processing
        ? "opacity-40 grayscale transition-all duration-300"
        : "opacity-100 grayscale-0 transition-all duration-300";

    // ── Button content ─────────────────────────────────────────────────────────

    const btnContent = processing ? (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            <span style={{ width: "15px", height: "15px", borderRadius: "50%", border: "2px solid #081a14", borderTopColor: "rgba(8,26,20,0.3)", animation: "spin 0.7s linear infinite", display: "inline-block", flexShrink: 0 }} />
            Generating…
        </span>
    ) : wasSuccessful ? (
        <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M3 8.5l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Generated
        </span>
    ) : (
        <>
            <span className="generate-btn-default">Create Documentation &amp; Summary</span>
            <span className="generate-btn-hover">✦ Create Documentation &amp; Summary</span>
        </>
    );

    // ── Submit button ──────────────────────────────────────────────────────────

    const submitBtnStyle = {
        height: "46px", padding: "0 32px", width: "fit-content",
        borderRadius: "10px", fontWeight: 700, fontSize: "0.95rem",
        outline: "none", userSelect: "none", border: "none",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled && !wasSuccessful ? 0.4 : 1,
        background: inputError ? "rgba(248,113,113,0.12)" : wasSuccessful ? "rgba(0,212,164,0.15)" : "#00d4a4",
        color: inputError ? "#f87171" : wasSuccessful ? "#00d4a4" : "#081a14",
        transition: "background 0.2s, color 0.2s",
        letterSpacing: "-0.01em", flexShrink: 0, whiteSpace: "nowrap",
    };

    // ── Error banner ───────────────────────────────────────────────────────────

    const errorBanner = inputError && (
        <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", padding: "10px 14px", borderRadius: "8px", background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.3)", flexShrink: 0 }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: "1px" }}>
                <path d="M8 1.5L1 14h14L8 1.5z" stroke="#f87171" strokeWidth="1.4" strokeLinejoin="round"/>
                <path d="M8 6v4" stroke="#f87171" strokeWidth="1.4" strokeLinecap="round"/>
                <circle cx="8" cy="11.5" r="0.6" fill="#f87171"/>
            </svg>
            <p style={{ margin: 0, fontSize: "12px", lineHeight: "1.5", color: "#f87171", fontFamily: "inherit" }}>
                Code too long! Maximum 300 lines or 10k characters allowed for best results.
            </p>
        </div>
    );

    // ── Header ─────────────────────────────────────────────────────────────────

    const headerEl = (
        <header style={{
            background: "transparent",
            padding: isMobile ? "12px 16px" : isTablet ? "14px 28px" : "14px 40px",
            display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", flexShrink: 0,
        }}>
            <h1 style={{
                fontFamily: "'DM Mono', 'Fira Code', monospace",
                fontSize: isMobile ? "1.25rem" : isTablet ? "1.4rem" : "1.5rem",
                fontWeight: 700, letterSpacing: "-0.02em", margin: 0, lineHeight: 1, justifySelf: "start",
            }}>
                Diff<span style={{ color: "#00d4a4" }}>Docs</span>
            </h1>
            <p style={{ fontSize: isMobile ? "0.92rem" : "0.85rem", color: "#fff", fontWeight: 1000, margin: 0, textAlign: "center", whiteSpace: isMobile ? "normal" : "nowrap" }}>
                Generate technical docs and PR summaries from your code diffs.
            </p>
            <div style={{ justifySelf: "end" }}>
                <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "34px", height: "34px", borderRadius: "8px", color: "#6b7394", background: "transparent", border: "1px solid #2a2e3f", transition: "color 0.15s, border-color 0.15s, background 0.15s", textDecoration: "none" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#e8edf2"; e.currentTarget.style.borderColor = "#4a5070"; e.currentTarget.style.background = "#1e2235"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7394"; e.currentTarget.style.borderColor = "#2a2e3f"; e.currentTarget.style.background = "transparent"; }}
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.741 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                    </svg>
                </a>
            </div>
        </header>
    );

    // ── MOBILE ─────────────────────────────────────────────────────────────────

    if (isMobile) {
        return (
            <>
                <style>{SHARED_STYLES}</style>
                <div style={{ minHeight: "100vh", background: "#10111a", color: "#e8edf2", overflowY: "auto", overflowX: "hidden" }}>
                    {headerEl}
                    <div style={{ padding: "0 12px 40px", display: "flex", flexDirection: "column", gap: "24px" }}>
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <p style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff", margin: 0 }}>Code Diff Input</p>
                            <div style={{ background: "rgba(19,22,30,0.75)", backdropFilter: "blur(8px)", border: "1px solid #2a2e3f", borderRadius: "12px", padding: "16px", display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "240px" }}>
                                    <span style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff" }}>Old Code</span>
                                    <EditorPane value={data.old_code} onChange={(val) => setData("old_code", val)} placeholder="// Paste the original code here..." />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0" }}>
                                    <div style={{ height: "1px", flex: 1, background: "#2a2e3f" }} />
                                    <span style={{ fontSize: "11px", color: "#3a3f55", fontFamily: "monospace", userSelect: "none" }}>↓</span>
                                    <div style={{ height: "1px", flex: 1, background: "#2a2e3f" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "240px" }}>
                                    <span style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff" }}>New Code</span>
                                    <EditorPane value={data.new_code} onChange={(val) => setData("new_code", val)} placeholder="// Paste the updated code here..." />
                                </div>
                            </div>
                            {errorBanner}
                            <div style={{ display: "flex", justifyContent: "center" }}>
                                <button type="submit" disabled={isDisabled} className="generate-btn" style={submitBtnStyle}>{btnContent}</button>
                            </div>
                        </form>
                        <div style={{ height: "460px", display: "flex", flexDirection: "column" }}>
                            <VisualDiff oldCode={data.old_code} newCode={data.new_code} />
                        </div>
                        <OutputBlock label="Technical Documentation" content={liveDocs} onContentChange={setLiveDocs} filename="technical-docs" placeholder="Documentation will appear here" fixedHeight="480px" className={outputClass} />
                        <OutputBlock label="Pull Request Summary"    content={livePR}   onContentChange={setLivePR}   filename="pr-summary"       placeholder="PR summary will appear here"    fixedHeight="480px" className={outputClass} />
                    </div>
                </div>
            </>
        );
    }

    // ── TABLET ─────────────────────────────────────────────────────────────────

    if (isTablet) {
        return (
            <>
                <style>{SHARED_STYLES}</style>
                <div style={{ minHeight: "100vh", background: "#10111a", color: "#e8edf2", overflowY: "auto", overflowX: "hidden" }}>
                    {headerEl}
                    <div style={{ padding: "0 28px 48px", display: "flex", flexDirection: "column", gap: "28px" }}>
                        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                            <p style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff", margin: 0 }}>Code Diff Input</p>
                            <div style={{ background: "rgba(19,22,30,0.75)", backdropFilter: "blur(8px)", border: "1px solid #2a2e3f", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "280px" }}>
                                    <span style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff" }}>Old Code</span>
                                    <EditorPane value={data.old_code} onChange={(val) => setData("old_code", val)} placeholder="// Paste the original code here..." />
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "12px 0" }}>
                                    <div style={{ height: "1px", flex: 1, background: "#2a2e3f" }} />
                                    <span style={{ fontSize: "11px", color: "#3a3f55", fontFamily: "monospace", userSelect: "none" }}>↓</span>
                                    <div style={{ height: "1px", flex: 1, background: "#2a2e3f" }} />
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", gap: "8px", height: "280px" }}>
                                    <span style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff" }}>New Code</span>
                                    <EditorPane value={data.new_code} onChange={(val) => setData("new_code", val)} placeholder="// Paste the updated code here..." />
                                </div>
                            </div>
                            {errorBanner}
                            <div style={{ display: "flex", justifyContent: "center" }}>
                                <button type="submit" disabled={isDisabled} className="generate-btn" style={submitBtnStyle}>{btnContent}</button>
                            </div>
                        </form>
                        <div style={{ height: "560px", display: "flex", flexDirection: "column" }}>
                            <VisualDiff oldCode={data.old_code} newCode={data.new_code} />
                        </div>
                        <OutputBlock label="Technical Documentation" content={liveDocs} onContentChange={setLiveDocs} filename="technical-docs" placeholder="Documentation will appear here" fixedHeight="540px" className={outputClass} />
                        <OutputBlock label="Pull Request Summary"    content={livePR}   onContentChange={setLivePR}   filename="pr-summary"       placeholder="PR summary will appear here"    fixedHeight="540px" className={outputClass} />
                    </div>
                </div>
            </>
        );
    }

    // ── DESKTOP ────────────────────────────────────────────────────────────────

    return (
        <>
            <style>{SHARED_STYLES}</style>
            <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#10111a", color: "#e8edf2", overflow: "hidden" }}>
                <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
                    {headerEl}
                    <div style={{ flex: 1, padding: "20px 24px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                        <div style={{ display: "flex", gap: "16px", alignItems: "stretch", flex: 1, overflow: "hidden" }}>

                            {/* Col 1 — Input */}
                            <div style={{ width: "480px", flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
                                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, minHeight: 0, overflow: "hidden" }}>
                                    <p style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff", margin: 0, flexShrink: 0 }}>Code Diff Input</p>
                                    <div style={{ background: "rgba(19,22,30,0.75)", backdropFilter: "blur(8px)", border: "1px solid #2a2e3f", borderRadius: "12px", padding: "20px", display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflow: "hidden" }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                                                <span style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff" }}>Old Code</span>
                                            </div>
                                            <EditorPane value={data.old_code} onChange={(val) => setData("old_code", val)} placeholder="// Paste the original code here..." />
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0, margin: "12px 0" }}>
                                            <div style={{ height: "1px", flex: 1, background: "#2a2e3f" }} />
                                            <span style={{ fontSize: "11px", color: "#3a3f55", fontFamily: "monospace", userSelect: "none" }}>↓</span>
                                            <div style={{ height: "1px", flex: 1, background: "#2a2e3f" }} />
                                        </div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1, minHeight: 0, overflow: "hidden" }}>
                                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                                                <span style={{ fontSize: "0.9rem", fontWeight: 1000, letterSpacing: "0.12em", textTransform: "uppercase", color: "#ffffff" }}>New Code</span>
                                            </div>
                                            <EditorPane value={data.new_code} onChange={(val) => setData("new_code", val)} placeholder="// Paste the updated code here..." />
                                        </div>
                                    </div>
                                    {errorBanner}
                                    <button type="submit" disabled={isDisabled} className="generate-btn" style={{ ...submitBtnStyle, padding: "0 28px" }}>
                                        {btnContent}
                                    </button>
                                </form>
                            </div>

                            {/* Col 2 — Visual Diff */}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
                                <VisualDiff oldCode={data.old_code} newCode={data.new_code} />
                            </div>

                            {/* Col 3 — Outputs */}
                            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "16px", overflow: "hidden" }}>
                                <OutputBlock label="Technical Documentation" content={liveDocs} onContentChange={setLiveDocs} filename="technical-docs" placeholder="Documentation will appear here" flex={true} className={outputClass} />
                                <OutputBlock label="Pull Request Summary"    content={livePR}   onContentChange={setLivePR}   filename="pr-summary"       placeholder="PR summary will appear here"    flex={true} className={outputClass} />
                            </div>

                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}