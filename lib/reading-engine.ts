export interface ReadingPosition {
  chapterId: string
  pageInChapter: number
  globalPage: number
  progress: number
}

export interface PageInfo {
  content: string
  chapterId: string
  chapterTitle: string
  pageInChapter: number
  totalPagesInChapter: number
  globalPage: number
  totalPages: number
}

export class ReadingEngine {
  private book: any
  private pages: string[] = []
  private chapterPages: Map<string, string[]> = new Map()
  private pageToChapter: Map<number, string> = new Map()
  
  constructor(book: any) {
    this.book = book
    this.initializePages()
  }
  
  private initializePages() {
    let globalPageIndex = 0
    
    // 确保有内容可以显示
    let chapters = this.book.chapters || []
    
    // 如果没有章节或章节为空，从主内容创建章节
    if (chapters.length === 0 || chapters.every((c: any) => !c.content || !c.content.trim())) {
      const content = this.book.content || 'No content available'
      chapters = [{
        id: 'chapter-1',
        title: this.book.title || 'Full Text',
        content: content,
        startPage: 0,
        endPage: 0
      }]
      this.book.chapters = chapters
    }
    
    for (const chapter of chapters) {
      let chapterContent = chapter.content || ''
      
      // 如果章节内容为空，使用书籍主内容
      if (!chapterContent.trim()) {
        chapterContent = this.book.content || `Chapter content for ${chapter.title}`
      }
      
      // 确保内容不为空
      if (!chapterContent.trim()) {
        chapterContent = `Content for ${chapter.title || 'Chapter'}`
      }
      
      const wordCount = this.countWords(chapterContent)
      const chapterPageCount = Math.max(1, Math.ceil(wordCount / 300))
      const chapterPages: string[] = []
      
      // Split chapter content into pages
      const words = chapterContent.split(' ')
      const wordsPerPage = Math.max(50, Math.ceil(words.length / chapterPageCount))
      
      for (let i = 0; i < words.length; i += wordsPerPage) {
        const pageContent = words.slice(i, i + wordsPerPage).join(' ')
        if (pageContent.trim()) {
          chapterPages.push(pageContent)
          this.pages.push(pageContent)
          this.pageToChapter.set(globalPageIndex, chapter.id)
          globalPageIndex++
        }
      }
      
      // 确保每个章节至少有一页
      if (chapterPages.length === 0) {
        const fallbackContent = chapterContent || `Content for ${chapter.title}`
        chapterPages.push(fallbackContent)
        this.pages.push(fallbackContent)
        this.pageToChapter.set(globalPageIndex, chapter.id)
        globalPageIndex++
      }
      
      this.chapterPages.set(chapter.id, chapterPages)
    }
    
    // 确保至少有一页内容
    if (this.pages.length === 0) {
      const fallbackContent = this.book.content || `Welcome to ${this.book.title || 'this book'}!\n\nThis appears to be an empty book or the content could not be loaded properly. Please try importing the book again.`
      this.pages.push(fallbackContent)
      this.pageToChapter.set(0, 'chapter-1')
      this.chapterPages.set('chapter-1', [fallbackContent])
      
      // 确保有章节信息
      if (!this.book.chapters || this.book.chapters.length === 0) {
        this.book.chapters = [{
          id: 'chapter-1',
          title: this.book.title || 'Full Text',
          content: fallbackContent,
          startPage: 0,
          endPage: 0
        }]
      }
    }
  }
  
  getPageInfo(globalPage: number): PageInfo | null {
    // 确保页面索引有效
    if (globalPage < 0 || globalPage >= this.pages.length) {
      // 如果页面索引无效，返回第一页或最后一页
      if (this.pages.length > 0) {
        const validPage = Math.max(0, Math.min(globalPage, this.pages.length - 1))
        return this.getPageInfo(validPage)
      }
      return null
    }
    
    const chapterId = this.pageToChapter.get(globalPage)
    if (!chapterId) return null
    
    const chapter = this.book.chapters.find((c: any) => c.id === chapterId)
    if (!chapter) {
      // 如果找不到章节，使用第一个章节
      const firstChapter = this.book.chapters[0]
      if (firstChapter) {
        return {
          content: this.pages[globalPage] || 'No content',
          chapterId: firstChapter.id,
          chapterTitle: firstChapter.title,
          pageInChapter: 0,
          totalPagesInChapter: 1,
          globalPage,
          totalPages: this.pages.length
        }
      }
      return null
    }
    
    const chapterPages = this.chapterPages.get(chapterId) || []
    const pageInChapter = this.getPageInChapter(globalPage, chapterId)
    
    return {
      content: this.pages[globalPage] || 'No content available',
      chapterId,
      chapterTitle: chapter.title,
      pageInChapter,
      totalPagesInChapter: Math.max(1, chapterPages.length),
      globalPage,
      totalPages: Math.max(1, this.pages.length)
    }
  }
  
  private getPageInChapter(globalPage: number, chapterId: string): number {
    let pageCount = 0
    for (let i = 0; i <= globalPage; i++) {
      if (this.pageToChapter.get(i) === chapterId) {
        if (i === globalPage) return pageCount
        pageCount++
      } else if (this.pageToChapter.get(i) !== chapterId && pageCount > 0) {
        pageCount = 0
      }
    }
    return pageCount
  }
  
  getChapterFirstPage(chapterId: string): number {
    for (let i = 0; i < this.pages.length; i++) {
      if (this.pageToChapter.get(i) === chapterId) {
        return i
      }
    }
    return 0
  }
  
