import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@sparticuz/chromium",
    "playwright-core",
  ],

  outputFileTracingIncludes: {
    "/api/admin/commercial-documents": [
      "./templates/has/modelo_orcamento_HAS.docx",
      "./templates/has/modelo_contrato_HAS.docx",
      "./templates/has/modelo_recibo_HAS.docx",
      "./templates/has/fonts/*.ttf",
      "./templates/has/fonts/LICENSE.txt",
      "./.has-pdf-runtime/chromium",
      "./.has-pdf-runtime/*.so",
      "./.has-pdf-runtime/*.so.1",
      "./.has-pdf-runtime/*.json",
      "./node_modules/@sparticuz/chromium/bin/fonts.tar.br",
      "./node_modules/@sparticuz/chromium/bin/al2023.tar.br",
      "./node_modules/playwright-core/**/*",
      "./node_modules/docx-preview/dist/docx-preview.min.js",
      "./node_modules/jszip/dist/jszip.min.js",
    ],
  },

  // The executable is already unpacked during build. Do not ship a second
  // compressed copy or inflate this 199 MB binary into the runtime /tmp.
  outputFileTracingExcludes: {
    "/*": ["./node_modules/@sparticuz/chromium/bin/chromium.br", "./node_modules/@sparticuz/chromium/bin/swiftshader.tar.br"],
    "/api/admin/commercial-documents": ["./templates/has/**/*.zip"],
  },

  turbopack: {
    root: process.cwd(),
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;