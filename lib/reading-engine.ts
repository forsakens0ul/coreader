import { create } from 'zustand'
import { ParsedBook } from './book-parser'
import { Chapter } from './store'

export interface PageInfo {
  content: string
  chapterId: string
  chapterTitle: string
  pageInChapter: number
  totalPagesInChapter: number
  globalPage: number
  totalPages: number
}

// 阅读引擎类
export class ReadingEngine {
  private book: ParsedBook
  private pages: string[] = []
  private currentPage = 0
  private currentChapter = 0
  private fontSize = 18
  private fontFamily = 'Georgia, serif'
  private lineHeight = 1.5

  constructor(book: ParsedBook) {
    this.book = book;
    this.pages = this.splitIntoPages(book.content);
  }

  // 获取总页数
  getTotalPages(): number {
    return this.pages.length;
  }

  // 获取页面信息
  getPageInfo(pageIndex: number): PageInfo {
    if (pageIndex < 0 || pageIndex >= this.pages.length) {
      return {
        content: 'No content available',
        chapterId: 'unknown',
        chapterTitle: 'Unknown',
        pageInChapter: 0,
        totalPagesInChapter: 0,
        globalPage: pageIndex,
        totalPages: this.pages.length
      };
    }

    // 查找当前页面所在的章节
    const chapter = this.book.chapters.find(ch => 
      pageIndex >= ch.startPage - 1 && pageIndex < ch.endPage
    );

    if (!chapter) {
      return {
        content: this.pages[pageIndex],
        chapterId: 'unknown',
        chapterTitle: 'Unknown',
        pageInChapter: 0,
        totalPagesInChapter: 0,
        globalPage: pageIndex,
        totalPages: this.pages.length
      };
    }

    return {
      content: this.pages[pageIndex],
      chapterId: chapter.id,
      chapterTitle: chapter.title,
      pageInChapter: pageIndex - (chapter.startPage - 1),
      totalPagesInChapter: chapter.endPage - chapter.startPage + 1,
      globalPage: pageIndex,
      totalPages: this.pages.length
    };
  }

  // 重新分页
  repaginate(options: any): void {
    this.fontSize = options.fontSize || this.fontSize;
    this.fontFamily = options.fontFamily || this.fontFamily;
    this.lineHeight = options.lineHeight || this.lineHeight;
    
    this.pages = this.splitIntoPages(this.book.content, options);
  }

  // 更新内容
  updateContent(content: string): void {
    if (content && content.trim() !== '') {
      this.book.content = content;
      // 重新分页
      this.pages = this.splitIntoPages(content);
      console.log(`内容已更新，新页数: ${this.pages.length}`);
    } else {
      console.error('尝试更新内容为空，操作被取消');
    }
  }

  // 获取章节
  getChapters(): Chapter[] {
    return this.book.chapters || [];
  }

  // 获取章节第一页
  getChapterFirstPage(chapterId: string): number {
    const chapter = this.book.chapters.find(ch => ch.id === chapterId);
    if (chapter) {
      return Math.max(0, chapter.startPage - 1);
    }
    return 0;
  }

  // 搜索文本
  searchText(query: string): Array<{text: string, page: number}> {
    if (!query || !this.book.content) return [];
    
    const results: Array<{text: string, page: number}> = [];
    const queryLower = query.toLowerCase();
    
    // 在每一页中搜索
    for (let i = 0; i < this.pages.length; i++) {
      const pageContent = this.pages[i];
      if (pageContent.toLowerCase().includes(queryLower)) {
        // 提取匹配上下文
        const index = pageContent.toLowerCase().indexOf(queryLower);
        const start = Math.max(0, index - 20);
        const end = Math.min(pageContent.length, index + query.length + 20);
        const contextText = pageContent.substring(start, end);
        
        results.push({
          text: `...${contextText}...`,
          page: i
        });
      }
    }
    
    return results;
  }

  // 分页算法
  private splitIntoPages(content: string, options: any = {}): string[] {
    const finalOptions = {
      fontSize: this.fontSize,
      fontFamily: this.fontFamily,
      lineHeight: this.lineHeight,
      pageWidth: 800,
      pageHeight: 600,
      padding: 40,
      ...options
    };

    // 如果不在浏览器环境，使用简单分页
    if (typeof window === 'undefined') {
      return simpleSplitIntoPages(content, finalOptions);
    }

    try {
      // 使用Canvas测量文本进行精确分页
      return canvasSplitIntoPages(content, finalOptions);
    } catch (error) {
      console.error('使用Canvas分页失败，回退到简单分页:', error);
      return simpleSplitIntoPages(content, finalOptions);
    }
  }
}

interface ReadingEngineState {
  currentBook: ParsedBook | null
  currentPage: number
  currentChapter: number
  pages: string[]
  
