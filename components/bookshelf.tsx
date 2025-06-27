"use client"

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Book, Plus, Search, Filter, Grid, List, Star, Clock, BookOpen, MoreHorizontal } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useBookStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface BookshelfProps {
  onImportBook: () => void
  onOpenBook: (book: any) => void
}

export function Bookshelf({ onImportBook, onOpenBook }: BookshelfProps) {
  const { books, searchBooks } = useBookStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [activeTab, setActiveTab] = useState('all')

  const filteredBooks = searchQuery ? searchBooks(searchQuery) : books

  const booksByCategory = {
    all: filteredBooks,
    reading: filteredBooks.filter(book => book.progress > 0 && book.progress < 100),
    finished: filteredBooks.filter(book => book.isFinished),
    unread: filteredBooks.filter(book => book.progress === 0)
  }

  const getCategoryBooks = (category: string) => booksByCategory[category as keyof typeof booksByCategory] || []

  const BookCard = ({ book, index }: { book: any; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="group"
    >
      <Card className="h-full cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105">
        <CardHeader className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div 
                className="aspect-[3/4] bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden"
                onClick={() => onOpenBook(book)}
              >
                {book.cover && book.cover !== 'undefined' ? (
                  <img 
                    src={book.cover} 
                    alt={book.title} 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 如果图片加载失败，隐藏图片显示默认图标
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Book className="w-8 h-8 text-white" />
                  </div>
                )}
                {book.cover && book.cover !== 'undefined' && (
                  <div className="absolute inset-0 flex items-center justify-center" style={{ display: 'none' }}>
                    <Book className="w-8 h-8 text-white" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              
              <h3 className="font-semibold text-sm leading-tight mb-1 line-clamp-2">
                {book.title}
              </h3>
              <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
                {book.author}
              </p>
              
              {book.progress > 0 && (
                <div className="space-y-1">
                  <Progress value={book.progress} className="h-1" />
                  <p className="text-xs text-muted-foreground">
                    {book.progress}% · {book.currentPage}/{book.totalPages} pages
                  </p>
                </div>
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenBook(book)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Star className="h-4 w-4 mr-2" />
                  Add to Favorites
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        
        <CardContent className="p-4 pt-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {format(new Date(book.lastReadAt), 'MMM d')}
            </span>
            <Badge variant="secondary" className="text-xs">
              {book.type.toUpperCase()}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  const BookListItem = ({ book, index }: { book: any; index: number }) => (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className="p-4 cursor-pointer hover:shadow-md transition-all duration-200 group">
        <div className="flex items-center gap-4" onClick={() => onOpenBook(book)}>
          <div className="w-12 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
            {book.cover && book.cover !== 'undefined' ? (
              <img 
                src={book.cover} 
                alt={book.title} 
                className="w-full h-full object-cover rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  const parent = e.currentTarget.parentElement
                  if (parent) {
                    const icon = parent.querySelector('.fallback-icon')
                    if (icon) {
                      (icon as HTMLElement).style.display = 'block'
                    }
                  }
                }}
              />
            ) : (
              null
            )}
            <Book className="w-6 h-6 text-white fallback-icon" style={{ display: book.cover && book.cover !== 'undefined' ? 'none' : 'block' }} />
          </div>
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight mb-1 truncate">
              {book.title}
            </h3>
            <p className="text-sm text-muted-foreground mb-2 truncate">
              {book.author}
            </p>
            
            {book.progress > 0 && (
              <div className="flex items-center gap-3">
                <Progress value={book.progress} className="h-1 flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {book.progress}%
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {book.type.toUpperCase()}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(book.lastReadAt), 'MMM d')}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpenBook(book)}>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Open
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Star className="h-4 w-4 mr-2" />
                  Add to Favorites
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>
    </motion.div>
  )

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">My Library</h1>
            <p className="text-muted-foreground">
              {books.length} books · {books.filter(b => b.isFinished).length} finished
            </p>
          </div>
          
          <Button onClick={onImportBook} className="gap-2">
            <Plus className="h-4 w-4" />
            Import Book
          </Button>
        </div>
        
        {/* Search and filters */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search books..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="all">All ({booksByCategory.all.length})</TabsTrigger>
          <TabsTrigger value="reading">Reading ({booksByCategory.reading.length})</TabsTrigger>
          <TabsTrigger value="finished">Finished ({booksByCategory.finished.length})</TabsTrigger>
          <TabsTrigger value="unread">Unread ({booksByCategory.unread.length})</TabsTrigger>
        </TabsList>

        {(['all', 'reading', 'finished', 'unread'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-6">
            <AnimatePresence mode="wait">
              {getCategoryBooks(tab).length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center py-12"
                >
                  <Book className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No books found</h3>
                  <p className="text-muted-foreground mb-4">
                    {tab === 'all' ? 'Import your first book to get started' : `No ${tab} books yet`}
                  </p>
                  {tab === 'all' && (
                    <Button onClick={onImportBook} className="gap-2">
                      <Plus className="h-4 w-4" />
                      Import Book
                    </Button>
                  )}
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    viewMode === 'grid'
                      ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                      : 'space-y-3'
                  )}
                >
                  {getCategoryBooks(tab).map((book, index) =>
                    viewMode === 'grid' ? (
                      <BookCard key={book.id} book={book} index={index} />
                    ) : (
                      <BookListItem key={book.id} book={book} index={index} />
                    )
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}