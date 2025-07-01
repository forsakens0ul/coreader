"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Upload, BarChart3, Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bookshelf } from "@/components/bookshelf";
import BookImport from "@/components/book-import";
import { ReadingInterface } from "@/components/reading-interface";
import { useBookStore } from "@/lib/store";

export default function Home() {
  const [activeTab, setActiveTab] = useState("library");
  const [showImport, setShowImport] = useState(false);
  const [currentBook, setCurrentBook] = useState<any>(null);
  const { books, readingStats } = useBookStore();

  const handleOpenBook = (book: any) => {
    setCurrentBook(book);
  };

  const handleCloseBook = () => {
    setCurrentBook(null);
  };

  const handleImportComplete = () => {
    setShowImport(false);
    setActiveTab("library");
  };

  if (currentBook) {
    return <ReadingInterface book={currentBook} onClose={handleCloseBook} />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">CoReader</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImport(true)}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Import
            </Button>
            <Button variant="ghost" size="sm">
              <User className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="border-b">
            <div className="max-w-7xl mx-auto px-6">
              <TabsList className="grid w-full grid-cols-3 max-w-md">
                <TabsTrigger value="library" className="gap-2">
                  <BookOpen className="h-4 w-4" />
                  Library
                </TabsTrigger>
                <TabsTrigger value="stats" className="gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Stats
                </TabsTrigger>
                <TabsTrigger value="settings" className="gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <TabsContent value="library" className="mt-0">
            <Bookshelf
              onImportBook={() => setShowImport(true)}
              onOpenBook={handleOpenBook}
            />
          </TabsContent>

          <TabsContent value="stats" className="mt-0">
            <div className="max-w-7xl mx-auto p-6">
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Reading Statistics</h1>
                <p className="text-muted-foreground">
                  Track your reading progress and achievements
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl font-bold">
                      {books.length}
                    </CardTitle>
                    <CardDescription>Total Books</CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl font-bold">
                      {books.filter((b) => b.isFinished).length}
                    </CardTitle>
                    <CardDescription>Books Finished</CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl font-bold">
                      {
                        books.filter((b) => b.progress > 0 && !b.isFinished)
                          .length
                      }
                    </CardTitle>
                    <CardDescription>Currently Reading</CardDescription>
                  </CardHeader>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-2xl font-bold">
                      {Math.round(
                        books.reduce((acc, book) => acc + book.progress, 0) /
                          books.length
                      ) || 0}
                      %
                    </CardTitle>
                    <CardDescription>Average Progress</CardDescription>
                  </CardHeader>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reading Activity</CardTitle>
                    <CardDescription>
                      Your reading activity over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      Reading activity chart coming soon
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recent Books</CardTitle>
                    <CardDescription>
                      Books you&apos;ve read recently
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {books
                        .sort(
                          (a, b) =>
                            new Date(b.lastReadAt).getTime() -
                            new Date(a.lastReadAt).getTime()
                        )
                        .slice(0, 5)
                        .map((book) => (
                          <div
                            key={book.id}
                            className="flex items-center gap-3"
                          >
                            <div className="w-8 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center flex-shrink-0">
                              <BookOpen className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">
                                {book.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {book.author}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {book.progress}%
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="mt-0">
            <div className="max-w-7xl mx-auto p-6">
              <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Settings</h1>
                <p className="text-muted-foreground">
                  Customize your reading experience
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Reading Preferences</CardTitle>
                    <CardDescription>
                      Adjust your reading settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      Settings panel coming soon
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Data Management</CardTitle>
                    <CardDescription>
                      Import and export your data
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <Button variant="outline" className="w-full">
                        Export Data
                      </Button>
                      <Button variant="outline" className="w-full">
                        Import Data
                      </Button>
                      <Button variant="destructive" className="w-full">
                        Clear All Data
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Import Dialog */}
      {showImport && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
          >
            <BookImport
              onClose={() => setShowImport(false)}
              onComplete={handleImportComplete}
            />
          </motion.div>
        </div>
      )}
    </div>
  );
}
