import ePub from 'epubjs'
import * as pdfjsLib from 'pdfjs-dist'

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
}

export interface ParsedBook {
  title: string
  author: string
  content: string
  chapters: Array<{
    id: string
    title: string
    startPage: number
    endPage: number
    content: string
    href?: string
  }>
  wordCount: number
  totalPages: number
  cover?: string
  metadata?: any
}

export class BookParser {
  static async parseText(file: File): Promise<ParsedBook> {
    const text = await file.text()
    const lines = text.split('\n').filter(line => line.trim())
    
    // Extract title and author from filename or content
    const filename = file.name.replace(/\.[^/.]+$/, '')
    const title = this.extractTitle(filename, lines)
    const author = this.extractAuthor(lines)
    
    // Parse chapters using advanced algorithm
    const chapters = this.parseTextChapters(text)
    const wordCount = this.countWords(text)
    const totalPages = this.calculatePages(text)
    
    return {
      title,
      author,
      content: text,
      chapters,
      wordCount,
      totalPages
    }
  }
  
  static async parseEpub(file: File): Promise<ParsedBook> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const book = ePub(arrayBuffer)
      
      // Load the book
      await book.ready
      
      // Get metadata
      const metadata = await book.loaded.metadata
      const navigation = await book.loaded.navigation
      
      const title = metadata.title || file.name.replace(/\.[^/.]+$/, '')
      const author = metadata.creator || 'Unknown Author'
      
      // Get cover image
      let cover: string | undefined
      try {
        const coverUrl = await book.coverUrl()
        if (coverUrl && coverUrl !== 'undefined') {
          cover = coverUrl
        }
      } catch (e) {
        console.log('No cover found')
      }
      
      // Extract chapters
      const chapters: Array<{
        id: string
        title: string
        startPage: number
        endPage: number
        content: string
        href?: string
      }> = []
      
      let fullContent = ''
      let currentPage = 1
      
      // Process each spine item
      for (let i = 0; i < book.spine.length; i++) {
        const spineItem = book.spine.get(i)
        
        try {
          // Load the chapter content
          const doc = await spineItem.load(book.load.bind(book))
          const textContent = this.extractTextFromHTML(doc.documentElement.innerHTML)
          
          // Find chapter title from navigation or use spine item
          let chapterTitle = `Chapter ${i + 1}`
          const navItem = navigation.toc.find((item: any) => 
            item.href === spineItem.href || 
            spineItem.href.includes(item.href.split('#')[0])
          )
          if (navItem) {
            chapterTitle = navItem.label
          }
          
          const chapterWordCount = this.countWords(textContent)
          const chapterPages = Math.ceil(chapterWordCount / 300)
          
          chapters.push({
            id: spineItem.idref || `chapter-${i + 1}`,
            title: chapterTitle,
            startPage: currentPage,
            endPage: currentPage + chapterPages - 1,
            content: textContent,
            href: spineItem.href
          })
          
          fullContent += textContent + '\n\n'
          currentPage += chapterPages
          
          // Unload to free memory
          spineItem.unload()
        } catch (error) {
          console.error(`Error loading chapter ${i}:`, error)
        }
      }
      
      const wordCount = this.countWords(fullContent)
      const totalPages = this.calculatePages(fullContent)
      
