import { b as createAstro, c as createComponent, d as addAttribute, e as renderHead, r as renderComponent, a as renderTemplate } from '../chunks/astro/server_m2Kd7PvH.mjs';
import { jsx, jsxs } from 'react/jsx-runtime';
import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { useQuery, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FaNpm, FaGithub, FaLinkedinIn } from 'react-icons/fa';
import { SiPypi } from 'react-icons/si';
import { MoonIcon, SunIcon } from 'lucide-react';
/* empty css                                 */
export { renderers } from '../renderers.mjs';

const initialState = {
  theme: "system",
  setTheme: () => null
};
const ThemeProviderContext = createContext(initialState);
function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "vite-ui-theme",
  ...props
}) {
  const [theme, setTheme] = useState(defaultTheme);
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      setTheme(stored);
    }
  }, [storageKey]);
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      root.classList.add(systemTheme);
      return;
    }
    root.classList.add(theme);
  }, [theme]);
  const value = {
    theme,
    setTheme: (theme2) => {
      localStorage.setItem(storageKey, theme2);
      setTheme(theme2);
    }
  };
  return /* @__PURE__ */ jsx(ThemeProviderContext.Provider, { ...props, value, children });
}
const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === void 0)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};

const LoadingSpinner = () => /* @__PURE__ */ jsx("div", { className: "absolute inset-0 flex items-center justify-center z-10", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 text-sm", children: [
  /* @__PURE__ */ jsxs(
    "svg",
    {
      className: "animate-spin h-5 w-5",
      xmlns: "http://www.w3.org/2000/svg",
      fill: "none",
      viewBox: "0 0 24 24",
      children: [
        /* @__PURE__ */ jsx(
          "circle",
          {
            className: "opacity-25",
            cx: "12",
            cy: "12",
            r: "10",
            stroke: "currentColor",
            strokeWidth: "4"
          }
        ),
        /* @__PURE__ */ jsx(
          "path",
          {
            className: "opacity-75",
            fill: "currentColor",
            d: "M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          }
        )
      ]
    }
  ),
  /* @__PURE__ */ jsx("span", { children: "Converting..." })
] }) });
const CodeEditor = ({
  value,
  onChange,
  language = "typescript",
  isLoading = false
}) => {
  const { theme } = useTheme();
  const [resolvedTheme, setResolvedTheme] = useState(
    theme === "system" ? "dark" : theme
  );
  useEffect(() => {
    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      setResolvedTheme(systemTheme);
    } else {
      setResolvedTheme(theme);
    }
  }, [theme]);
  const extensions = useMemo(
    () => [
      language === "pydantic" ? python() : javascript({ typescript: true })
      // ...(resolvedTheme === "dark" ? [oneDark] : []),
    ],
    [language, resolvedTheme]
  );
  const isEditable = onChange !== void 0;
  return /* @__PURE__ */ jsxs("div", { className: `h-full w-full overflow-auto overscroll-none ${isLoading ? "relative" : ""}`, children: [
    isLoading && /* @__PURE__ */ jsx(LoadingSpinner, {}),
    /* @__PURE__ */ jsx(
      CodeMirror,
      {
        value,
        height: "100%",
        extensions,
        theme: resolvedTheme === "dark" ? "dark" : "light",
        onChange,
        editable: isEditable,
        className: "h-full"
      }
    )
  ] });
};

function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

const convertSchema = async (schemaCode, targetLanguage, zodVersion, signal) => {
  try {
    const response = await fetch("/api/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        schemaCode,
        targetLanguage,
        zodVersion
      }),
      signal
    });
    const text = await response.text();
    if (!text) {
      throw new Error("Empty response from server");
    }
    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      console.error("[Client] Failed to parse response:", text);
      throw new Error(`Invalid JSON response from server. Response: ${text.substring(0, 200)}`);
    }
    if (!response.ok) {
      const errorMsg = data?.error || `Server error: ${response.status}`;
      console.error("[Client] Server error:", errorMsg);
      throw new Error(errorMsg);
    }
    if (!data.output && !data.error) {
      throw new Error("Response missing output or error field");
    }
    return { output: data.output || "", error: data.error };
  } catch (error) {
    console.error("[Client] Conversion request failed:", error);
    throw error;
  }
};
const useSchemaConversion = (schemaCode, targetLanguage, zodVersion) => {
  const debouncedSchemaCode = useDebounce(schemaCode, 500);
  const debouncedTargetLanguage = useDebounce(targetLanguage, 100);
  const debouncedZodVersion = useDebounce(zodVersion, 100);
  const { data, error, isPending } = useQuery({
    queryKey: ["convert", debouncedSchemaCode, debouncedTargetLanguage, debouncedZodVersion],
    queryFn: ({ signal }) => convertSchema(debouncedSchemaCode, debouncedTargetLanguage, debouncedZodVersion, signal),
    enabled: debouncedSchemaCode.length > 0,
    // Keep previous data while fetching new data (stale-while-revalidate)
    placeholderData: (previousData) => previousData,
    retry: false
  });
  const displayError = error instanceof Error ? error.message : null;
  return {
    output: data?.output || "",
    error: displayError,
    // Only show converting state on initial load (when we have no data yet)
    // This prevents loader from flashing while user is typing - we keep showing previous result
    isConverting: isPending && !data
  };
};