  // 阅读设置
  fontSize: number
  fontFamily: string
  lineHeight: number
  theme: 'light' | 'dark' | 'sepia'
  
  // 阅读统计
  timeSpent: number
  lastReadTimestamp: number
  
  // 操作方法
  setBook: (book: ParsedBook) => void
  setPage: (page: number) => void
  setChapter: (chapter: number) => void
  nextPage: () => void
  prevPage: () => void
  updateReadingPreference: (prefs: Partial<{
    fontSize: number
    fontFamily: string
    lineHeight: number
    theme: 'light' | 'dark' | 'sepia'
  }>) => void
  getPageContent: () => string
  splitIntoPages: (content: string, options?: Partial<{
    fontSize: number
    fontFamily: string
    lineHeight: number
    pageWidth: number
    pageHeight: number
    padding: number
  }>) => string[]
  trackReadingTime: () => void
  resetEngine: () => void
}

const useReadingEngine = create<ReadingEngineState>((set, get) => ({
  currentBook: null,
  currentPage: 1,
  currentChapter: 0,
  pages: [],
  
  // 默认阅读设置
  fontSize: 18,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.5,
  theme: 'light',
  
  // 阅读统计
  timeSpent: 0,
  lastReadTimestamp: 0,
  
  setBook: (book: ParsedBook) => {
    if (!book || !book.content) {
      console.error('无效的书籍内容');
      return;
    }
    
    const { fontSize, fontFamily, lineHeight } = get();
    const options = { fontSize, fontFamily, lineHeight };
    
    // 先分割全部内容为页面
    const pages = get().splitIntoPages(book.content, options);
    
    set({ 
      currentBook: book, 
      currentPage: 1, 
      currentChapter: 0,
      pages,
      lastReadTimestamp: Date.now()
    });
    
    console.log(`书籍已加载: ${book.title}, 总页数: ${pages.length}`);
  },
  
  setPage: (page: number) => {
    const { pages, currentPage } = get();
    
    if (page < 1 || page > pages.length) {
      console.warn(`页码超出范围: ${page}, 有效范围: 1-${pages.length}`);
      return;
    }
    
    if (page !== currentPage) {
      set({ currentPage: page });
      get().trackReadingTime();
      
      // 更新当前章节
      const { currentBook } = get();
      if (currentBook) {
        const newChapter = currentBook.chapters.findIndex(chapter => 
          page >= chapter.startPage && page <= chapter.endPage
        );
        
        if (newChapter !== -1 && newChapter !== get().currentChapter) {
          set({ currentChapter: newChapter });
        }
      }
    }
  },
  
  setChapter: (chapter: number) => {
    const { currentBook } = get();
    
    if (!currentBook || chapter < 0 || chapter >= currentBook.chapters.length) {
      console.warn('无效的章节索引');
      return;
    }
    
    const startPage = currentBook.chapters[chapter].startPage;
    set({ currentChapter: chapter });
    get().setPage(startPage);
  },
  
  nextPage: () => {
    const { currentPage, pages } = get();
    
    if (currentPage < pages.length) {
      get().setPage(currentPage + 1);
    }
  },
  
  prevPage: () => {
    const { currentPage } = get();
    
    if (currentPage > 1) {
      get().setPage(currentPage - 1);
    }
  },
  
  updateReadingPreference: (prefs) => {
    const currentPrefs = {
      fontSize: get().fontSize,
      fontFamily: get().fontFamily,
      lineHeight: get().lineHeight,
      theme: get().theme
    };
    
    const newPrefs = { ...currentPrefs, ...prefs };
    set(newPrefs);
    
    // 如果文本排版相关设置有变化，需要重新分页
    if (
      prefs.fontSize !== undefined || 
      prefs.fontFamily !== undefined || 
      prefs.lineHeight !== undefined
    ) {
      const { currentBook } = get();
      if (currentBook) {
        const currentPageProgress = get().currentPage / get().pages.length;
        const pages = get().splitIntoPages(currentBook.content, newPrefs);
        const newPage = Math.max(1, Math.min(
          Math.round(currentPageProgress * pages.length),
          pages.length
        ));
        
        set({ pages, currentPage: newPage });
      }
    }
  },
  
  getPageContent: () => {
    const { pages, currentPage } = get();
    
    if (currentPage < 1 || currentPage > pages.length) {
      return '无内容';
    }
    
    return pages[currentPage - 1];
  },
  
  splitIntoPages: (content: string, options = {}) => {
    // 获取当前设置并合并新的选项
    const defaultOptions = {
      fontSize: get().fontSize,
      fontFamily: get().fontFamily,
      lineHeight: get().lineHeight,
      pageWidth: 800,     // 默认页面宽度
      pageHeight: 600,    // 默认页面高度
      padding: 40         // 内边距
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // 如果不在浏览器环境，使用简单分页
    if (typeof window === 'undefined') {
      return simpleSplitIntoPages(content, finalOptions);
    }
    
    try {
      // 使用Canvas测量文本进行精确分页
      return canvasSplitIntoPages(content, finalOptions);
    } catch (error) {
      console.error('使用Canvas分页失败，回退到简单分页:', error);
      return simpleSplitIntoPages(content, finalOptions);
    }
  },
  
  trackReadingTime: () => {
    const now = Date.now();
    const { lastReadTimestamp, timeSpent } = get();
    
    if (lastReadTimestamp > 0) {
      // 计算本次阅读时间（上限为30分钟，防止用户离开但未关闭页面）
      const sessionTime = Math.min(now - lastReadTimestamp, 30 * 60 * 1000);
      set({ 
        timeSpent: timeSpent + sessionTime,
        lastReadTimestamp: now
      });
    } else {
      set({ lastReadTimestamp: now });
    }
  },
  
  resetEngine: () => {
    set({
      currentBook: null,
      currentPage: 1,
      currentChapter: 0,
      pages: [],
      lastReadTimestamp: 0
    });
  }
}));

// 简单分页算法
function simpleSplitIntoPages(
  content: string, 
  options: {
    fontSize: number,
    lineHeight: number,
    pageWidth: number,
    pageHeight: number,
    padding: number,
    fontFamily: string
  }
): string[] {
  // 估算每页字符数
  const charsPerLine = Math.floor((options.pageWidth - 2 * options.padding) / (options.fontSize * 0.6));
  const linesPerPage = Math.floor((options.pageHeight - 2 * options.padding) / (options.fontSize * options.lineHeight));
  
  // 考虑中文和英文混排的情况
  const isMostlyChinese = (content.match(/[\u4e00-\u9fff]/g) || []).length > content.length * 0.5;
  
  let charsPerPage: number;
  
  if (isMostlyChinese) {
    // 中文文本处理
    // 中文字符宽度基本相同，每行可容纳字符数较稳定
    charsPerPage = charsPerLine * linesPerPage;
    
    // 分割文本 - 确保在自然段落和句子边界处分页
    const paragraphs = content.split(/\n+/);
    const pages: string[] = [];
    let currentPage = '';
    let currentLength = 0;
    
    for (const paragraph of paragraphs) {
      // 如果段落本身就超长，需要分割
      if (paragraph.length > charsPerPage * 1.5) {
        // 尝试在句子边界分割
        const sentences = paragraph.split(/(?<=[。！？.!?])/);
        
        for (const sentence of sentences) {
          if (currentLength + sentence.length > charsPerPage && currentLength > 0) {
            pages.push(currentPage);
            currentPage = sentence;
            currentLength = sentence.length;
          } else {
            if (currentPage && !currentPage.endsWith('\n')) {
              currentPage += '\n';
            }
            currentPage += sentence;
            currentLength += sentence.length;
          }
        }
      } else {
        // 正常段落处理
        if (currentLength + paragraph.length > charsPerPage && currentLength > 0) {
          pages.push(currentPage);
          currentPage = paragraph;
          currentLength = paragraph.length;
        } else {
          if (currentPage) {
            currentPage += '\n\n';
            currentLength += 2;
          }
          currentPage += paragraph;
          currentLength += paragraph.length;
        }
      }
    }
    
    // 添加最后一页
    if (currentPage) {
      pages.push(currentPage);
    }
    
    return pages;
  } else {
    // 英文文本处理
    // 英文单词长度不一，使用单词计数
    const wordsPerPage = Math.floor(charsPerLine * linesPerPage / 5); // 假设平均单词长度为5
    
    // 分割文本，按单词计数并尊重段落
    const paragraphs = content.split(/\n+/);
    const pages: string[] = [];
    let currentPage = '';
    let wordCount = 0;
    
    for (const paragraph of paragraphs) {
      const words = paragraph.split(/\s+/);
      
      if (wordCount + words.length > wordsPerPage && wordCount > 0) {
        pages.push(currentPage);
        currentPage = paragraph;
        wordCount = words.length;
      } else {
        if (currentPage) {
          currentPage += '\n\n';
        }
        currentPage += paragraph;
        wordCount += words.length;
      }
    }
    
    // 添加最后一页
    if (currentPage) {
      pages.push(currentPage);
    }
    
    return pages;
  }
}

// 使用Canvas进行更精确的文本测量和分页
function canvasSplitIntoPages(
  content: string, 
  options: {
    fontSize: number,
    fontFamily: string,
    lineHeight: number,
    pageWidth: number,
    pageHeight: number,
    padding: number
  }
): string[] {
  // 创建Canvas上下文进行文本测量
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    console.error('无法创建Canvas上下文，回退到简单分页');
    return simpleSplitIntoPages(content, options);
  }
  
  ctx.font = `${options.fontSize}px ${options.fontFamily}`;
  
  const effectiveWidth = options.pageWidth - 2 * options.padding;
  const effectiveHeight = options.pageHeight - 2 * options.padding;
  const lineHeight = options.fontSize * options.lineHeight;
  const linesPerPage = Math.floor(effectiveHeight / lineHeight);
  
  // 检测是否主要是中文内容
  const isMostlyChinese = (content.match(/[\u4e00-\u9fff]/g) || []).length > content.length * 0.3;
  
  // 根据内容类型选择不同的分页策略
  if (isMostlyChinese) {
    // 中文内容分页 - 按字符处理
    return chineseTextPagination(content, ctx, {
      effectiveWidth,
      linesPerPage,
      lineHeight
    });
  } else {
    // 英文内容分页 - 按单词处理
    return englishTextPagination(content, ctx, {
      effectiveWidth,
      linesPerPage,
      lineHeight
    });
  }
}

