// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// @lovable.dev/mcp-js 0.23 compares Vite's forward-slash `config.root` against a
// backslash `path.resolve()` result, so on Windows its own guard rejects the
// project and every vite run dies with "routesDir must resolve under …". Skipping
// it there restores dev/build; the routes it generates are already committed, and
// Lovable's Linux build keeps loading the plugin.
const skipMcpPlugin =
  process.platform === "win32" || process.env.SKIP_LOVABLE_MCP_PLUGIN === "1";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: skipMcpPlugin ? [] : [mcpPlugin()],
  },
});
