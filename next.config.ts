import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Import de CSV grande (1000+ linhas) pode passar do limite padrão de
      // 1MB do body de Server Actions, especialmente com colunas de texto
      // longas (gêneros, notas). O import já é enviado em lotes menores pelo
      // cliente, mas isso dá uma margem extra de segurança.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;
