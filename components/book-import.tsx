"use client"

import { useState } from 'react'
import { BookParser } from '@/lib/book-parser'
import useReadingEngine from '@/lib/reading-engine'
import { useBookStore } from '@/lib/store'
import { useToast } from '@/hooks/use-toast'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertCircle, BookOpen, FileText, Upload, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function BookImport({ onClose, onComplete }: { onClose?: () => void, onComplete?: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importTab, setImportTab] = useState('file')
  const { setBook } = useReadingEngine()
  const { addBook } = useBookStore()
  const { toast } = useToast()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0]
      setFile(selectedFile)
      setError(null)
    }
  }

  const importBook = async () => {
    if (!file) {
      setError('请选择一个文件')
      return
    }

    setLoading(true)
    setError(null)

    try {
      console.log(`开始导入文件: ${file.name}, 类型: ${file.type}, 大小: ${file.size} 字节`)
      
      // 根据文件类型选择解析方法
      let parsedBook
      const fileExt = file.name.split('.').pop()?.toLowerCase()
      
      if (fileExt === 'epub') {
        console.log('解析EPUB文件')
        parsedBook = await BookParser.parseEpub(file)
      } else if (fileExt === 'pdf') {
        console.log('解析PDF文件')
        parsedBook = await BookParser.parsePdf(file)
      } else if (fileExt === 'mobi') {
        console.log('解析MOBI文件')
        parsedBook = await BookParser.parseMobi(file)
      } else if (fileExt === 'txt' || file.type === 'text/plain') {
        console.log('解析TXT文件')
        try {
          parsedBook = await BookParser.parseText(file)
          
          // 验证解析结果是否有效
          if (!parsedBook.content || parsedBook.content.trim().length === 0) {
            console.error('解析结果内容为空，尝试备用方法')
            throw new Error('解析结果内容为空')
          }
          
          if (parsedBook.chapters.length === 0 || 
              !parsedBook.chapters[0].content || 
              parsedBook.chapters[0].content.trim().length === 0) {
            console.error('解析结果章节为空，尝试备用方法')
            throw new Error('解析结果章节为空')
          }
          
          console.log('文本文件解析成功，内容长度:', parsedBook.content.length)
        } catch (txtError) {
          console.error('标准TXT解析失败，尝试直接读取:', txtError)
          
          // 备用解析方法：直接读取文件内容
          try {
            const text = await file.text()
            if (!text || text.trim().length === 0) {
              throw new Error('文件内容为空')
            }
            
            // 创建基本解析结果
            parsedBook = {
              title: file.name.replace(/\.[^/.]+$/, ''),
              author: '未知作者',
              content: text,
              chapters: [{
                id: 'chapter-1',
                title: '全文',
                startPage: 1,
                endPage: Math.ceil(text.length / 2000), // 简单估算页数
                content: text
              }],
              wordCount: text.length,
              totalPages: Math.ceil(text.length / 2000)
            }
            
            console.log('使用备用方法成功读取文件，内容长度:', text.length)
          } catch (backupError) {
            console.error('备用解析方法也失败:', backupError)
            throw new Error(`无法解析文本文件: ${backupError instanceof Error ? backupError.message : '未知错误'}`)
          }
        }
      } else {
        throw new Error(`不支持的文件类型: ${fileExt || file.type}`)
      }
      
      // 最终验证
      if (!parsedBook || !parsedBook.content || parsedBook.content.trim().length === 0) {
        throw new Error('解析结果无效，无法获取内容')
      }
      
      console.log('开始设置书籍到阅读引擎和书库...');
      
      try {
        // 设置书籍到阅读引擎
        console.log('设置书籍到阅读引擎');
        setBook(parsedBook);
        console.log('阅读引擎设置完成');
        
        // 将书籍添加到书库
        console.log('添加书籍到书库，标题:', parsedBook.title);
        
        const bookData = {
          title: parsedBook.title,
          author: parsedBook.author || '未知作者',
          cover: parsedBook.cover,
          type: (fileExt as 'txt' | 'epub' | 'pdf') || 'txt',
          content: parsedBook.content,
          chapters: parsedBook.chapters,
          progress: 0,
          totalPages: parsedBook.totalPages,
          currentPage: 0,
          lastReadAt: new Date(),
          fileSize: file.size,
          wordCount: parsedBook.wordCount,
          readingTime: 0,
          isFinished: false,
          tags: []
        };
        
        console.log('书籍数据准备完成，调用addBook...');
        addBook(bookData);
        console.log('addBook调用完成');
      } catch (storeError) {
        console.error('存储书籍过程中出错:', storeError);
        throw new Error(`存储书籍失败: ${storeError instanceof Error ? storeError.message : '未知错误'}`);
      }
      
      console.log('显示成功通知...');
      toast({
        title: "导入成功",
        description: `《${parsedBook.title}》已成功导入，共 ${parsedBook.totalPages} 页`
      })
      
      console.log('导入完成:', parsedBook.title)
      
      // 调用完成回调
      if (onComplete) {
        console.log('调用完成回调...');
        onComplete()
        console.log('完成回调调用完成');
      }
    } catch (error) {
      console.error('导入失败:', error)
      setError(`导入失败: ${error instanceof Error ? error.message : '未知错误'}`)
      
      toast({
        variant: "destructive",
        title: "导入失败",
        description: error instanceof Error ? error.message : '未知错误'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md mx-auto bg-background shadow-lg">
      <CardHeader className="p-6 pb-4 relative">
        {onClose && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="absolute top-4 right-4" 
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
        <CardTitle>导入书籍</CardTitle>
        <CardDescription>导入您的电子书以开始阅读</CardDescription>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-4">
        <Tabs value={importTab} onValueChange={setImportTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="file">本地文件</TabsTrigger>
          </TabsList>
          <TabsContent value="file" className="space-y-4 mt-4">
            <div className="space-y-2">
              <label htmlFor="book-file" className="text-sm font-medium">
                选择文件
              </label>
              <Input
                id="book-file"
                type="file"
                accept=".epub,.pdf,.txt,.mobi,text/plain"
                onChange={handleFileChange}
              />
              <p className="text-xs text-muted-foreground">
                支持 EPUB, PDF, MOBI 和 TXT 格式文件
              </p>
            </div>
            
            {file && (
              <div className="flex items-center space-x-2 text-sm p-3 bg-muted/50 rounded-md">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium">{file.name}</span>
                <span className="text-muted-foreground">
                  ({Math.round(file.size / 1024)} KB)
                </span>
              </div>
            )}
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>错误</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="p-6 pt-0 flex justify-between gap-4">
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
        )}
        <Button 
          onClick={importBook} 
          disabled={!file || loading}
          className={onClose ? "flex-1" : "w-full"}
        >
          {loading ? '导入中...' : '导入书籍'}
          {!loading && <BookOpen className="ml-2 h-4 w-4" />}
        </Button>
      </CardFooter>
    </Card>
  )
}

// 同时提供默认导出，以支持原有引用方式
export default BookImport;