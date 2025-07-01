"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Menu,
  Settings,
  Bookmark,
  Search,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Type,
  Palette,
  Languages,
  MessageSquare,
  Highlighter,
  Underline,
  Waves,
  Copy,
  Share,
  MoreHorizontal,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Eye,
  EyeOff,
  Volume2,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Maximize,
  Minimize,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBookStore } from "@/lib/store";
import { ReadingEngine, PageInfo } from "@/lib/reading-engine";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ReadingInterfaceProps {
  book: any;
  onClose: () => void;
}

const SETTINGS_PANEL_VARIANTS = {
  hidden: { opacity: 0, x: 300 },
  visible: { opacity: 1, x: 0 },
} as const;

export function ReadingInterface({ book, onClose }: ReadingInterfaceProps) {
  const {
    settings,
    updateSettings,
    highlights,
    addHighlight,
    updateBook,
    notes,
    addNote,
  } = useBookStore();
  const [readingEngine] = useState(() => new ReadingEngine(book));
  const [currentPage, setCurrentPage] = useState(book.currentPage || 0);
  const [pageInfo, setPageInfo] = useState<PageInfo | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showChapters, setShowChapters] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showHighlights, setShowHighlights] = useState(false);
  const [selectedText, setSelectedText] = useState("");
  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [highlightMenuPosition, setHighlightMenuPosition] = useState({
    x: 0,
    y: 0,
  });
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [brightness, setBrightness] = useState(settings.brightness);
  const [isReading, setIsReading] = useState(false);
  const [readingSpeed, setReadingSpeed] = useState(200); // words per minute
  const [readingMode, setReadingMode] = useState<"page" | "scroll">("page");

  const contentRef = useRef<HTMLDivElement>(null);
  const selectionRef = useRef<Selection | null>(null);

  const bookHighlights = highlights.filter((h) => h.bookId === book.id);
  const bookNotes = notes?.filter((n) => n.bookId === book.id) || [];

  // Initialize page info
  useEffect(() => {
    let mounted = true;
    const bookTitle = book.title; // 在函数内部保存引用，避免依赖项变化
    const bookContent = book.content; // 在函数内部保存引用，避免依赖项变化

    try {
      // 确保阅读引擎已初始化
      console.log("初始化阅读界面，书籍：", bookTitle);
      console.log("内容长度：", bookContent?.length || 0);
      console.log("章节数：", book.chapters?.length || 0);

      // 内容检查
      if (
        !bookContent ||
        bookContent.trim() === "" ||
        bookContent === "No content available"
      ) {
        console.error("书籍内容为空或无效");

        // 尝试从章节内容合并构建全文内容
        if (book.chapters && book.chapters.length > 0) {
          let mergedContent = "";
          for (const chapter of book.chapters) {
            if (chapter.content && chapter.content.trim() !== "") {
              mergedContent += chapter.content + "\n\n";
            }
          }

          if (mergedContent.trim() !== "") {
            console.log(
              "从章节内容构建了全文内容，长度:",
              mergedContent.length
            );
            // 更新阅读引擎中的内容
            readingEngine.updateContent(mergedContent);
          } else {
            throw new Error(`无法读取"${bookTitle}"的内容，请尝试重新导入。`);
          }
        } else {
          throw new Error(`无法读取"${bookTitle}"的内容，请尝试重新导入。`);
        }
      }

      const totalPages = readingEngine.getTotalPages();
      console.log("总页数：", totalPages);

      if (totalPages === 0) {
        console.error("阅读引擎中未找到页面");
        throw new Error("未找到可阅读的页面，请尝试重新导入书籍");
      }

      // 确保当前页面索引有效
      const validPage = Math.max(0, Math.min(currentPage, totalPages - 1));

      const info = readingEngine.getPageInfo(validPage);
      console.log("页面信息：", info);

      if (info && mounted) {
        if (info.content === "No content available") {
          console.error('页面内容为"No content available"');
          throw new Error(`无法读取"${bookTitle}"的内容，请尝试重新导入。`);
        }

        setPageInfo(info);
        if (validPage !== currentPage) {
          setCurrentPage(validPage);
        }
      } else {
        console.error("无法获取页面信息");
        throw new Error("无法获取页面信息，请尝试重新导入");
      }
    } catch (error) {
      console.error("获取页面信息时出错:", error);

      if (mounted) {
        // 创建一个默认的页面信息
        const errorMessage =
          error instanceof Error
            ? error.message
            : `无法读取"${bookTitle}"的内容，请尝试重新导入。`;

        setPageInfo({
          content: errorMessage,
          chapterId: "chapter-1",
          chapterTitle: bookTitle || "Full Text",
          pageInChapter: 0,
          totalPagesInChapter: 1,
          globalPage: 0,
          totalPages: 1,
        });

        // 显示提示信息
        toast.error(errorMessage, {
          duration: 5000,
        });
      }
    }

    return () => {
      mounted = false;
    };
  }, [book, currentPage, readingEngine, toast]);

  // Update book progress
  useEffect(() => {
    if (pageInfo) {
      const progress = Math.round(
        (pageInfo.globalPage / pageInfo.totalPages) * 100
      );
      updateBook(book.id, {
        currentPage: pageInfo.globalPage,
        progress,
        lastReadAt: new Date(),
      });
    }
  }, [pageInfo, book.id, updateBook]);

  // Apply brightness
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.style.filter = `brightness(${brightness}%)`;
    }
  }, [brightness]);

  // Repaginate when reading settings change（防抖 300ms）
  const repaginateTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (repaginateTimeout.current) {
      clearTimeout(repaginateTimeout.current);
    }

    repaginateTimeout.current = setTimeout(() => {
      readingEngine.repaginate({
        fontSize: settings.fontSize,
        fontFamily: settings.fontFamily,
        lineHeight: settings.lineHeight,
        pageWidth: settings.pageWidth,
        pageHeight: window.innerHeight - 200,
        padding: 40,
      });

      const info = readingEngine.getPageInfo(currentPage);
      setPageInfo(info);
    }, 300);

    return () => {
      if (repaginateTimeout.current) clearTimeout(repaginateTimeout.current);
    };
  }, [
    settings.fontSize,
    settings.fontFamily,
    settings.lineHeight,
    settings.pageWidth,
  ]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (showSettings || showChapters || showSearch || showNoteDialog) return;

      switch (e.key) {
        case "ArrowLeft":
        case "ArrowUp":
          e.preventDefault();
          prevPage();
          break;
        case "ArrowRight":
        case "ArrowDown":
        case " ":
          e.preventDefault();
          nextPage();
          break;
        case "Home":
          e.preventDefault();
          goToPage(0);
          break;
        case "End":
          e.preventDefault();
          goToPage(readingEngine.getTotalPages() - 1);
          break;
        case "f":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setShowSearch(true);
          }
          break;
        case "Escape":
          if (isFullscreen) {
            setIsFullscreen(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [showSettings, showChapters, showSearch, showNoteDialog, isFullscreen]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      const text = selection.toString().trim();
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      setSelectedText(text);
      selectionRef.current = selection;
      setSelectionRange({
        start: range.startOffset,
        end: range.endOffset,
      });
      setHighlightMenuPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
      });
      setShowHighlightMenu(true);
    }
  }, []);

  const createHighlight = (
    color: "yellow" | "blue" | "green" | "red",
    style: "highlight" | "underline" | "wave"
  ) => {
    if (selectedText && selectionRange && pageInfo) {
      addHighlight({
        bookId: book.id,
        text: selectedText,
        color,
        style,
        page: pageInfo.globalPage,
        position: selectionRange,
      });
      setShowHighlightMenu(false);
      clearSelection();
      toast.success("Highlight added");
    }
  };

  const clearSelection = () => {
    setSelectedText("");
    setSelectionRange(null);
    selectionRef.current?.removeAllRanges();
  };

  const openNoteDialog = () => {
    setShowHighlightMenu(false);
    setShowNoteDialog(true);
  };

  const saveNote = () => {
    if (selectedText && selectionRange && pageInfo) {
      addNote({
        bookId: book.id,
        text: selectedText,
        note: noteText,
        chapterId: pageInfo.chapterId,
        page: pageInfo.globalPage,
        position: selectionRange,
      });

      if (noteText.trim()) {
        addHighlight({
          bookId: book.id,
          text: selectedText,
          note: noteText,
          color: "yellow",
          style: "highlight",
          page: pageInfo.globalPage,
          position: selectionRange,
        });
      }

      toast.success("Note saved");
    }
    setShowNoteDialog(false);
    setNoteText("");
    clearSelection();
  };

  const nextPage = () => {
    if (pageInfo && pageInfo.globalPage < pageInfo.totalPages - 1) {
      setCurrentPage(pageInfo.globalPage + 1);
    }
  };

  const prevPage = () => {
    if (pageInfo && pageInfo.globalPage > 0) {
      setCurrentPage(pageInfo.globalPage - 1);
    }
  };

  const goToPage = (page: number) => {
    const totalPages = readingEngine.getTotalPages();
    setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
  };

  const goToChapter = (chapterId: string) => {
    const firstPage = readingEngine.getChapterFirstPage(chapterId);
    setCurrentPage(firstPage);
    setShowChapters(false);
  };

  const handleSearch = (query: string) => {
    if (query.trim()) {
      const results = readingEngine.searchText(query);
      setSearchResults(results);
    } else {
      setSearchResults([]);
    }
  };

  const goToSearchResult = (globalPage: number) => {
    setCurrentPage(globalPage);
    setShowSearch(false);
  };

  const copyText = () => {
    if (selectedText) {
      navigator.clipboard.writeText(selectedText);
      toast.success("Text copied to clipboard");
      setShowHighlightMenu(false);
      clearSelection();
    }
  };

  const shareText = () => {
    if (selectedText && pageInfo) {
      const shareText = `"${selectedText}" - ${book.title} by ${
        book.author
      } (Page ${pageInfo.globalPage + 1})`;
      if (navigator.share) {
        navigator.share({
          title: book.title,
          text: shareText,
        });
      } else {
        navigator.clipboard.writeText(shareText);
        toast.success("Quote copied to clipboard");
      }
      setShowHighlightMenu(false);
      clearSelection();
    }
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const startAutoReading = () => {
    setIsReading(true);
    // Auto-reading implementation would go here
    // This would automatically advance pages based on reading speed
  };

  const stopAutoReading = () => {
    setIsReading(false);
  };

  /**
   * 滚动到底 / 顶自动翻页
   * - 距离边界 THRESHOLD 内触发
   * - 使用 600ms 节流防止频繁翻页
   */
  useEffect(() => {
    const THRESHOLD = 80; // px
    const THROTTLE = 600; // ms

    let lastTrigger = 0;
    let isLocked = false; // 防止翻页加载过程中再次触发，如有异步加载可用

    const handler = () => {
      if (showSettings || showChapters || showSearch || showNoteDialog) return;
      if (isLocked) return;

      const { scrollTop, scrollHeight, clientHeight } =
        document.documentElement;

      // 节流
      const now = Date.now();
      if (now - lastTrigger < THROTTLE) return;

      // 底部
      if (scrollTop + clientHeight >= scrollHeight - THRESHOLD) {
        isLocked = true;
        nextPage();
        lastTrigger = now;
        isLocked = false;
        return;
      }

      // 顶部
      if (scrollTop <= THRESHOLD) {
        isLocked = true;
        prevPage();
        lastTrigger = now;
        isLocked = false;
      }
    };

    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [showSettings, showChapters, showSearch, showNoteDialog, readingMode]);

  // 翻页后自动回到顶部
  useEffect(() => {
    if (readingMode === "page") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [currentPage, readingMode]);

  const SettingsPanel = () => (
    <div className="fixed right-0 top-0 h-full w-80 bg-background border-l shadow-xl z-50 overflow-hidden">
      <div className="p-6 h-full overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Reading Settings</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(false)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Tabs defaultValue="display" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="display">Display</TabsTrigger>
            <TabsTrigger value="reading">Reading</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="display" className="space-y-6 mt-6">
            {/* Font Size */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Font Size</label>
                <span className="text-sm text-muted-foreground">
                  {settings.fontSize}px
                </span>
              </div>
              <Slider
                value={[settings.fontSize]}
                onValueChange={([value]) => updateSettings({ fontSize: value })}
                onValueCommit={([value]) => updateSettings({ fontSize: value })}
                min={12}
                max={32}
                step={1}
                className="w-full"
              />
            </div>

            {/* Font Family */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                Font Family
              </label>
              <Select
                value={settings.fontFamily}
                onValueChange={(value: any) =>
                  updateSettings({ fontFamily: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crimson">Crimson Text</SelectItem>
                  <SelectItem value="merriweather">Merriweather</SelectItem>
                  <SelectItem value="source-serif">Source Serif 4</SelectItem>
                  <SelectItem value="inter">Inter</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line Height */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Line Height</label>
                <span className="text-sm text-muted-foreground">
                  {settings.lineHeight}
                </span>
              </div>
              <Slider
                value={[settings.lineHeight]}
                onValueChange={([value]) =>
                  updateSettings({ lineHeight: value })
                }
                onValueCommit={([value]) =>
                  updateSettings({ lineHeight: value })
                }
                min={1.2}
                max={2.5}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Page Width */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Page Width</label>
                <span className="text-sm text-muted-foreground">
                  {settings.pageWidth}px
                </span>
              </div>
              <Slider
                value={[settings.pageWidth]}
                onValueChange={([value]) =>
                  updateSettings({ pageWidth: value })
                }
                onValueCommit={([value]) =>
                  updateSettings({ pageWidth: value })
                }
                min={400}
                max={1000}
                step={50}
                className="w-full"
              />
            </div>

            {/* Theme */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                Reading Theme
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    value: "light",
                    label: "Light",
                    bg: "bg-white",
                    text: "text-black",
                  },
                  {
                    value: "dark",
                    label: "Dark",
                    bg: "bg-gray-900",
                    text: "text-white",
                  },
                  {
                    value: "sepia",
                    label: "Sepia",
                    bg: "bg-amber-50",
                    text: "text-amber-900",
                  },
                  {
                    value: "paper",
                    label: "Paper",
                    bg: "bg-orange-50",
                    text: "text-orange-900",
                  },
                ].map((theme) => (
                  <Button
                    key={theme.value}
                    variant={
                      settings.theme === theme.value ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() =>
                      updateSettings({ theme: theme.value as any })
                    }
                    className={cn(
                      "justify-start gap-2",
                      settings.theme === theme.value && "ring-2 ring-primary"
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border",
                        theme.bg,
                        theme.text
                      )}
                    />
                    {theme.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Brightness */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Brightness</label>
                <span className="text-sm text-muted-foreground">
                  {brightness}%
                </span>
              </div>
              <Slider
                value={[brightness]}
                onValueChange={([value]) => {
                  setBrightness(value);
                  updateSettings({ brightness: value });
                }}
                min={20}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          </TabsContent>

          <TabsContent value="reading" className="space-y-6 mt-6">
            {/* Page Transition */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                Page Transition
              </label>
              <Select
                value={settings.pageTransition}
                onValueChange={(value: any) =>
                  updateSettings({ pageTransition: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="slide">Slide</SelectItem>
                  <SelectItem value="fade">Fade</SelectItem>
                  <SelectItem value="flip">Flip</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Auto Reading Speed */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium">Reading Speed</label>
                <span className="text-sm text-muted-foreground">
                  {readingSpeed} WPM
                </span>
              </div>
              <Slider
                value={[readingSpeed]}
                onValueChange={([value]) => setReadingSpeed(value)}
                min={100}
                max={500}
                step={25}
                className="w-full"
              />
            </div>

            {/* Auto Save */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Auto Save Progress</label>
              <Switch
                checked={settings.autoSave}
                onCheckedChange={(checked) =>
                  updateSettings({ autoSave: checked })
                }
              />
            </div>

            {/* Night Mode */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Night Mode</label>
              <Switch
                checked={settings.nightMode}
                onCheckedChange={(checked) =>
                  updateSettings({ nightMode: checked })
                }
              />
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-6 mt-6">
            <div className="space-y-4">
              <Button variant="outline" className="w-full justify-start">
                <Download className="h-4 w-4 mr-2" />
                Export Highlights
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Share className="h-4 w-4 mr-2" />
                Share Book
              </Button>
              <Button variant="outline" className="w-full justify-start">
                <Bookmark className="h-4 w-4 mr-2" />
                Manage Bookmarks
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );

  const ChaptersPanel = () => (
    <motion.div
      initial={{ opacity: 0, x: -300 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -300 }}
      className="fixed left-0 top-0 h-full w-80 bg-background border-r shadow-xl z-50"
    >
      <div className="p-6 h-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Table of Contents</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowChapters(false)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-full">
          <div className="space-y-2">
            {readingEngine.getChapters().map((chapter) => (
              <Button
                key={chapter.id}
                variant={
                  pageInfo?.chapterId === chapter.id ? "default" : "ghost"
                }
                className="w-full justify-start h-auto p-3 text-left"
                onClick={() => goToChapter(chapter.id)}
              >
                <div>
                  <p className="font-medium">{chapter.title}</p>
                  <p className="text-xs text-muted-foreground">
                    Pages {chapter.startPage + 1} - {chapter.endPage + 1} (
                    {chapter.endPage - chapter.startPage + 1} pages)
                  </p>
                </div>
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );

  const HighlightMenu = () => (
    <AnimatePresence>
      {showHighlightMenu && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed z-50 bg-background border rounded-lg shadow-lg p-2"
          style={{
            left: Math.max(
              10,
              Math.min(highlightMenuPosition.x - 100, window.innerWidth - 210)
            ),
            top: Math.max(10, highlightMenuPosition.y - 80),
          }}
        >
          <div className="flex items-center gap-1 mb-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => createHighlight("yellow", "highlight")}
              className="bg-[#fff0d3] hover:bg-[#ffe9bc] w-8 h-8 p-0"
              title="Highlight"
            >
              <Highlighter className="h-3 w-3" />
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={openNoteDialog}
              title="Add Note"
            >
              <MessageSquare className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={copyText} title="Copy">
              <Copy className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="ghost" onClick={shareText} title="Share">
              <Share className="h-3 w-3" />
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  const fontFamilyClass =
    {
      crimson: "font-reading",
      merriweather: "font-reading-serif",
      "source-serif": "font-reading-serif",
      inter: "font-reading-sans",
    }[settings.fontFamily] || "font-reading";

  const themeClass =
    {
      light: "",
      dark: "dark",
      sepia: "theme-sepia",
      paper: "theme-paper",
      green: "theme-green",
    }[settings.theme] || "";

  // 处理高亮渲染
  const getHighlightedHtml = useCallback(() => {
    if (!pageInfo) return "";

    // 本页相关高亮/笔记
    const pageHighlights = highlights.filter(
      (h) => h.bookId === book.id && h.page === pageInfo.globalPage
    );

    let html = pageInfo.content;

    pageHighlights.forEach((h, idx) => {
      const safeText = h.text.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&"); // 转义正则
      const regex = new RegExp(safeText, "g");
      let baseStyle = "";
      if (h.style === "highlight") {
        // 区分普通高亮与附带笔记的高亮
        baseStyle = `background-color:${h.note ? "#e9b439" : "#fff0d3"};`;
      } else if (h.style === "underline") {
        baseStyle =
          "text-decoration: underline; text-decoration-color:#fe8589;";
      } else {
        baseStyle = "text-decoration: underline wavy #6b93ca;";
      }

      const noteAttr = h.note
        ? `data-note="${encodeURIComponent(h.note)}"`
        : "";

      html = html.replace(
        regex,
        `<span class="highlight-item cursor-pointer" data-idx="${idx}" style="${baseStyle}" ${noteAttr}>$&</span>`
      );
    });

    return html;
  }, [pageInfo, highlights, book.id]);

  // 笔记侧栏
  const [activeNote, setActiveNote] = useState<string | null>(null);

  // 点击高亮查看笔记
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target && target.classList.contains("highlight-item")) {
        const note = target.getAttribute("data-note");
        if (note) {
          setActiveNote(decodeURIComponent(note));
        }
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  if (!pageInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading book content...</p>
          <p className="text-sm text-muted-foreground mt-2">
            {book.title} by {book.author}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen reading-container",
        themeClass,
        isFullscreen && "fixed inset-0 z-50"
      )}
    >
      {/* Header */}
      {!isFullscreen && (
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur border-b">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={onClose}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="font-semibold text-sm truncate max-w-[200px]">
                  {book.title}
                </h1>
                <p className="text-xs text-muted-foreground">{book.author}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSearch(true)}
                title="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowChapters(true)}
                title="Table of Contents"
              >
                <Menu className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                title="Fullscreen"
              >
                <Maximize className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
                title="Settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Controls for Fullscreen */}
      {isFullscreen && (
        <div className="fixed top-4 right-4 z-50 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            title="Exit Fullscreen"
          >
            <Minimize className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="relative flex-1">
        <div
          ref={contentRef}
          className={cn(
            "max-w-4xl mx-auto p-8 min-h-screen cursor-text",
            fontFamilyClass
          )}
          style={{
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            maxWidth: `${settings.pageWidth}px`,
          }}
          onMouseUp={handleTextSelection}
          onTouchEnd={handleTextSelection}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={pageInfo.globalPage}
              initial={{
                opacity: 0,
                x: settings.pageTransition === "slide" ? 50 : 0,
                scale: settings.pageTransition === "flip" ? 0.9 : 1,
              }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{
                opacity: settings.pageTransition === "fade" ? 0 : 1,
                x: settings.pageTransition === "slide" ? -50 : 0,
                scale: settings.pageTransition === "flip" ? 0.9 : 1,
              }}
              transition={{ duration: 0.3 }}
              className="prose prose-lg max-w-none"
            >
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">
                  {pageInfo.chapterTitle}
                </h2>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    Page {pageInfo.pageInChapter + 1} of{" "}
                    {pageInfo.totalPagesInChapter}
                  </span>
                  <span>•</span>
                  <span>
                    Chapter {pageInfo.globalPage + 1} of {pageInfo.totalPages}
                  </span>
                </div>
              </div>

              <div
                className="whitespace-pre-wrap leading-relaxed"
                dangerouslySetInnerHTML={{ __html: getHighlightedHtml() }}
              />
              {activeNote && (
                <div className="fixed right-4 top-1/3 w-64 bg-background border shadow-lg p-4 z-50">
                  <h4 className="font-semibold mb-2">Note</h4>
                  <p className="text-sm whitespace-pre-wrap">{activeNote}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => setActiveNote(null)}
                  >
                    Close
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={prevPage}
                disabled={pageInfo.globalPage === 0}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>

              <div className="flex items-center gap-4">
                {isReading ? (
                  <Button variant="outline" size="sm" onClick={stopAutoReading}>
                    <Pause className="h-4 w-4 mr-1" />
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={startAutoReading}
                  >
                    <Play className="h-4 w-4 mr-1" />
                    Auto Read
                  </Button>
                )}

                <span className="text-sm text-muted-foreground whitespace-nowrap">
                  {pageInfo.globalPage + 1} / {pageInfo.totalPages}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={nextPage}
                disabled={pageInfo.globalPage === pageInfo.totalPages - 1}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>

            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{
                  width: `${
                    ((pageInfo.globalPage + 1) / pageInfo.totalPages) * 100
                  }%`,
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Panels */}
      <AnimatePresence>
        {showSettings && <SettingsPanel />}
        {showChapters && <ChaptersPanel />}
        {showSearch && (
          <motion.div
            key="search-panel"
            initial={{ opacity: 0, y: -300 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -300 }}
            className="fixed top-0 left-0 right-0 bg-background border-b shadow-xl z-50 p-6"
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <Input
                    placeholder="Search in book..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      handleSearch(e.target.value);
                    }}
                    className="w-full"
                    autoFocus
                  />
                </div>
                <Button variant="outline" onClick={() => setShowSearch(false)}>
                  Close
                </Button>
              </div>

              {searchResults.length > 0 && (
                <ScrollArea className="h-40">
                  <div className="space-y-2">
                    {searchResults.map((result, index) => (
                      <Card
                        key={index}
                        className="p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => goToSearchResult(result.globalPage)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {result.chapterTitle}
                            </p>
                            <p className="text-xs text-muted-foreground mb-1">
                              Page {result.globalPage + 1}
                            </p>
                            <p className="text-sm">{result.context}</p>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Highlight Menu */}
      <HighlightMenu />

      {/* Note Dialog */}
      <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm italic">"{selectedText}"</p>
            </div>
            <Textarea
              placeholder="Write your note..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowNoteDialog(false)}
              >
                Cancel
              </Button>
              <Button onClick={saveNote}>Save Note</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Click overlay to close highlight menu */}
      {showHighlightMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowHighlightMenu(false)}
        />
      )}

      <Button
        variant={readingMode === "scroll" ? "default" : "outline"}
        size="sm"
        onClick={() =>
          setReadingMode(readingMode === "page" ? "scroll" : "page")
        }
      >
        {readingMode === "scroll" ? "Scroll" : "Paged"}
      </Button>
    </div>
  );
}
