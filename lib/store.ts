import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface Book {
  id: string
  title: string
  author: string
  cover?: string
  type: 'txt' | 'epub' | 'pdf'
  content: string
  chapters: Chapter[]
  metadata?: any
  progress: number
  totalPages: number
  currentPage: number
  lastReadAt: Date
  addedAt: Date
  fileSize: number
  wordCount: number
  readingTime: number
  isFinished: boolean
  tags: string[]
}

export interface Chapter {
  id: string
  title: string
  startPage: number
  endPage: number
  content: string
}

export interface Highlight {
  id: string
  bookId: string
  text: string
  note?: string
  color: 'yellow' | 'blue' | 'green' | 'red'
  style: 'highlight' | 'underline' | 'wave'
  page: number
  position: {
    start: number
    end: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface Note {
  id: string
  bookId: string
  text: string
  note: string
  page: number
  chapterId: string
  position: {
    start: number
    end: number
  }
  createdAt: Date
  updatedAt: Date
}

export interface ReadingSession {
  id: string
  bookId: string
  startTime: Date
  endTime: Date
  pagesRead: number
  duration: number
}

export interface ReadingStats {
  totalBooksRead: number
  totalReadingTime: number
  totalPagesRead: number
  currentStreak: number
  longestStreak: number
  averageReadingTime: number
  booksThisMonth: number
  booksThisYear: number
  favoriteGenres: string[]
  readingGoal: number
  dailyReadingTime: { [date: string]: number }
}

export interface ReadingSettings {
  fontSize: number
  fontFamily: 'crimson' | 'merriweather' | 'source-serif' | 'inter'
  lineHeight: number
  pageWidth: number
  theme: 'light' | 'dark' | 'sepia' | 'paper' | 'green'
  pageTransition: 'slide' | 'fade' | 'flip'
  autoSave: boolean
  nightMode: boolean
  brightness: number
}

interface BookStore {
  books: Book[]
  highlights: Highlight[]
  notes: Note[]
  readingSessions: ReadingSession[]
  readingStats: ReadingStats
  settings: ReadingSettings
  currentBook: Book | null
  
  // Book actions
  addBook: (book: Omit<Book, 'id' | 'addedAt'>) => void
  removeBook: (bookId: string) => void
  updateBook: (bookId: string, updates: Partial<Book>) => void
  setCurrentBook: (book: Book | null) => void
  
  // Highlight actions
  addHighlight: (highlight: Omit<Highlight, 'id' | 'createdAt' | 'updatedAt'>) => void
  removeHighlight: (highlightId: string) => void
  updateHighlight: (highlightId: string, updates: Partial<Highlight>) => void
  
  // Note actions
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void
  removeNote: (noteId: string) => void
  updateNote: (noteId: string, updates: Partial<Note>) => void
  
  // Reading session actions
  startReadingSession: (bookId: string) => void
  endReadingSession: (sessionId: string, pagesRead: number) => void
  
  // Settings actions
  updateSettings: (settings: Partial<ReadingSettings>) => void
  
  // Stats actions
  updateStats: (stats: Partial<ReadingStats>) => void
  
  // Utility actions
  searchBooks: (query: string) => Book[]
  getBookHighlights: (bookId: string) => Highlight[]
  exportData: () => any
  importData: (data: any) => void
}

const defaultStats: ReadingStats = {
  totalBooksRead: 0,
  totalReadingTime: 0,
  totalPagesRead: 0,
  currentStreak: 0,
  longestStreak: 0,
  averageReadingTime: 0,
  booksThisMonth: 0,
  booksThisYear: 0,
  favoriteGenres: [],
  readingGoal: 12,
  dailyReadingTime: {}
}

const defaultSettings: ReadingSettings = {
  fontSize: 18,
  fontFamily: 'crimson',
  lineHeight: 1.7,
  pageWidth: 700,
  theme: 'light',
  pageTransition: 'slide',
  autoSave: true,
  nightMode: false,
  brightness: 100
}

export const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      books: [],
      highlights: [],
      notes: [],
      readingSessions: [],
      readingStats: defaultStats,
      settings: defaultSettings,
      currentBook: null,
      
      addBook: (bookData) => {
        console.log('添加书籍到存储:', bookData.title);
        
        try {
          // 内容检查
          if (!bookData.content || bookData.content.trim() === '' || bookData.content === 'No content available') {
            console.warn('书籍内容无效或为空，使用默认内容');
            bookData.content = `无法读取"${bookData.title}"的内容，请尝试重新导入。`;
          } else {
            console.log(`书籍"${bookData.title}"内容长度: ${bookData.content.length}`);
            
            // 如果内容过大，可能会导致性能问题，截断过长内容
            const maxContentLength = 1000000; // 约1MB文本
            if (bookData.content.length > maxContentLength) {
              console.warn(`书籍内容过大(${bookData.content.length}字符)，截断到${maxContentLength}字符`);
              bookData.content = bookData.content.substring(0, maxContentLength);
            }
          }
          
          // 章节检查和修复
          if (!bookData.chapters || bookData.chapters.length === 0) {
            console.warn('书籍章节为空，创建默认章节');
            bookData.chapters = [{
              id: 'chapter-1',
              title: '全文',
              content: bookData.content,
              startPage: 1,
              endPage: Math.max(1, Math.ceil(bookData.wordCount / 300))
            }];
          } else {
            // 章节内容也可能过大，逐个检查和截断
            const maxChapterLength = 500000; // 约500KB文本
            let validChapters = false;
            
            for (let i = 0; i < bookData.chapters.length; i++) {
              const chapter = bookData.chapters[i];
              
              if (chapter.content && chapter.content.trim() !== '') {
                validChapters = true;
                
                // 截断过长章节
                if (chapter.content.length > maxChapterLength) {
                  console.warn(`章节 "${chapter.title}" 内容过大(${chapter.content.length}字符)，截断到${maxChapterLength}字符`);
                  bookData.chapters[i].content = chapter.content.substring(0, maxChapterLength);
                }
              }
            }
            
            if (!validChapters) {
              console.warn('所有章节内容均为空，重置章节');
              bookData.chapters = [{
                id: 'chapter-1',
                title: '全文',
                content: bookData.content.substring(0, maxChapterLength),
                startPage: 1,
                endPage: Math.max(1, Math.ceil(bookData.wordCount / 300))
              }];
            }
          }
          
          // 确保必要字段存在
          const book: Book = {
            ...bookData,
            id: `book-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            addedAt: new Date(),
            progress: bookData.progress || 0,
            currentPage: bookData.currentPage || 0,
            lastReadAt: bookData.lastReadAt || new Date(),
            isFinished: bookData.isFinished || false,
            tags: bookData.tags || [],
            fileSize: bookData.fileSize || 0,
            readingTime: bookData.readingTime || 0
          }
          
          // 添加前再次确认书籍内容有效
          if (!book.content || book.content.trim() === '') {
            console.error('最终添加的书籍内容仍然为空，这将导致阅读问题');
          }
          
          console.log('开始更新状态...');
          set((state) => ({ books: [...state.books, book] }));
          console.log('状态更新完成');
        } catch (error) {
          console.error('添加书籍到存储时出错:', error);
          throw new Error(`添加书籍失败: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      
      removeBook: (bookId) => {
        set((state) => ({
          books: state.books.filter(book => book.id !== bookId),
          highlights: state.highlights.filter(highlight => highlight.bookId !== bookId),
          notes: state.notes.filter(note => note.bookId !== bookId),
          currentBook: state.currentBook?.id === bookId ? null : state.currentBook
        }))
      },
      
      updateBook: (bookId, updates) => {
        set((state) => ({
          books: state.books.map(book => 
            book.id === bookId ? { ...book, ...updates } : book
          ),
          currentBook: state.currentBook?.id === bookId 
            ? { ...state.currentBook, ...updates } 
            : state.currentBook
        }))
      },
      
      setCurrentBook: (book) => {
        set({ currentBook: book })
      },
      
      addHighlight: (highlightData) => {
        const highlight: Highlight = {
          ...highlightData,
          id: `highlight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({ highlights: [...state.highlights, highlight] }))
      },
      
      removeHighlight: (highlightId) => {
        set((state) => ({
          highlights: state.highlights.filter(highlight => highlight.id !== highlightId)
        }))
      },
      
      updateHighlight: (highlightId, updates) => {
        set((state) => ({
          highlights: state.highlights.map(highlight =>
            highlight.id === highlightId 
              ? { ...highlight, ...updates, updatedAt: new Date() }
              : highlight
          )
        }))
      },
      
      addNote: (noteData) => {
        const note: Note = {
          ...noteData,
          id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
        set((state) => ({ notes: [...state.notes, note] }))
      },
      
      removeNote: (noteId) => {
        set((state) => ({
          notes: state.notes.filter(note => note.id !== noteId)
        }))
      },
      
      updateNote: (noteId, updates) => {
        set((state) => ({
          notes: state.notes.map(note =>
            note.id === noteId 
              ? { ...note, ...updates, updatedAt: new Date() }
              : note
          )
        }))
      },
      
      startReadingSession: (bookId) => {
        const session: ReadingSession = {
          id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          bookId,
          startTime: new Date(),
          endTime: new Date(),
          pagesRead: 0,
          duration: 0
        }
        set((state) => ({ readingSessions: [...state.readingSessions, session] }))
      },
      
      endReadingSession: (sessionId, pagesRead) => {
        set((state) => ({
          readingSessions: state.readingSessions.map(session =>
            session.id === sessionId
              ? {
                  ...session,
                  endTime: new Date(),
                  pagesRead,
                  duration: Date.now() - session.startTime.getTime()
                }
              : session
          )
        }))
      },
      
      updateSettings: (newSettings) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }))
      },
      
      updateStats: (newStats) => {
        set((state) => ({
          readingStats: { ...state.readingStats, ...newStats }
        }))
      },
      
      searchBooks: (query) => {
        const { books } = get()
        const lowercaseQuery = query.toLowerCase()
        return books.filter(book =>
          book.title.toLowerCase().includes(lowercaseQuery) ||
          book.author.toLowerCase().includes(lowercaseQuery) ||
          book.tags.some(tag => tag.toLowerCase().includes(lowercaseQuery))
        )
      },
      
      getBookHighlights: (bookId) => {
        const { highlights } = get()
        return highlights.filter(highlight => highlight.bookId === bookId)
      },
      
      exportData: () => {
        const state = get()
        return {
          books: state.books,
          highlights: state.highlights,
          notes: state.notes,
          readingSessions: state.readingSessions,
          readingStats: state.readingStats,
          settings: state.settings,
          exportedAt: new Date().toISOString(),
          version: '1.0.0'
        }
      },
      
      importData: (data) => {
        if (data.version === '1.0.0') {
          set({
            books: data.books || [],
            highlights: data.highlights || [],
            notes: data.notes || [],
            readingSessions: data.readingSessions || [],
            readingStats: data.readingStats || defaultStats,
            settings: data.settings || defaultSettings,
          })
        }
      }
    }),
    {
      name: 'wereader-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        books: state.books,
        highlights: state.highlights,
        notes: state.notes,
        readingSessions: state.readingSessions,
        readingStats: state.readingStats,
        settings: state.settings,
      }),
    }
  )
)