const DEFAULT_SCHEMA_V3 = `import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.number().int().positive().optional(),
  role: z.enum(["admin", "user", "guest"]),
  createdAt: z.date(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.any()).optional(),
});
`;
const DEFAULT_SCHEMA_V4 = `import { z } from "zod";

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  age: z.int().positive().optional(),
  role: z.enum(["admin", "user", "guest"]),
  createdAt: z.date(),
  tags: z.array(z.string()),
  metadata: z.record(z.string(), z.any()).optional(),
});
`;
function getDefaultSchema(version) {
  return version === "3" ? DEFAULT_SCHEMA_V3 : DEFAULT_SCHEMA_V4;
}
function isDefaultSchema(code) {
  return code === DEFAULT_SCHEMA_V3 || code === DEFAULT_SCHEMA_V4;
}

const Footer = () => {
  return /* @__PURE__ */ jsxs("footer", { className: "border-t flex-shrink-0 px-4 py-2 text-xs flex items-center gap-2", children: [
    /* @__PURE__ */ jsxs("span", { children: [
      "Powered by",
      " ",
      /* @__PURE__ */ jsx(
        "a",
        {
          href: "https://github.com/iamtemi/schemabridge",
          className: "underline",
          target: "_blank",
          rel: "noopener noreferrer",
          children: "SchemaBridge"
        }
      )
    ] }),
    " | ",
    /* @__PURE__ */ jsx(
      "a",
      {
        href: "https://www.npmjs.com/package/schemabridge",
        target: "_blank",
        rel: "noopener noreferrer",
        className: "hover:text-red-500",
        children: /* @__PURE__ */ jsx(FaNpm, { className: "w-4 h-4" })
      }
    ),
    /* @__PURE__ */ jsx(
      "a",
      {
        href: "https://pypi.org/project/schemabridge/",
        target: "_blank",
        rel: "noopener noreferrer",
        className: "hover:text-yellow-500",
        children: /* @__PURE__ */ jsx(SiPypi, { className: "w-4 h-4" })
      }
    ),
    /* @__PURE__ */ jsx(
      "a",
      {
        href: "https://github.com/iamtemi ",
        target: "_blank",
        rel: "noopener noreferrer",
        className: "hover:text-gray-500",
        children: /* @__PURE__ */ jsx(FaGithub, { className: "w-4 h-4" })
      }
    ),
    /* @__PURE__ */ jsx(
      "a",
      {
        href: "https://www.linkedin.com/in/temi-adenuga/",
        target: "_blank",
        rel: "noopener noreferrer",
        className: "hover:text-blue-500",
        children: /* @__PURE__ */ jsx(FaLinkedinIn, { className: "w-4 h-4" })
      }
    )
  ] });
};

function QueryProvider({ children }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1e3,
          refetchOnWindowFocus: false
        }
      }
    })
  );
  return /* @__PURE__ */ jsx(QueryClientProvider, { client: queryClient, children });
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };
  return /* @__PURE__ */ jsx(
    "button",
    {
      onClick: toggleTheme,
      "aria-label": "Toggle theme",
      className: "inline-flex items-center justify-center rounded border px-2 py-1 text-xs hover:opacity-70 transition-opacity",
      children: theme === "light" ? /* @__PURE__ */ jsx(MoonIcon, { className: "w-4 h-4" }) : /* @__PURE__ */ jsx(SunIcon, { className: "w-4 h-4" })
    }
  );
}

