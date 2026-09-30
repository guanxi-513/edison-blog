import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,

  async rewrites() {
    return {
      // beforeFiles: 在文件系统路由检查之前执行代理。
      // 必须用这种形式——app/api/ 目录下存在 posts.ts 等同名文件，
      // 默认的 afterFiles 会让 /api/posts 命中这些文件而跳过代理返回 404。
      beforeFiles: [
        // 注意：/api 下既有 FastAPI 业务接口，也有 Next.js 自己的 route handlers
        // （app/api/music/route.ts、app/api/uapis/route.ts）。
        // 必须用负向正则排除这两个前缀，否则它们会被劫持到 FastAPI 返回 404。
        {
          source: "/api/:path((?!music|uapis).*)",
          destination: "http://127.0.0.1:8000/api/:path",
        },
        {
          source: "/uploads/:path*",
          destination: "http://127.0.0.1:8000/uploads/:path*",
        },
        {
          source: "/reader3/:path*",
          destination: `${process.env.NOVEL_API_URL || "http://localhost:8085"}/reader3/:path*`,
        },
      ],
    };
  },

  experimental: {
    optimizePackageImports: [
      "framer-motion",
      "lucide-react",
      "@dnd-kit/core",
      "@dnd-kit/sortable",
      "@dnd-kit/utilities",
    ],
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "static.hiromu.top" },
      { protocol: "https", hostname: "hiromu520.oss-cn-beijing.aliyuncs.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "http", hostname: "wfqqreader-1252317822.image.myqcloud.com" },
    ],
  },
};

export default nextConfig;
