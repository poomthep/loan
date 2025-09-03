import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        loan: "loan.html",
        admin: "admin.html"
      }
    }
  }
});
