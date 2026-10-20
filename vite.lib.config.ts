import { defineConfig } from "vite";

export default defineConfig({
  define: {
    __BEHAVE_DEVELOPMENT__: "(typeof process === 'undefined' || process.env.NODE_ENV !== 'production')",
    "process.env.NODE_ENV": "process.env.NODE_ENV",
  },
  build: {
    lib: {
      entry: "src/index.ts",
      formats: ["es"],
      fileName: () => "index.js",
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      external: ["react", "react-dom", "react-dom/client"],
    },
  },
});