function AppContent() {
  const [schemaCode, setSchemaCode] = useState(DEFAULT_SCHEMA_V4);
  const [targetLanguage, setTargetLanguage] = useState("pydantic");
  const [zodVersion, setZodVersion] = useState("4");
  const handleVersionChange = (newVersion) => {
    if (isDefaultSchema(schemaCode)) {
      setSchemaCode(getDefaultSchema(newVersion));
    }
    setZodVersion(newVersion);
  };
  const { output, error, isConverting } = useSchemaConversion(
    schemaCode,
    targetLanguage,
    zodVersion
  );
  const displayOutput = error || output;
  return /* @__PURE__ */ jsxs("div", { className: "h-screen flex flex-col font-sans overscroll-none", children: [
    /* @__PURE__ */ jsx("header", { className: "border-b flex-shrink-0", children: /* @__PURE__ */ jsxs("div", { className: "max-w-full mx-auto px-6 py-4 flex items-center justify-between", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "text-2xl font-bold", children: "SchemaBridge" }),
        /* @__PURE__ */ jsx("p", { className: "text-sm mt-1", children: "A developer-focused playground for schema conversion" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
        /* @__PURE__ */ jsxs("nav", { className: "flex gap-4", children: [
          /* @__PURE__ */ jsx("a", { href: "/", className: "text-sm font-medium hover:opacity-70 transition-opacity", children: "Docs" }),
          /* @__PURE__ */ jsx(
            "a",
            {
              href: "/playground",
              className: "text-sm font-medium hover:opacity-70 transition-opacity",
              children: "Playground"
            }
          )
        ] }),
        /* @__PURE__ */ jsx(ThemeToggle, {})
      ] })
    ] }) }),
    /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-2 gap-0 divide-x w-full flex-1 min-h-0", children: [
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col min-h-0 overflow-hidden", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex-shrink-0 flex justify-between items-center px-4 py-1 border-b", children: [
          /* @__PURE__ */ jsx("h2", { className: "uppercase tracking-wider text-sm font-medium", children: "Input" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "zodVersion", className: "text-sm font-medium whitespace-nowrap", children: "Zod Version" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: zodVersion,
                onChange: (e) => handleVersionChange(e.target.value),
                className: "border rounded px-2 py-1 text-sm",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "3", children: "v3" }),
                  /* @__PURE__ */ jsx("option", { value: "4", children: "v4" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex-1 min-h-0 overflow-hidden", children: /* @__PURE__ */ jsx(CodeEditor, { value: schemaCode, onChange: setSchemaCode }) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-col min-h-0 overflow-hidden", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex-shrink-0 flex justify-between items-center px-4 py-1 border-b", children: [
          /* @__PURE__ */ jsx("h2", { className: "uppercase tracking-wider text-sm font-medium", children: "Generated Output" }),
          /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-2", children: [
            /* @__PURE__ */ jsx("label", { htmlFor: "zodVersion", className: "text-sm font-medium whitespace-nowrap", children: "Target Language" }),
            /* @__PURE__ */ jsxs(
              "select",
              {
                value: targetLanguage,
                onChange: (e) => setTargetLanguage(e.target.value),
                className: "border rounded px-2 py-1 text-sm",
                children: [
                  /* @__PURE__ */ jsx("option", { value: "pydantic", children: "Pydantic (Python)" }),
                  /* @__PURE__ */ jsx("option", { value: "typescript", children: "TypeScript" })
                ]
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("div", { className: "flex-1 min-h-0 overflow-hidden relative", children: /* @__PURE__ */ jsx(CodeEditor, { value: displayOutput, language: targetLanguage, isLoading: isConverting }) })
      ] })
    ] }),
    /* @__PURE__ */ jsx(Footer, {})
  ] });
}
function App() {
  return /* @__PURE__ */ jsx(QueryProvider, { children: /* @__PURE__ */ jsx(ThemeProvider, { children: /* @__PURE__ */ jsx(AppContent, {}) }) });
}

const $$Astro = createAstro();
const $$Playground = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$Astro, $$props, $$slots);
  Astro2.self = $$Playground;
  return renderTemplate`<html lang="en"> <head><meta charset="utf-8"><link rel="icon" type="image/svg+xml" href="/favicon.svg"><meta name="viewport" content="width=device-width"><meta name="generator"${addAttribute(Astro2.generator, "content")}><title>SchemaBridge Playground</title>${renderHead()}</head> <body> <!-- client:load = hydrate immediately on page load --> ${renderComponent($$result, "App", App, { "client:load": true, "client:component-hydration": "load", "client:component-path": "/Users/temi/codebase/schemabridge/packages/docs/src/app", "client:component-export": "default" })} </body></html>`;
}, "/Users/temi/codebase/schemabridge/packages/docs/src/pages/playground.astro", void 0);

const $$file = "/Users/temi/codebase/schemabridge/packages/docs/src/pages/playground.astro";
const $$url = "/playground";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$Playground,
  file: $$file,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
