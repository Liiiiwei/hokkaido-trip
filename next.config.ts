import { mkdirSync, writeFileSync } from "node:fs";
import type { NextConfig } from "next";

// GitHub Pages 的網址有儲存庫名稱這一層，建置時由環境變數帶入；本機開發是空字串
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// 這次建置的版本代號。網站會定時讀 version.json，和自己身上的代號不一樣就知道有新版
const buildId = process.env.NEXT_PUBLIC_BUILD_ID ?? process.env.GITHUB_SHA ?? "dev";
if (buildId !== "dev") {
  mkdirSync("public", { recursive: true });
  writeFileSync("public/version.json", JSON.stringify({ id: buildId }) + "\n");
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId },
  output: "export",
  basePath,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
