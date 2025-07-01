# CoReader

一个灵感源自微信读书、使用 **Next.js 13 / React 18 / TypeScript** 打造的开源阅读应用。

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-13.5.1-black?logo=nextdotjs" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript" />
  <img src="https://img.shields.io/badge/TailwindCSS-3.x-06b6d4?logo=tailwindcss" />
</p>

## ✨ 功能亮点

- 📚 **多格式导入**：支持 TXT / EPUB / PDF（依赖 `pdfjs-dist` & `epubjs`）。
- 🖍️ **高亮 & 批注**：支持高亮、下划线、波浪线及笔记弹窗。
- 🔍 **全文搜索**：快速定位关键字，展示章节 & 页码。
- ⚙️ **阅读设置**：字体、字号、行距、页面宽度、主题、一键夜间模式。
- 📖 **两种阅读模式**：
  - Paged —— 类 Kindle 翻页（键盘 ←/→ / 按钮）
  - Scroll —— 向下滚动到边缘自动翻页。
- ☁️ **持久化存储**：使用 zustand + localStorage (`coreader-storage`) 记录书架、进度、高亮。
- 📊 **阅读统计**：展示已读书籍、阅读进度（逐步完善）。

## 🚀 快速开始

```bash
# 克隆项目
git clone https://github.com/yourname/coreader.git && cd coreader

# 安装依赖
npm install  # 或 pnpm install / yarn install

# 启动开发环境
npm run dev  # 默认 http://localhost:3000
```

打包生产环境：

```bash
npm run build   # next build
npm start       # next start
```

## 📂 项目结构

```
coreader/
├─ app/               # Next.js app 目录
│  ├─ layout.tsx      # 全局布局
│  ├─ page.tsx        # 主页 / 书架
│  └─ ...
├─ components/        # 通用 UI 与业务组件
├─ lib/               # 工具库 & 全局 store / 引擎
├─ public/            # 公共资源
├─ styles/            # 全局样式
├─ README.md
└─ package.json
```

## 🛠️ 主要技术栈

- [Next.js 13](https://nextjs.org/) + App Router
- [React 18](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 3](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/) – 动画
- [zustand](https://github.com/pmndrs/zustand) – 全局状态管理
- [Radix UI](https://www.radix-ui.com/) + [shadcn/ui](https://ui.shadcn.com/) – 无障碍组件

## 📖 路线图

- [ ] 多设备同步 (IndexedDB + Cloud sync)
- [ ] 阅读统计图表
- [ ] 导出 Markdown / PDF 高亮 & 笔记
- [ ] 离线 PWA

## 🤝 贡献指南

1. `fork` 本仓库并新建分支 `feat/xxx`。
2. 提交代码前运行 `npm run lint && npm run type-check` 确保无错误。
3. 提交 PR，并简要说明变更。

## 📄 License

[MIT](LICENSE)
