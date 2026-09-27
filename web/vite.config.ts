import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const publicHost = "bet.tidalwavesoftwebsolutions.tech";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    allowedHosts: [publicHost],
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: [publicHost],
  },
});