// 中文文本分页
function chineseTextPagination(
  content: string,
  ctx: CanvasRenderingContext2D,
  options: {
    effectiveWidth: number,
    linesPerPage: number,
    lineHeight: number
  }
): string[] {
  const paragraphs = content.split(/\n+/);
  const pages: string[] = [];
  let currentPageLines: string[] = [];
  let currentLine = '';
  
  for (const paragraph of paragraphs) {
    // 空段落处理
    if (!paragraph.trim()) {
      if (currentLine) {
        currentPageLines.push(currentLine);
        currentLine = '';
      }
      currentPageLines.push('');
      
      // 检查是否需要创建新页面
      if (currentPageLines.length >= options.linesPerPage) {
        pages.push(currentPageLines.join('\n'));
        currentPageLines = [];
      }
      continue;
    }
    
    // 逐字符处理段落
    for (let i = 0; i < paragraph.length; i++) {
      const char = paragraph[i];
      const testLine = currentLine + char;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > options.effectiveWidth) {
        // 当前行已满，添加到页面
        currentPageLines.push(currentLine);
        currentLine = char;
        
        // 检查是否需要创建新页面
        if (currentPageLines.length >= options.linesPerPage) {
          pages.push(currentPageLines.join('\n'));
          currentPageLines = [];
        }
      } else {
        currentLine = testLine;
      }
    }
    
    // 处理段落结束
    if (currentLine) {
      currentPageLines.push(currentLine);
      currentLine = '';
      
      // 检查是否需要创建新页面
      if (currentPageLines.length >= options.linesPerPage) {
        pages.push(currentPageLines.join('\n'));
        currentPageLines = [];
      }
    }
  }
  
  // 添加最后一页
  if (currentPageLines.length > 0 || currentLine) {
    if (currentLine) {
      currentPageLines.push(currentLine);
    }
    pages.push(currentPageLines.join('\n'));
  }
  
  return pages;
}