      return {
        title,
        author,
        content: fullContent,
        chapters,
        wordCount,
        totalPages,
        cover,
        metadata
      }
    } catch (error) {
      console.error('Error parsing EPUB:', error)
      throw new Error(`Failed to parse EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  static async parsePdf(file: File): Promise<ParsedBook> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      
      const title = file.name.replace(/\.[^/.]+$/, '')
      let author = 'Unknown Author'
      let fullContent = ''
      
      // Try to get metadata
      try {
        const metadata = await pdf.getMetadata()
        if (metadata.info.Title) {
          // title = metadata.info.Title
        }
        if (metadata.info.Author) {
          author = metadata.info.Author
        }
      } catch (e) {
        console.log('No PDF metadata found')
      }
      
      // Extract text from all pages
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          const page = await pdf.getPage(i)
          const textContent = await page.getTextContent()
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ')
          pages.push(pageText)
          fullContent += pageText + '\n\n'
        } catch (error) {
          console.error(`Error extracting text from page ${i}:`, error)
          pages.push('')
        }
      }
      
      // Create chapters based on page groups (every 10 pages or logical breaks)
      const chapters: Array<{
        id: string
        title: string
        startPage: number
        endPage: number
        content: string
      }> = []
      
      const pagesPerChapter = Math.max(1, Math.floor(pdf.numPages / 10))
      for (let i = 0; i < pdf.numPages; i += pagesPerChapter) {
        const endPage = Math.min(i + pagesPerChapter, pdf.numPages)
        const chapterContent = pages.slice(i, endPage).join('\n\n')
        
        chapters.push({
          id: `chapter-${Math.floor(i / pagesPerChapter) + 1}`,
          title: `Pages ${i + 1}-${endPage}`,
          startPage: i + 1,
          endPage: endPage,
          content: chapterContent
        })
      }
      
      const wordCount = this.countWords(fullContent)
      
      return {
        title,
        author,
        content: fullContent,
        chapters,
        wordCount,
        totalPages: pdf.numPages,
        metadata: { originalPages: pdf.numPages }
      }
    } catch (error) {
      console.error('Error parsing PDF:', error)
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  private static extractTextFromHTML(html: string): string {
    // Create a temporary DOM element to extract text
    if (typeof window !== 'undefined') {
      const tempDiv = document.createElement('div')
      tempDiv.innerHTML = html
      return tempDiv.textContent || tempDiv.innerText || ''
    } else {
      // Server-side: simple HTML tag removal
      return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    }
  }
  
  private static extractTitle(filename: string, lines: string[]): string {
    // Try to find title in first few lines
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim()
      if (line.length > 0 && line.length < 100 && 
          !line.includes('作者') && !line.includes('Author') &&
          !line.includes('Chapter') && !line.includes('第') &&
          !this.isChapterTitle(line)) {
        return line
      }
    }
    return filename
  }
  
  private static extractAuthor(lines: string[]): string {
    // Look for author patterns
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      const line = lines[i].trim().toLowerCase()
      if (line.includes('作者') || line.includes('author') || line.includes('by ')) {
        return lines[i].replace(/^(作者|author|by)\s*[:：]\s*/i, '').trim()
      }
    }
    return 'Unknown Author'
  }
  
  private static parseTextChapters(text: string): Array<{
    id: string
    title: string
    startPage: number
    endPage: number
    content: string
  }> {
    const lines = text.split('\n')
    const chapters: Array<{
      id: string
      title: string
      startPage: number
      endPage: number
      content: string
    }> = []
    
    let currentChapter: any = null
    let chapterContent: string[] = []
    let pageCount = 1
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Check if this line is a chapter title
      if (this.isChapterTitle(line)) {
        // Save previous chapter
        if (currentChapter) {
          const content = chapterContent.join('\n')
          const pages = this.calculatePages(content)
          
          currentChapter.endPage = pageCount + pages - 1
          currentChapter.content = content
          chapters.push(currentChapter)
          pageCount += pages
        }
        
        // Start new chapter
        currentChapter = {
          id: `chapter-${chapters.length + 1}`,
          title: line,
          startPage: pageCount,
          endPage: pageCount,
          content: ''
        }
        chapterContent = []
      } else if (currentChapter) {
        chapterContent.push(line)
      } else {
        // Content before first chapter
        chapterContent.push(line)
      }
    }
    
    // Add last chapter
    if (currentChapter) {
      const content = chapterContent.join('\n')
      const pages = this.calculatePages(content)
      
      currentChapter.endPage = pageCount + pages - 1
      currentChapter.content = content
      chapters.push(currentChapter)
    } else if (chapterContent.length > 0) {
      // If no chapters found, create a single chapter
      const content = chapterContent.join('\n')
      chapters.push({
        id: 'chapter-1',
        title: 'Full Text',
        startPage: 1,
        endPage: this.calculatePages(content),
        content
      })
    }
    
    // If no chapters found, create a single chapter
    if (chapters.length === 0) {
      chapters.push({
        id: 'chapter-1',
        title: 'Full Text',
        startPage: 1,
        endPage: this.calculatePages(text),
        content: text
      })
    }
    
    // 确保每个章节都有内容
    chapters.forEach((chapter, index) => {
      if (!chapter.content || chapter.content.trim() === '') {
        chapter.content = `Chapter ${index + 1} content`
      }
    })
    
    return chapters
  }
  
  private static isChapterTitle(line: string): boolean {
    const chapterPatterns = [
      /^第\s*[一二三四五六七八九十百千万\d]+\s*[章节]/,
      /^Chapter\s+\d+/i,
      /^第\d+章/,
      /^\d+\.\s*[^\d]/,
      /^[一二三四五六七八九十百千万]+、/,
      /^序章|^前言|^后记|^附录/,
      /^CHAPTER\s+[IVXLCDM]+/i,
      /^Part\s+\d+/i,
      /^卷\s*[一二三四五六七八九十]/
    ]
    
    return chapterPatterns.some(pattern => pattern.test(line.trim()))
  }
  
  private static countWords(text: string): number {
    // Count Chinese characters and English words
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length
    return chineseChars + englishWords
  }
  
  private static calculatePages(text: string, wordsPerPage: number = 300): number {
    const wordCount = this.countWords(text)
    return Math.max(1, Math.ceil(wordCount / wordsPerPage))
  }
  
  // Canvas-based text measurement for precise pagination
  static measureTextPages(
    text: string, 
    options: {
      fontSize: number
      fontFamily: string
      lineHeight: number
      pageWidth: number
      pageHeight: number
      padding: number
    }
  ): { pages: string[], totalPages: number } {
    if (typeof window === 'undefined') {
      // Fallback for server-side
      const wordsPerPage = Math.floor((options.pageWidth * options.pageHeight) / (options.fontSize * options.lineHeight * 10))
      const words = text.split(' ')
      const pages: string[] = []
      
      for (let i = 0; i < words.length; i += wordsPerPage) {
        pages.push(words.slice(i, i + wordsPerPage).join(' '))
      }
      
      return { pages, totalPages: pages.length }
    }
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    ctx.font = `${options.fontSize}px ${options.fontFamily}`
    
    const maxWidth = options.pageWidth - (options.padding * 2)
    const maxHeight = options.pageHeight - (options.padding * 2)
    const lineHeight = options.fontSize * options.lineHeight
    const maxLines = Math.floor(maxHeight / lineHeight)
    
    const words = text.split(' ')
    const pages: string[] = []
    let currentPage: string[] = []
    let currentLine = ''
    let lineCount = 0
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width > maxWidth && currentLine) {
        // Line is too long, start new line
        currentPage.push(currentLine)
        currentLine = word
        lineCount++
        
        if (lineCount >= maxLines) {
          // Page is full
          pages.push(currentPage.join('\n'))
          currentPage = []
          lineCount = 0
        }
      } else {
        currentLine = testLine
      }
    }
    
    // Add remaining content
    if (currentLine) {
      currentPage.push(currentLine)
    }
    if (currentPage.length > 0) {
      pages.push(currentPage.join('\n'))
    }
    
    return { pages, totalPages: pages.length }
  }
}