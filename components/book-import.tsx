"use client"

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, File, X, Check, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useBookStore } from '@/lib/store'
import { BookParser } from '@/lib/book-parser'
import { toast } from 'sonner'

interface BookImportProps {
  onClose: () => void
  onComplete: () => void
}

interface FileUpload {
  file: File
  id: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  progress: number
  error?: string
  bookData?: any
}

export function BookImport({ onClose, onComplete }: BookImportProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const { addBook } = useBookStore()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newUploads: FileUpload[] = acceptedFiles.map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      progress: 0
    }))

    setUploads(prev => [...prev, ...newUploads])
    processFiles(newUploads)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'application/epub+zip': ['.epub'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  })

  const processFiles = async (filesToProcess: FileUpload[]) => {
    setIsProcessing(true)

    for (const upload of filesToProcess) {
      try {
        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, status: 'processing', progress: 20 } : u
        ))

        let parsedBook
        const fileType = upload.file.name.split('.').pop()?.toLowerCase()

        switch (fileType) {
          case 'txt':
            parsedBook = await BookParser.parseText(upload.file)
            break
          case 'epub':
            parsedBook = await BookParser.parseEpub(upload.file)
            break
          case 'pdf':
            parsedBook = await BookParser.parsePdf(upload.file)
            break
          default:
            throw new Error('Unsupported file format')
        }

        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, progress: 70 } : u
        ))

        // Create book object
        const bookData = {
          title: parsedBook.title,
          author: parsedBook.author,
          cover: parsedBook.cover && parsedBook.cover !== 'undefined' ? parsedBook.cover : undefined,
          type: fileType as 'txt' | 'epub' | 'pdf',
          content: parsedBook.content,
          chapters: parsedBook.chapters,
          progress: 0,
          totalPages: parsedBook.totalPages,
          currentPage: 1,
          lastReadAt: new Date(),
          fileSize: upload.file.size,
          wordCount: parsedBook.wordCount,
          readingTime: 0,
          isFinished: false,
          tags: [],
          metadata: parsedBook.metadata
        }

        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { ...u, progress: 90 } : u
        ))

        // Add to store
        addBook(bookData)

        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { 
            ...u, 
            status: 'completed', 
            progress: 100,
            bookData
          } : u
        ))

        toast.success(`"${parsedBook.title}" imported successfully`)

      } catch (error) {
        console.error('Error processing file:', error)
        setUploads(prev => prev.map(u => 
          u.id === upload.id ? { 
            ...u, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Unknown error'
          } : u
        ))
        toast.error(`Failed to import "${upload.file.name}"`)
      }
    }

    setIsProcessing(false)
  }

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id))
  }

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase()
    switch (ext) {
      case 'txt':
        return <FileText className="h-5 w-5" />
      case 'epub':
      case 'pdf':
        return <File className="h-5 w-5" />
      default:
        return <File className="h-5 w-5" />
    }
  }

  const completedUploads = uploads.filter(u => u.status === 'completed')
  const hasCompletedUploads = completedUploads.length > 0

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-background rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
      >
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Import Books</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Drop zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {isDragActive ? 'Drop files here' : 'Import your books'}
            </h3>
            <p className="text-muted-foreground mb-4">
              Drag and drop your files or click to browse
            </p>
            <div className="flex gap-2 justify-center">
              <Badge variant="secondary">.TXT</Badge>
              <Badge variant="secondary">.EPUB</Badge>
              <Badge variant="secondary">.PDF</Badge>
            </div>
          </div>

          {/* Upload list */}
          {uploads.length > 0 && (
            <div className="mt-6 space-y-3 max-h-80 overflow-y-auto">
              <h4 className="font-semibold text-sm">Import Progress</h4>
              <AnimatePresence>
                {uploads.map((upload) => (
                  <motion.div
                    key={upload.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                  >
                    <Card className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-shrink-0">
                          {getFileIcon(upload.file.name)}
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-medium truncate">
                              {upload.file.name}
                            </p>
                            <div className="flex items-center gap-2">
                              {upload.status === 'completed' && (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                              {upload.status === 'processing' && (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                              {upload.status === 'error' && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeUpload(upload.id)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{(upload.file.size / 1024 / 1024).toFixed(1)} MB</span>
                            <Badge variant="outline" className="text-xs">
                              {upload.file.name.split('.').pop()?.toUpperCase()}
                            </Badge>
                          </div>

                          {upload.status === 'processing' && (
                            <Progress value={upload.progress} className="mt-2 h-1" />
                          )}

                          {upload.status === 'error' && upload.error && (
                            <Alert className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                {upload.error}
                              </AlertDescription>
                            </Alert>
                          )}

                          {upload.status === 'completed' && upload.bookData && (
                            <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded text-xs">
                              <p><strong>Title:</strong> {upload.bookData.title}</p>
                              <p><strong>Author:</strong> {upload.bookData.author}</p>
                              <p><strong>Pages:</strong> {upload.bookData.totalPages}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            {hasCompletedUploads && (
              <Button onClick={onComplete}>
                Go to Library ({completedUploads.length} imported)
              </Button>
            )}
          </div>
        </CardContent>
      </motion.div>
    </div>
  )
}