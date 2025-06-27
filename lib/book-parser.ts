import ePub from 'epubjs'
import * as pdfjsLib from 'pdfjs-dist'
import iconv from 'iconv-lite'
import JSZip from 'jszip'

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
    console.log('开始解析文本文件:', file.name, 'size:', file.size);
    
    // 获取文件ArrayBuffer用于编码检测和处理
    let buffer: ArrayBuffer;
    let text = '';
    
    try {
      buffer = await file.arrayBuffer();
      
      // 先尝试UTF-8解码
      const utf8Decoder = new TextDecoder('utf-8');
      text = utf8Decoder.decode(buffer);
      console.log('UTF-8解码完成，文本长度:', text.length);
      
      // 检测UTF-8解码质量，如果有大量替换字符（），说明可能是其他编码
      const invalidCharCount = (text.match(/\ufffd/g) || []).length;
      const invalidRatio = invalidCharCount / text.length;
      console.log('无效字符占比:', invalidRatio, '无效字符数:', invalidCharCount);
      
      // 如果UTF-8解码效果不好，尝试其他编码方式
      if (invalidRatio > 0.05 && invalidCharCount > 10) {
        console.log('UTF-8解码质量差，尝试其他编码');
        
        // 使用iconv-lite尝试GBK解码
        try {
          const bytes = new Uint8Array(buffer);
          const gbkText = iconv.decode(bytes, 'gbk');
          
          console.log('GBK解码完成，文本长度:', gbkText.length);
          
          // 简单检查GBK解码质量
          const gbkInvalidCount = (gbkText.match(/\ufffd|\?/g) || []).length;
          const gbkInvalidRatio = gbkInvalidCount / gbkText.length;
          
          console.log('GBK解码无效字符占比:', gbkInvalidRatio, '无效字符数:', gbkInvalidCount);
          
          // 如果GBK解码质量更好，使用GBK结果
          if (gbkInvalidRatio < invalidRatio) {
            console.log('使用GBK解码结果，质量更好');
            text = gbkText;
          } else {
            console.log('GBK解码质量不如UTF-8，保留UTF-8结果');
          }
        } catch (e) {
          console.error('GBK解码尝试失败:', e);
          
          // 尝试其他常见中文编码
          try {
            const bytes = new Uint8Array(buffer);
            const possibleEncodings = ['gb18030', 'big5', 'cp936'];
            let bestText = text;
            let lowestInvalidRatio = invalidRatio;
            
            for (const encoding of possibleEncodings) {
              try {
                const decodedText = iconv.decode(bytes, encoding);
                const currentInvalidCount = (decodedText.match(/\ufffd|\?/g) || []).length;
                const currentInvalidRatio = currentInvalidCount / decodedText.length;
                
                console.log(`${encoding}解码无效字符占比:`, currentInvalidRatio);
                
                if (currentInvalidRatio < lowestInvalidRatio) {
                  bestText = decodedText;
                  lowestInvalidRatio = currentInvalidRatio;
                  console.log(`使用${encoding}解码结果，质量更好`);
                }
              } catch (encError) {
                console.error(`${encoding}解码失败:`, encError);
              }
            }
            
            text = bestText;
          } catch (encError) {
            console.error('所有编码尝试均失败:', encError);
          }
        }
      }
    } catch (error) {
      console.error('文件处理错误:', error);
      try {
        // 回退到直接读取
        text = await file.text();
        console.log('回退到直接读取，长度:', text.length);
      } catch (e) {
        console.error('所有读取方法均失败:', e);
        text = `无法读取文件内容，可能是编码或格式问题。文件名: ${file.name}`;
      }
    }
    
    // 确保文本不为空
    if (!text || text.trim().length === 0) {
      console.error('解析后内容为空');
      text = `文件内容为空或无法正确读取。文件名: ${file.name}`;
    }
    
    // 预处理文本内容
    text = this.preprocessText(text);
    console.log('预处理后文本长度:', text.length);
    
    // 输出前100个字符用于调试
    console.log('文本内容前100个字符:', text.substring(0, 100).replace(/\n/g, '\\n'));
    
    // 提取行
    const lines = text.split('\n').filter(line => line.trim());
    
    // 从文件名或内容中提取标题和作者
    const filename = file.name.replace(/\.[^/.]+$/, '');
    const title = this.extractTitle(filename, lines) || filename;
    const author = this.extractAuthor(lines) || '未知作者';
    
    console.log('提取的标题:', title);
    console.log('提取的作者:', author);
    
    // 解析章节
    const chapters = this.parseTextChapters(text);
    console.log('找到章节数:', chapters.length);
    
    // 验证章节内容
    let hasValidChapters = false;
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      console.log(`章节 ${i+1} "${chapter.title}" 内容长度: ${chapter.content?.length || 0}`);
      if (chapter.content && chapter.content.trim().length > 0) {
        hasValidChapters = true;
      }
    }
    
    if (!hasValidChapters) {
      console.log('所有章节都没有有效内容，创建默认章节');
    }
    
    const wordCount = this.countWords(text);
    const totalPages = this.calculatePages(text);
    
    console.log('总字数:', wordCount);
    console.log('总页数:', totalPages);
    
    // 确保章节不为空
    if (chapters.length === 0 || !hasValidChapters) {
      console.log('创建单个全文章节');
      // 清除空章节
      chapters.length = 0;
      chapters.push({
        id: 'chapter-1',
        title: '全文',
        startPage: 1,
        endPage: totalPages,
        content: text
      });
    }
    
    // 返回解析结果
    return {
      title,
      author,
      content: text,
      chapters,
      wordCount,
      totalPages
    };
  }
  
  static async parseEpub(file: File): Promise<ParsedBook> {
    console.log('开始解析EPUB文件:', file.name, 'size:', file.size);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // 使用EPUBJS进行主要解析
      const book = ePub(arrayBuffer);
      
      // 加载书籍
      await book.ready;
      
      // 获取元数据
      const metadata = await book.loaded.metadata;
      const navigation = await book.loaded.navigation;
      
      // 提取标题和作者
      let title = metadata.title || file.name.replace(/\.[^/.]+$/, '');
      let author = metadata.creator || '未知作者';
      
      // 日志输出元数据
      console.log('EPUB元数据:', {
        标题: title,
        作者: author,
        语言: metadata.language,
        出版商: metadata.publisher,
        出版日期: metadata.pubdate,
        标识符: metadata.identifier
      });
      
      // 获取封面图片
      let cover: string | undefined;
      try {
        const coverUrl = await book.coverUrl();
        if (coverUrl && coverUrl !== 'undefined') {
          cover = coverUrl;
          console.log('找到封面图片');
        } else {
          console.log('无封面图片');
        }
      } catch (e) {
        console.log('获取封面图片失败:', e);
      }
      
      // 提取章节
      const chapters: Array<{
        id: string
        title: string
        startPage: number
        endPage: number
        content: string
        href?: string
      }> = [];
      
      // 收集所有内容
      let fullContent = '';
      let currentPage = 1;
      
      // 处理每个spine项
      console.log('开始提取章节内容...');
      const spineLength = (book.spine as any).length || 0;
      console.log(`总章节数: ${spineLength}`);
      
      // 首先收集TOC信息，以更好地匹配章节标题
      const tocItems: Record<string, string> = {};
      if (navigation && navigation.toc) {
        navigation.toc.forEach((item: any) => {
          if (item.href) {
            const key = item.href.split('#')[0];
            tocItems[key] = item.label;
          }
        });
      }
      
      // 处理每个spine项
      for (let i = 0; i < spineLength; i++) {
        const spineItem = book.spine.get(i);
        const href = spineItem.href;
        
        try {
          // 加载章节内容
          const doc = await spineItem.load(book.load.bind(book));
          let textContent = this.extractTextFromHTML(doc.documentElement.innerHTML);
          
          // 清理空白章节
          if (!textContent.trim()) {
            console.log(`章节 ${i + 1} 内容为空，跳过`);
            continue;
          }
          
          // 查找章节标题
          let chapterTitle = `第 ${i + 1} 章`;
          
          // 首先从TOC中匹配
          const matchedKey = Object.keys(tocItems).find(key => 
            href === key || href.includes(key)
          );
          
          if (matchedKey) {
            chapterTitle = tocItems[matchedKey];
          } else {
            // 从导航中查找
            const navItem = navigation.toc.find((item: any) => 
              item.href === href || 
              href.includes(item.href.split('#')[0])
            );
            
            if (navItem) {
              chapterTitle = navItem.label;
            } else {
              // 尝试从内容的第一行推断标题
              const firstLine = textContent.split('\n')[0].trim();
              if (firstLine && firstLine.length < 100 && !firstLine.includes('.') && !firstLine.includes('，')) {
                chapterTitle = firstLine;
                // 从内容中移除标题行
                textContent = textContent.substring(firstLine.length).trim();
              }
            }
          }
          
          // 计算章节页数
          const chapterWordCount = this.countWords(textContent);
          const chapterPages = Math.max(1, Math.ceil(chapterWordCount / 300));
          
          // 添加章节
          if (textContent.trim().length > 0) {
            chapters.push({
              id: spineItem.idref || `chapter-${i + 1}`,
              title: chapterTitle,
              startPage: currentPage,
              endPage: currentPage + chapterPages - 1,
              content: textContent,
              href: spineItem.href
            });
            
            console.log(`添加章节: "${chapterTitle}", 内容长度: ${textContent.length}, 页数: ${chapterPages}`);
            
            fullContent += textContent + '\n\n';
            currentPage += chapterPages;
          }
          
          // 卸载以释放内存
          spineItem.unload();
        } catch (error) {
          console.error(`加载章节 ${i} 出错:`, error);
        }
      }
      
      // 尝试备用方法解析 - 当EPUBJS不能完全解析时
      if (chapters.length === 0 || fullContent.trim().length === 0) {
        console.log('EPUBJS解析结果为空，尝试备用解析方法');
        
        try {
          // 使用JSZip作为备用方法
          const zip = await JSZip.loadAsync(arrayBuffer);
          let altFullContent = '';
          let altCurrentPage = 1;
          
          // 尝试查找内容文件
          const contentFiles: string[] = [];
          
          // 收集可能的内容文件
          for (const filename of Object.keys(zip.files)) {
            const lower = filename.toLowerCase();
            if (lower.endsWith('.html') || lower.endsWith('.xhtml') || 
                lower.endsWith('.htm') || lower.endsWith('.xml')) {
              contentFiles.push(filename);
            }
          }
          
          // 按文件名排序
          contentFiles.sort();
          
          // 尝试提取内容
          for (let i = 0; i < contentFiles.length; i++) {
            const filename = contentFiles[i];
            try {
              const content = await zip.files[filename].async('text');
              const textContent = this.extractTextFromHTML(content);
              
              if (textContent.trim().length > 0) {
                // 尝试提取标题
                let itemTitle = `章节 ${i + 1}`;
                const titleMatch = content.match(/<title[^>]*>(.*?)<\/title>/i);
                if (titleMatch && titleMatch[1]) {
                  itemTitle = titleMatch[1].trim();
                } else {
                  // 尝试从第一个标题元素提取
                  const headingMatch = content.match(/<h[1-3][^>]*>(.*?)<\/h[1-3]>/i);
                  if (headingMatch && headingMatch[1]) {
                    itemTitle = this.extractTextFromHTML(headingMatch[1].trim());
                  }
                }
                
                const itemPages = Math.max(1, Math.ceil(this.countWords(textContent) / 300));
                
                chapters.push({
                  id: `alt-chapter-${i + 1}`,
                  title: itemTitle,
                  startPage: altCurrentPage,
                  endPage: altCurrentPage + itemPages - 1,
                  content: textContent
                });
                
                altFullContent += textContent + '\n\n';
                altCurrentPage += itemPages;
              }
            } catch (e) {
              console.error(`无法提取文件 ${filename} 的内容:`, e);
            }
          }
          
          // 如果找到内容，更新全文
          if (altFullContent.trim().length > 0) {
            fullContent = altFullContent;
            currentPage = altCurrentPage;
            
            console.log('备用方法成功提取内容，章节数:', chapters.length);
          }
        } catch (backupError) {
          console.error('备用解析方法失败:', backupError);
        }
      }
      
      // 计算字数和总页数
      const wordCount = this.countWords(fullContent);
      const totalPages = Math.max(1, currentPage - 1);
      
      console.log(`EPUB解析完成: 总字数 ${wordCount}, 总页数 ${totalPages}, 章节数 ${chapters.length}`);
      
      // 确保有内容
      if (chapters.length === 0 || fullContent.trim().length === 0) {
        throw new Error('无法提取EPUB内容');
      }
      
      // 返回解析结果
      return {
        title,
        author,
        content: fullContent,
        chapters,
        wordCount,
        totalPages,
        cover,
        metadata
      };
    } catch (error) {
      console.error('解析EPUB出错:', error);
      throw new Error(`解析EPUB失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
  
  static async parsePdf(file: File): Promise<ParsedBook> {
    console.log('开始解析PDF文件:', file.name, 'size:', file.size);
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // 使用pdf.js解析PDF
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // 初始化基本信息
      let title = file.name.replace(/\.[^/.]+$/, '');
      let author = '未知作者';
      let fullContent = '';
      
      // 尝试获取元数据
      try {
        const metadata = await pdf.getMetadata();
        console.log('PDF元数据:', metadata);
        
        if (metadata.info) {
          if ((metadata.info as any).Title) {
            title = (metadata.info as any).Title;
          }
          if ((metadata.info as any).Author) {
            author = (metadata.info as any).Author;
          }
        }
      } catch (e) {
        console.log('无法获取PDF元数据:', e);
      }
      
      // 提取所有页面的文本
      const pages: string[] = [];
      console.log(`PDF总页数: ${pdf.numPages}`);
      
      for (let i = 1; i <= pdf.numPages; i++) {
        try {
          if (i % 10 === 0) {
            console.log(`正在处理PDF页面 ${i}/${pdf.numPages}`);
          }
          
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // 提取文本并保持相对位置
          const pageItems = textContent.items
            .map((item: any) => {
              return {
                text: item.str,
                x: Math.round(item.transform[4]), // 横坐标
                y: Math.round(item.transform[5]), // 纵坐标
                fontSize: Math.round(item.height)
              };
            })
            .sort((a: any, b: any) => {
              // 首先按行排序（y坐标）
              const yDiff = b.y - a.y;
              if (Math.abs(yDiff) > 5) { // 容差范围
                return yDiff;
              }
              // 同行则按列排序（x坐标）
              return a.x - b.x;
            });
          
          // 将项目组织成行
          const lines: any[] = [];
          let currentLine: any[] = [];
          let lastY = -1;
          
          for (const item of pageItems) {
            if (lastY === -1 || Math.abs(item.y - lastY) <= 5) {
              currentLine.push(item);
            } else {
              if (currentLine.length > 0) {
                lines.push(currentLine);
              }
              currentLine = [item];
            }
            lastY = item.y;
          }
          
          if (currentLine.length > 0) {
            lines.push(currentLine);
          }
          
          // 将行合并为页面文本
          const pageText = lines
            .map(line => line.map((item: any) => item.text).join(' '))
            .join('\n');
          
          pages.push(pageText);
          fullContent += pageText + '\n\n';
        } catch (error) {
          console.error(`提取页面 ${i} 文本时出错:`, error);
          pages.push('');
        }
      }
      
      // 尝试识别章节 - 首先基于字体大小和格式寻找潜在的标题
      const potentialChapters: Array<{
        title: string;
        pageNum: number;
        textPosition: number;
      }> = [];
      
      // 章节标题特征
      const chapterPatterns = [
        /^第\s*[一二三四五六七八九十百千万\d]+\s*[章节卷篇回]/i,
        /^Chapter\s+\d+/i,
        /^Section\s+\d+/i,
        /^\d+\.\s+[A-Z]/,
        /^[IVX]+\.\s+/
      ];
      
      // 在页面内容中查找潜在的章节标题
      let overallPosition = 0;
      
      for (let i = 0; i < pages.length; i++) {
        const pageText = pages[i];
        const lines = pageText.split('\n');
        
        for (let j = 0; j < lines.length; j++) {
          const line = lines[j].trim();
          
          // 忽略太短或太长的行
          if (line.length < 2 || line.length > 100) continue;
          
          // 检查是否匹配章节模式
          const isChapterTitle = chapterPatterns.some(pattern => pattern.test(line)) ||
            (line.length < 50 && /^[A-Z]/.test(line) && !/[.,:;]$/.test(line));
          
          if (isChapterTitle) {
            potentialChapters.push({
              title: line,
              pageNum: i + 1,
              textPosition: overallPosition + pageText.indexOf(line)
            });
          }
        }
        
        overallPosition += pageText.length + 2; // +2 for '\n\n'
      }
      
      console.log(`找到 ${potentialChapters.length} 个潜在章节标题`);
      
      // 创建章节
      const chapters: Array<{
        id: string
        title: string
        startPage: number
        endPage: number
        content: string
      }> = [];
      
      // 如果找到足够的章节标题，按章节分割内容
      if (potentialChapters.length >= 2) {
        for (let i = 0; i < potentialChapters.length; i++) {
          const current = potentialChapters[i];
          const next = i < potentialChapters.length - 1 ? potentialChapters[i + 1] : null;
          
          const startPage = current.pageNum;
          const endPage = next ? next.pageNum - 1 : pdf.numPages;
          
          // 提取章节内容
          const startIdx = current.textPosition;
          const endIdx = next ? next.textPosition : fullContent.length;
          const chapterContent = fullContent.substring(startIdx, endIdx).trim();
          
          if (chapterContent.length > 0) {
            chapters.push({
              id: `chapter-${i + 1}`,
              title: current.title,
              startPage: startPage,
              endPage: endPage,
              content: chapterContent
            });
          }
        }
      }
      
      // 如果没有找到足够的章节，按页面组创建章节
      if (chapters.length < 2) {
        console.log('未找到足够的章节标记，按页面组创建章节');
        
        const pagesPerChapter = Math.max(1, Math.ceil(pdf.numPages / 20));
        
        for (let i = 0; i < pdf.numPages; i += pagesPerChapter) {
          const endPage = Math.min(i + pagesPerChapter, pdf.numPages);
          const chapterContent = pages.slice(i, endPage).join('\n\n');
          
          if (chapterContent.trim().length > 0) {
            chapters.push({
              id: `chapter-${Math.floor(i / pagesPerChapter) + 1}`,
              title: `第 ${Math.floor(i / pagesPerChapter) + 1} 章 (页面 ${i + 1}-${endPage})`,
              startPage: i + 1,
              endPage: endPage,
              content: chapterContent
            });
          }
        }
      }
      
      const wordCount = this.countWords(fullContent);
      
      console.log(`PDF解析完成: 页数 ${pdf.numPages}, 字数 ${wordCount}, 章节数 ${chapters.length}`);
      
      return {
        title,
        author,
        content: fullContent,
        chapters,
        wordCount,
        totalPages: pdf.numPages,
        metadata: { originalPages: pdf.numPages }
      };
    } catch (error) {
      console.error('解析PDF时出错:', error);
      throw new Error(`解析PDF失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
  
  private static isChapterTitle(line: string): boolean {
    const chapterPatterns = [
      // 中文章节模式
      /^第\s*[一二三四五六七八九十百千万\d]+\s*[章节卷篇回集]/,
      /^第\d+[章节卷篇回集]/,
      /^[一二三四五六七八九十百千万]+、/,
      /^[（(【［\[]?第?[一二三四五六七八九十百千万\d]+[章节卷篇回集][)）】］\]]?/,
      /^序[章言]/,
      /^前[言述]/,
      /^后[记篇章]/,
      /^终[章结]/,
      /^尾[声章篇]/,
      /^附[录篇]/,
      
      // 英文章节模式
      /^Chapter\s+\d+/i,
      /^CHAPTER\s+[IVXLCDM]+/i,
      /^Part\s+\d+/i,
      /^Section\s+\d+/i,
      /^Book\s+\d+/i,
      /^Volume\s+\d+/i,
      /^Epilogue/i,
      /^Prologue/i,
      /^Introduction/i,
      /^Preface/i,
      /^Afterword/i,
      /^Appendix/i,
      
      // 通用章节模式
      /^\d+\.\s*[A-Z]/,
      /^\d+\s*[\.\:]\s*[^\d]/,
      /^[A-Z\s]{3,20}$/   // 纯大写标题，常见于英文书籍章节
    ]
    
    const line_trimmed = line.trim();
    
    // 特殊检查：长度在5-40字符之间，太短或太长都不太可能是章节标题
    if (line_trimmed.length < 2 || line_trimmed.length > 40) {
      return false;
    }
    
    return chapterPatterns.some(pattern => pattern.test(line_trimmed));
  }
  
  private static parseTextChapters(text: string): Array<{
    id: string
    title: string
    startPage: number
    endPage: number
    content: string
  }> {
    const lines = text.split('\n');
    const chapters: Array<{
      id: string
      title: string
      startPage: number
      endPage: number
      content: string
    }> = [];
    
    // 存储潜在的章节标记和位置
    const potentialChapters: {index: number, title: string}[] = [];
    
    // 第一轮：识别所有潜在章节
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && this.isChapterTitle(line)) {
        potentialChapters.push({index: i, title: line});
      }
    }
    
    console.log(`找到 ${potentialChapters.length} 个潜在章节标记`);
    
    // 过滤太密集的章节标记（可能是误识别）
    if (potentialChapters.length > 3) {
      const filteredChapters = [];
      for (let i = 0; i < potentialChapters.length; i++) {
        // 如果两个章节标记距离太近（小于3行），可能是误识别
        if (i === 0 || 
            potentialChapters[i].index - potentialChapters[i-1].index > 3) {
          filteredChapters.push(potentialChapters[i]);
        }
      }
      potentialChapters.length = 0;
      potentialChapters.push(...filteredChapters);
      console.log(`过滤后剩余 ${potentialChapters.length} 个章节标记`);
    }
    
    // 第二轮：根据识别的章节分割内容
    for (let i = 0; i < potentialChapters.length; i++) {
      const current = potentialChapters[i];
      const next = i < potentialChapters.length - 1 ? potentialChapters[i+1] : null;
      
      const startIndex = current.index;
      const endIndex = next ? next.index - 1 : lines.length - 1;
      
      // 确保章节内容有合理长度
      if (endIndex - startIndex < 3) {
        console.log(`章节"${current.title}"内容太短，跳过`);
        continue;
      }
      
      const chapterContent = lines.slice(startIndex + 1, endIndex + 1).join('\n');
      
      if (chapterContent.trim().length > 0) {
        const pageCount = this.calculatePages(chapterContent);
        const startPage = chapters.length > 0 ? 
          chapters[chapters.length - 1].endPage + 1 : 1;
        
        chapters.push({
          id: `chapter-${chapters.length + 1}`,
          title: current.title,
          startPage: startPage,
          endPage: startPage + pageCount - 1,
          content: chapterContent
        });
      }
    }
    
    // 处理开头部分（第一个章节之前的内容）
    if (potentialChapters.length > 0 && potentialChapters[0].index > 10) {
      const prefaceContent = lines.slice(0, potentialChapters[0].index).join('\n');
      if (prefaceContent.trim().length > 100) {  // 只有当内容足够长时才添加
        const pageCount = this.calculatePages(prefaceContent);
        
        // 调整所有现有章节的页码
        chapters.forEach(ch => {
          ch.startPage += pageCount;
          ch.endPage += pageCount;
        });
        
        chapters.unshift({
          id: 'chapter-preface',
          title: '前言',
          startPage: 1,
          endPage: pageCount,
          content: prefaceContent
        });
      }
    }
    
    // 如果没有找到任何章节，创建一个单章节
    if (chapters.length === 0) {
      console.log('未找到章节标记，创建单一章节');
      chapters.push({
        id: 'chapter-1',
        title: '全文',
        startPage: 1,
        endPage: this.calculatePages(text),
        content: text
      });
    }
    
    return chapters;
  }
  
  private static countWords(text: string): number {
    // 中文字符计数（包括标点符号）
    const chineseChars = (text.match(/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/g) || []).length;
    
    // 英文单词计数
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    
    // 数字计数
    const numbers = (text.match(/\d+/g) || []).length;
    
    // 西文标点符号（半角计数）
    const punctuation = (text.match(/[.,!?;:"'()[\]{}]/g) || []).length / 2;
    
    // 空格和换行不计入字数
    const totalCount = Math.max(1, chineseChars + englishWords + numbers + punctuation);
    
    console.log('字数统计详情:', {
      中文字符: chineseChars,
      英文单词: englishWords,
      数字: numbers,
      标点: punctuation,
      总计: totalCount
    });
    
    return totalCount;
  }
  
  private static calculatePages(text: string, wordsPerPage: number = 300): number {
    const wordCount = this.countWords(text);
    return Math.max(1, Math.ceil(wordCount / wordsPerPage));
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
  
  // 文本预处理函数
  private static preprocessText(text: string): string {
    // 1. 替换Unicode替换字符
    text = text.replace(/\ufffd/g, '');
    
    // 2. 删除重复空行
    text = text.replace(/\n{3,}/g, '\n\n');
    
    // 3. 修复常见格式问题
    text = text.replace(/([。？！.!?])\s*(?=\S)/g, '$1\n'); // 在句子结束后适当换行
    
    // 4. 修复特殊引号问题
    text = text.replace(/\u201c/g, '"').replace(/\u201d/g, '"');
    text = text.replace(/\u2018/g, "'").replace(/\u2019/g, "'");
    
    // 5. 修复Windows/Mac/Unix行尾混用问题
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    return text;
  }
  
  // 尝试解析MOBI文件
  static async parseMobi(file: File): Promise<ParsedBook> {
    console.log('开始解析MOBI文件:', file.name, 'size:', file.size);
    
    try {
      // 由于目前没有理想的MOBI解析库，我们将尝试使用一些替代方法
      // 1. 尝试将MOBI视为ZIP解压缩，检查是否是KF8格式（MOBI的后续格式）
      // 2. 如果失败，将尝试提取文本并进行基本处理
      
      const arrayBuffer = await file.arrayBuffer();
      let text = '';
      let title = file.name.replace(/\.[^/.]+$/, '');
      let author = '未知作者';
      
      // 首先，尝试将文件当作ZIP处理（KF8 MOBI有时候可以当作ZIP解压）
      try {
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // 检查是否有内容文件
        let contentFile = null;
        let contentList: string[] = [];
        
        // 查找常见的内容文件
        for (const filename of Object.keys(zip.files)) {
          const lower = filename.toLowerCase();
          
          // 收集文本文件
          if (lower.endsWith('.html') || lower.endsWith('.htm') || 
              lower.endsWith('.xhtml') || lower.endsWith('.txt')) {
            contentList.push(filename);
          }
          
          // 寻找元数据
          if (lower.includes('metadata') || lower.includes('opf')) {
            const content = await zip.files[filename].async('text');
            
            // 尝试提取标题和作者
            const titleMatch = content.match(/<dc:title[^>]*>(.*?)<\/dc:title>/i);
            const authorMatch = content.match(/<dc:creator[^>]*>(.*?)<\/dc:creator>/i);
            
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim();
            }
            
            if (authorMatch && authorMatch[1]) {
              author = authorMatch[1].trim();
            }
          }
        }
        
        // 按文件名排序处理内容文件
        contentList.sort();
        let fullContent = '';
        
        for (const filename of contentList) {
          const content = await zip.files[filename].async('text');
          
          // 提取纯文本
          const textContent = this.extractTextFromHTML(content);
          if (textContent.trim().length > 0) {
            fullContent += textContent + '\n\n';
          }
        }
        
        if (fullContent.trim().length > 0) {
          text = fullContent;
          console.log('成功从压缩文件中提取MOBI内容，长度:', text.length);
        }
      } catch (zipError) {
        console.log('MOBI不是有效的ZIP格式:', zipError);
      }
      
      // 如果压缩方法失败，尝试直接提取文本
      if (!text || text.trim().length === 0) {
        try {
          // 创建一个文本解码器
          const decoder = new TextDecoder('utf-8');
          const bytes = new Uint8Array(arrayBuffer);
          
          // MOBI格式的基本结构：
          // 1. 有一个PDB头（通常包含"BOOKMOBI"标识符）
          // 2. 后面是一系列记录，其中包含元数据和文本内容
          
          // 寻找文本内容的开始
          const content = decoder.decode(bytes);
          
          // 提取文本部分 - 这种方法很粗糙，但可以处理简单的MOBI文件
          // 寻找HTML内容的开始
          const htmlStartIndex = content.indexOf('<html');
          const bodyStartIndex = content.indexOf('<body');
          
          const startIndex = Math.max(0, 
            htmlStartIndex !== -1 ? htmlStartIndex : 
            bodyStartIndex !== -1 ? bodyStartIndex : 0
          );
          
          if (startIndex > 0) {
            const htmlContent = content.substring(startIndex);
            text = this.extractTextFromHTML(htmlContent);
            
            // 简单提取标题
            const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
              title = titleMatch[1].trim();
            }
            
            console.log('从MOBI提取到HTML内容，长度:', text.length);
          } else {
            // 如果没有找到HTML标记，尝试提取所有可读文本
            // 过滤非ASCII字符和控制字符，保留基本可读文本
            text = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
                          .replace(/[^\x20-\x7E\u4e00-\u9fff\u3000-\u30ff\uff00-\uffef\s]/g, '');
            
            console.log('从MOBI提取到纯文本内容，长度:', text.length);
          }
        } catch (textError) {
          console.error('直接提取MOBI文本失败:', textError);
        }
      }
      
      // 如果还是没有内容，报错
      if (!text || text.trim().length === 0) {
        throw new Error('无法从MOBI文件中提取内容');
      }
      
      // 清理和预处理文本
      text = this.preprocessText(text);
      
      // 解析章节
      let chapters = this.parseTextChapters(text);
      const wordCount = this.countWords(text);
      const totalPages = this.calculatePages(text);
      
      // 确保章节不为空
      if (chapters.length === 0) {
        chapters = [{
          id: 'chapter-1',
          title: '全文',
          startPage: 1,
          endPage: totalPages,
          content: text
        }];
      }
      
      console.log(`MOBI解析完成: 标题 "${title}", 作者 "${author}", 章节数 ${chapters.length}, 总页数 ${totalPages}`);
      
      return {
        title,
        author,
        content: text,
        chapters,
        wordCount,
        totalPages,
        metadata: {
          format: 'MOBI'
        }
      };
    } catch (error) {
      console.error('解析MOBI时出错:', error);
      throw new Error(`解析MOBI失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
}