  getPosition(globalPage: number): ReadingPosition {
    const chapterId = this.pageToChapter.get(globalPage) || this.book.chapters[0]?.id
    const pageInChapter = this.getPageInChapter(globalPage, chapterId)
    const progress = Math.round((globalPage / this.pages.length) * 100)
    
    return {
      chapterId,
      pageInChapter,
      globalPage,
      progress
    }
  }
  
  searchText(query: string): Array<{
    chapterId: string
    chapterTitle: string
    pageInChapter: number
    globalPage: number
    context: string
    matchIndex: number
  }> {
    const results: Array<{
      chapterId: string
      chapterTitle: string
      pageInChapter: number
      globalPage: number
      context: string
      matchIndex: number
    }> = []
    
    const searchTerm = query.toLowerCase()
    
    for (let globalPage = 0; globalPage < this.pages.length; globalPage++) {
      const pageContent = this.pages[globalPage].toLowerCase()
      const chapterId = this.pageToChapter.get(globalPage)
      
      if (!chapterId) continue
      
      const chapter = this.book.chapters.find((c: any) => c.id === chapterId)
      if (!chapter) continue
      
      let searchIndex = 0
      while ((searchIndex = pageContent.indexOf(searchTerm, searchIndex)) !== -1) {
        const contextStart = Math.max(0, searchIndex - 50)
        const contextEnd = Math.min(pageContent.length, searchIndex + searchTerm.length + 50)
        const context = this.pages[globalPage].substring(contextStart, contextEnd)
        
        results.push({
          chapterId,
          chapterTitle: chapter.title,
          pageInChapter: this.getPageInChapter(globalPage, chapterId),
          globalPage,
          context,
          matchIndex: searchIndex
        })
        
        searchIndex += searchTerm.length
      }
    }
    
    return results
  }
  
  getTotalPages(): number {
    return this.pages.length
  }
  
  getChapters(): Array<{
    id: string
    title: string
    startPage: number
    endPage: number
    pageCount: number
  }> {
    return this.book.chapters.map((chapter: any) => ({
      id: chapter.id,
      title: chapter.title,
      startPage: this.getChapterFirstPage(chapter.id),
      endPage: this.getChapterFirstPage(chapter.id) + (this.chapterPages.get(chapter.id)?.length || 1) - 1,
      pageCount: this.chapterPages.get(chapter.id)?.length || 1
    }))
  }
  
  private countWords(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    return chineseChars + englishWords
  }
  
  // Advanced pagination with canvas measurement
  repaginate(options: {
    fontSize: number
    fontFamily: string
    lineHeight: number
    pageWidth: number
    pageHeight: number
    padding: number
  }) {
    this.pages = []
    this.chapterPages.clear()
    this.pageToChapter.clear()
    
    let globalPageIndex = 0
    
    for (const chapter of this.book.chapters) {
      const { pages } = this.measureTextPages(chapter.content, options)
      
      this.chapterPages.set(chapter.id, pages)
      
      for (const page of pages) {
        this.pages.push(page)
        this.pageToChapter.set(globalPageIndex, chapter.id)
        globalPageIndex++
      }
    }
  }
  
  private measureTextPages(
    text: string,
    options: {
      fontSize: number
      fontFamily: string
      lineHeight: number
      pageWidth: number
      pageHeight: number
      padding: number
    }
  ): { pages: string[] } {
    if (typeof window === 'undefined') {
      // Fallback for server-side
      const wordsPerPage = 300
      const words = text.split(' ')
      const pages: string[] = []
      
      for (let i = 0; i < words.length; i += wordsPerPage) {
        pages.push(words.slice(i, i + wordsPerPage).join(' '))
      }
      
      return { pages }
    }
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    ctx.font = `${options.fontSize}px ${options.fontFamily}`
    
    const maxWidth = options.pageWidth - (options.padding * 2)
    const maxHeight = options.pageHeight - (options.padding * 2)
    const lineHeight = options.fontSize * options.lineHeight
    const maxLines = Math.floor(maxHeight / lineHeight)
    
    const paragraphs = text.split('\n\n')
    const pages: string[] = []
    let currentPage: string[] = []
    let currentLineCount = 0
    
    for (const paragraph of paragraphs) {
      const lines = this.wrapText(ctx, paragraph, maxWidth)
      
      // Check if paragraph fits on current page
      if (currentLineCount + lines.length > maxLines && currentPage.length > 0) {
        // Start new page
        pages.push(currentPage.join('\n'))
        currentPage = []
        currentLineCount = 0
      }
      
      // Add paragraph to current page
      if (lines.length <= maxLines - currentLineCount) {
        currentPage.push(...lines)
        currentLineCount += lines.length
        
        // Add spacing between paragraphs
        if (currentLineCount < maxLines) {
          currentPage.push('')
          currentLineCount++
        }
      } else {
        // Split paragraph across pages
        let remainingLines = [...lines]
        
        while (remainingLines.length > 0) {
          const availableLines = maxLines - currentLineCount
          const linesToAdd = remainingLines.splice(0, availableLines)
          
          currentPage.push(...linesToAdd)
          currentLineCount += linesToAdd.length
          
          if (remainingLines.length > 0) {
            pages.push(currentPage.join('\n'))
            currentPage = []
            currentLineCount = 0
          }
        }
      }
    }
    
    // Add remaining content
    if (currentPage.length > 0) {
      pages.push(currentPage.join('\n'))
    }
    
    return { pages }
  }
  
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    
    if (currentLine) {
      lines.push(currentLine)
    }
    
    return lines
  }
}