// 英文文本分页
function englishTextPagination(
  content: string,
  ctx: CanvasRenderingContext2D,
  options: {
    effectiveWidth: number,
    linesPerPage: number,
    lineHeight: number
  }
): string[] {
  const paragraphs = content.split(/\n+/);
  const pages: string[] = [];
  let currentPageLines: string[] = [];
  let currentLine = '';
  
  for (const paragraph of paragraphs) {
    // 空段落处理
    if (!paragraph.trim()) {
      if (currentLine) {
        currentPageLines.push(currentLine);
        currentLine = '';
      }
      currentPageLines.push('');
      
      // 检查是否需要创建新页面
      if (currentPageLines.length >= options.linesPerPage) {
        pages.push(currentPageLines.join('\n'));
        currentPageLines = [];
      }
      continue;
    }
    
    // 按单词分割段落
    const words = paragraph.split(/\s+/);
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > options.effectiveWidth && currentLine) {
        // 当前行已满，添加到页面
        currentPageLines.push(currentLine);
        currentLine = word;
        
        // 检查是否需要创建新页面
        if (currentPageLines.length >= options.linesPerPage) {
          pages.push(currentPageLines.join('\n'));
          currentPageLines = [];
        }
      } else {
        currentLine = testLine;
      }
    }
    
    // 处理段落结束
    if (currentLine) {
      currentPageLines.push(currentLine);
      currentLine = '';
      
      // 检查是否需要创建新页面
      if (currentPageLines.length >= options.linesPerPage) {
        pages.push(currentPageLines.join('\n'));
        currentPageLines = [];
      }
    }
  }
  
  // 添加最后一页
  if (currentPageLines.length > 0 || currentLine) {
    if (currentLine) {
      currentPageLines.push(currentLine);
    }
    pages.push(currentPageLines.join('\n'));
  }
  
  return pages;
}

export default useReadingEngine