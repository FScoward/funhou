import { useState, useMemo, useEffect, useRef } from 'react'
import { GripVertical } from 'lucide-react'
import './App.css'
import { ClaudeTerminalSessionProvider } from '@/contexts/ClaudeTerminalSessionContext'
import { ClaudeTerminalWidget } from '@/components/ClaudeTerminalWidget'
import { WidgetTerminalDialog } from '@/components/WidgetTerminalDialog'
import { SettingsSidebar } from '@/components/SettingsSidebar'
import { DateNavigation } from '@/components/DateNavigation'
import { DeleteConfirmDialogs } from '@/components/DeleteConfirmDialogs'
import { InputSection } from '@/components/InputSection'
import type { CustomInputRef } from '@/components/CustomInput'
import { Timeline } from '@/components/Timeline'
import { Pagination } from '@/components/Pagination'
import { PinnedSidebar } from '@/components/PinnedSidebar'
import { FilterBar } from '@/components/FilterBar'
import { TaskManagementPage } from '@/components/TaskManagementPage'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useDatabase } from '@/hooks/useDatabase'
import { useDateNavigation } from '@/hooks/useDateNavigation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTimeline } from '@/hooks/useTimeline'
import { useTags } from '@/hooks/useTags'
import { useEntries } from '@/hooks/useEntries'
import { useReplies } from '@/hooks/useReplies'
import { useTodos } from '@/hooks/useTodos'
import { useCompletedTodos } from '@/hooks/useCompletedTodos'
import { useIncompleteTodos } from '@/hooks/useIncompleteTodos'
import { useTaskClaudeSessions } from '@/hooks/useTaskClaudeSessions'
import { useWindowDrag } from '@/hooks/useWindowDrag'
import { ClaudeTerminalDialog } from '@/components/ClaudeTerminalDialog'
import { TaskClaudeLaunchDialog } from '@/components/TaskClaudeLaunchDialog'
import { TaskClaudeSessionsDialog } from '@/components/TaskClaudeSessionsDialog'
import { TaskIdentifier, TaskClaudeSession as TaskClaudeSessionType } from '@/types'
import { DailySummarySidebar } from '@/components/DailySummarySidebar'
import { getSettings, applyFont, applyFontSize } from '@/lib/settings'
import { applyTheme, ThemeVariant } from '@/lib/themes'
import { onClaudeSessionFinished } from '@/lib/claudeLogs'

function App() {
  const { handleMouseDown: handleTabDrag } = useWindowDrag()
  const [activeTab, setActiveTab] = useState<'funhou' | 'tasks'>('funhou')
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [summarySidebarOpen, setSummarySidebarOpen] = useState(false)
  const [claudeTerminalSidebarOpen, setClaudeTerminalSidebarOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [ollamaEnabled, setOllamaEnabled] = useState(false)
  const [ollamaModel, setOllamaModel] = useState('gemma3:4b')
  const [runningSessionIds, setRunningSessionIds] = useState<Set<string>>(new Set())

  // セッション開始時のコールバック
  const handleSessionStart = (sessionId: string) => {
    setRunningSessionIds(prev => new Set(prev).add(sessionId))
  }

  // InputSectionのref（マイクトグル用）
  const inputSectionRef = useRef<CustomInputRef>(null)

  // データベース
  const database = useDatabase()

  // フォント設定の読み込み・適用
  useEffect(() => {
    const loadAndApplySettings = async () => {
      if (!database) return

      const settings = await getSettings(database)
      if (settings.fontFamily) {
        applyFont(settings.fontFamily)
      }
      if (settings.fontSize) {
        applyFontSize(settings.fontSize)
      }
      // テーマの適用
      if (settings.theme) {
        applyTheme(settings.theme)
      }
      // タブのシマー設定をlocalStorageに保存（tabウィンドウと共有）
      localStorage.setItem('tab_shimmer_enabled', (settings.tabShimmerEnabled ?? true) ? 'true' : 'false')
      // Ollama設定の適用
      setOllamaEnabled(settings.ollamaEnabled ?? false)
      setOllamaModel(settings.ollamaModel || 'gemma3:4b')
    }

    loadAndApplySettings()
  }, [database])


  // Claude Codeセッション終了イベントを監視
  useEffect(() => {
    const setupClaudeListener = async () => {
      const unlisten = await onClaudeSessionFinished((payload) => {
        console.log('Claude session finished:', payload)
        // 実行中リストから削除
        setRunningSessionIds(prev => {
          const next = new Set(prev)
          next.delete(payload.session_id)
          return next
        })
      })
      return unlisten
    }

    const unlistenPromise = setupClaudeListener()

    return () => {
      unlistenPromise.then(unlisten => unlisten())
    }
  }, [])

  const handleThemeChange = (theme: ThemeVariant) => {
    applyTheme(theme)
  }

  // 日付ナビゲーション
  const {
    selectedDate,
    setSelectedDate,
    calendarOpen,
    setCalendarOpen,
    goToPreviousDay,
    goToNextDay,
    goToToday,
  } = useDateNavigation()

  // タグ（先に初期化）
  const {
    selectedTags,
    setSelectedTags,
    filterMode,
    setFilterMode,
    availableTags,
    deleteTagDialogOpen,
    setDeleteTagDialogOpen,
    deleteTagTarget,
    loadAvailableTags,
    handleTagClick,
    openDeleteTagDialog,
    handleDeleteTag,
    frequentTags,
    recentTags,
  } = useTags({ database, loadEntries: async () => { } })

  // タイムライン
  const {
    timelineItems: filteredTimelineItems,
    setTimelineItems: setFilteredTimelineItems,
    handleScrollToEntry: scrollToEntry,
    handleScrollToReply: scrollToReply,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
  } = useTimeline({
    database,
    selectedDate,
    selectedTags,
    filterMode,
    searchText,
    onDateChange: setSelectedDate,
  })

  // TODO項目
  const {
    todoItems,
    loadTodos,
    isLoading: isTodosLoading,
    updateEntryLine,
    updateReplyLine,
    saveDoingOrder,
    reorderDoingTodos,
  } = useTodos({ database })

  // 完了タスク
  const {
    completedItems,
    isLoading: isCompletedLoading,
    loadCompletedTodos,
  } = useCompletedTodos({ database, selectedDate })

  // 未完了タスク
  const {
    incompleteTodos,
    isLoading: isIncompleteLoading,
    loadIncompleteTodos,
    updateToDoingStatus,
    saveIncompleteOrder,
    reorderIncompleteTodos,
  } = useIncompleteTodos({ database })

  // タスクとClaude Codeセッションの紐付け
  const {
    sessionsMap: taskSessionsMap,
    loadSessionsForTasks,
    linkSession: linkTaskSession,
    unlinkSession: unlinkTaskSession,
  } = useTaskClaudeSessions({ database })

  // タスクClaude起動ダイアログの状態（アプリ内ターミナル）
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false)
  const [terminalDialogTask, setTerminalDialogTask] = useState<TaskIdentifier | null>(null)
  // 既存セッション再開用
  const [terminalDialogLinkedSessionId, setTerminalDialogLinkedSessionId] = useState<string | null>(null)
  const [terminalDialogLinkedCwd, setTerminalDialogLinkedCwd] = useState<string | null>(null)

  // 外部ターミナル起動ダイアログの状態
  const [externalDialogOpen, setExternalDialogOpen] = useState(false)
  const [externalDialogTask, setExternalDialogTask] = useState<TaskIdentifier | null>(null)
  const [externalDialogTaskText, setExternalDialogTaskText] = useState('')

  // タスクセッション管理ダイアログの状態
  const [sessionsDialogOpen, setSessionsDialogOpen] = useState(false)
  const [sessionsDialogTask, setSessionsDialogTask] = useState<TaskIdentifier | null>(null)
  const [sessionsDialogTaskText, setSessionsDialogTaskText] = useState('')
  const [sessionsDialogSessions, setSessionsDialogSessions] = useState<TaskClaudeSessionType[]>([])

  // TODO項目の読み込み
  useEffect(() => {
    if (database) {
      loadTodos()
    }
  }, [database, loadTodos])

  // 完了タスクの読み込み（日付変更時に再読み込み）
  useEffect(() => {
    if (database) {
      loadCompletedTodos()
    }
  }, [database, selectedDate, loadCompletedTodos])

  // 未完了タスクの読み込み
  useEffect(() => {
    if (database) {
      loadIncompleteTodos()
    }
  }, [database, loadIncompleteTodos])

  // タスクのセッション情報を読み込み
  useEffect(() => {
    if (database && todoItems.length > 0) {
      const allTasks = [
        ...todoItems.map(t => ({ entryId: t.entryId, replyId: t.replyId, lineIndex: t.lineIndex })),
        ...incompleteTodos.map(t => ({ entryId: t.entryId, replyId: t.replyId, lineIndex: t.lineIndex })),
      ]
      loadSessionsForTasks(allTasks)
    }
  }, [database, todoItems, incompleteTodos, loadSessionsForTasks])

  // Claude Code起動ダイアログを開く（アプリ内ターミナル）
  const handleLaunchClaude = (task: TaskIdentifier, _taskText: string) => {
    setTerminalDialogTask(task)
    setTerminalDialogOpen(true)
  }

  // 外部ターミナルでClaude Codeを起動
  const handleLaunchClaudeExternal = (task: TaskIdentifier, taskText: string) => {
    setExternalDialogTask(task)
    setExternalDialogTaskText(taskText)
    setExternalDialogOpen(true)
  }

  // セッション管理ダイアログを開く
  const handleManageSessions = (task: TaskIdentifier, taskText: string, sessions: TaskClaudeSessionType[]) => {
    setSessionsDialogTask(task)
    setSessionsDialogTaskText(taskText)
    setSessionsDialogSessions(sessions)
    setSessionsDialogOpen(true)
  }

  // アプリ内ターミナルでセッションを再開
  const handleResumeInApp = (session: TaskClaudeSessionType) => {
    console.log('[App] handleResumeInApp called:', session)
    setTerminalDialogLinkedSessionId(session.sessionId)
    setTerminalDialogLinkedCwd(session.cwd)
    setTerminalDialogOpen(true)
  }

  // セッション作成後の紐付け（アプリ内ターミナル用）
  const handleSessionCreated = async (sessionId: string, cwd: string) => {
    if (terminalDialogTask) {
      // projectPathはcwdと同じにする
      await linkTaskSession(terminalDialogTask, sessionId, cwd, cwd)
    }
  }

  // 外部ターミナルでセッション起動後の紐付け
  const handleExternalSessionLaunched = async (sessionId: string, cwd: string) => {
    if (externalDialogTask) {
      await linkTaskSession(externalDialogTask, sessionId, cwd, cwd)
    }
  }

  // セッション紐付け解除
  const handleSessionUnlinked = async (sessionId: string) => {
    if (sessionsDialogTask) {
      await unlinkTaskSession(sessionsDialogTask, sessionId)
      // ダイアログ内のセッション一覧も更新
      setSessionsDialogSessions(prev => prev.filter(s => s.sessionId !== sessionId))
    }
  }

  // エントリー
  const {
    currentEntry,
    setCurrentEntry,
    manualTags,
    setManualTags,
    editingEntryId,
    editContent,
    setEditContent,
    editManualTags,
    setEditManualTags,
    deleteDialogOpen,
    setDeleteDialogOpen,
    handleAddEntry,
    startEditEntry,
    handleUpdateEntry,
    cancelEditEntry,
    openDeleteDialog,
    handleDeleteEntry,
    handleKeyDown,
    handleTogglePin,
    handleToggleArchive,
    handleDirectUpdateEntry,
    handleDirectTagAdd,
    handleDirectTagRemove,
    handleLinkClaudeSession,
  } = useEntries({
    database,
    timelineItems: filteredTimelineItems,
    setTimelineItems: setFilteredTimelineItems,
    loadAvailableTags,
  })

  // 返信
  const {
    replyingToId,
    replyContent,
    setReplyContent,
    replyManualTags,
    setReplyManualTags,
    expandedEntryReplies,
    editingReplyId,
    editReplyContent,
    setEditReplyContent,
    editReplyManualTags,
    setEditReplyManualTags,
    deleteReplyDialogOpen,
    setDeleteReplyDialogOpen,
    handleAddReply,
    addReplyWithContent,
    toggleReplyForm,
    toggleEntryReplies,
    startEditReply,
    handleUpdateReply,
    cancelEditReply,
    openDeleteReplyDialog,
    handleDeleteReply,
    handleDirectUpdateReply,
    handleToggleReplyArchive,
  } = useReplies({
    database,
    timelineItems: filteredTimelineItems,
    setTimelineItems: setFilteredTimelineItems,
    loadAvailableTags,
  })

  // キーボードショートカット
  useKeyboardShortcuts({
    selectedDate,
    goToPreviousDay,
    goToNextDay,
    goToToday,
    onToggleMic: () => inputSectionRef.current?.toggleMic(),
  })

  // ピン留めされたエントリーのみをフィルタリング
  const pinnedEntries = useMemo(() => {
    return filteredTimelineItems.filter(
      (item) => item.type === 'entry' && item.pinned === true
    )
  }, [filteredTimelineItems])

  // タスクステータス変更ハンドラー（共通化）
  const handleTaskStatusChange = async (todo: typeof todoItems[0], newStatus: import('@/utils/checkboxUtils').CheckboxStatus) => {
    if (todo.replyId) {
      // 返信のタスクを更新
      const newContent = await updateReplyLine(todo.replyId, todo.lineIndex, newStatus)
      if (newContent) {
        // タイムラインの返信も更新
        setFilteredTimelineItems(filteredTimelineItems.map(item => {
          if (item.type === 'reply' && item.replyId === todo.replyId) {
            return { ...item, content: newContent }
          }
          // 親エントリーのrepliesリストも更新
          if (item.type === 'entry' && item.id === todo.entryId && item.replies) {
            const updatedReplies = item.replies.map(reply =>
              reply.id === todo.replyId ? { ...reply, content: newContent } : reply
            )
            return { ...item, replies: updatedReplies }
          }
          return item
        }))
      }
    } else {
      // エントリーのタスクを更新
      const newContent = await updateEntryLine(todo.entryId, todo.lineIndex, newStatus)
      if (newContent) {
        // タイムラインのエントリーも更新
        setFilteredTimelineItems(filteredTimelineItems.map(item =>
          item.type === 'entry' && item.id === todo.entryId
            ? { ...item, content: newContent }
            : item
        ))
      }
    }
    await loadTodos()
    await loadCompletedTodos()
  }

  return (
    <ClaudeTerminalSessionProvider>
    <div className="app">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'funhou' | 'tasks')} className="app-tabs">
        <div className="app-tabs-header">
          <TabsList className="app-tabs-list">
            <TabsTrigger value="funhou" className="app-tab-trigger">分報</TabsTrigger>
            <TabsTrigger value="tasks" className="app-tab-trigger">タスク管理</TabsTrigger>
          </TabsList>
          <button
            className="window-drag-handle"
            onMouseDown={handleTabDrag}
            title="ウィンドウを移動"
          >
            <GripVertical size={18} />
          </button>
        </div>

        <TabsContent value="funhou" className="app-tab-content">
          <div className="app-layout">
            <DateNavigation
              selectedDate={selectedDate}
              calendarOpen={calendarOpen}
              onCalendarOpenChange={setCalendarOpen}
              onDateSelect={setSelectedDate}
              onPreviousDay={goToPreviousDay}
              onNextDay={goToNextDay}
              onToday={goToToday}
            />

            <FilterBar
              availableTags={availableTags}
              selectedTags={selectedTags}
              filterMode={filterMode}
              onTagSelect={(tag) => {
                if (selectedTags.includes(tag)) {
                  setSelectedTags(selectedTags.filter(t => t !== tag))
                } else {
                  setSelectedTags([...selectedTags, tag])
                }
              }}
              onTagRemove={(tag) => {
                setSelectedTags(selectedTags.filter(t => t !== tag))
              }}
              onFilterModeChange={(mode) => {
                setFilterMode(mode)
              }}
              onTagsClearAll={() => {
                setSelectedTags([])
              }}
              onTagDelete={openDeleteTagDialog}
              frequentTags={frequentTags}
              recentTags={recentTags}
              onSearch={setSearchText}
              searchText={searchText}
            />

            <InputSection
              ref={inputSectionRef}
              currentEntry={currentEntry}
              onEntryChange={setCurrentEntry}
              onSubmit={async () => {
                await handleAddEntry()
                await loadIncompleteTodos()
              }}
              onKeyDown={async (e) => {
                handleKeyDown(e)
                // Cmd+Enter で送信した場合も未完了タスクを再読み込み
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  // handleKeyDown内でhandleAddEntryが呼ばれるので少し待ってから再読み込み
                  setTimeout(() => loadIncompleteTodos(), 100)
                }
              }}
              availableTags={availableTags}
              selectedTags={manualTags}
              onTagAdd={(tag) => {
                if (!manualTags.includes(tag)) {
                  setManualTags([...manualTags, tag])
                }
              }}
              onTagRemove={(tag) => {
                setManualTags(manualTags.filter(t => t !== tag))
              }}
              frequentTags={frequentTags}
              recentTags={recentTags}
              ollamaEnabled={ollamaEnabled}
              ollamaModel={ollamaModel}
              onImportLog={async (content) => {
                setCurrentEntry(content)
              }}
            />

            {(selectedTags.length > 0 || searchText.trim().length > 0) && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}

            <Timeline
              timelineItems={filteredTimelineItems}
              isTagFiltering={selectedTags.length > 0 || searchText.trim().length > 0}
              editingEntryId={editingEntryId}
              editContent={editContent}
              editManualTags={editManualTags}
              editingReplyId={editingReplyId}
              editReplyContent={editReplyContent}
              editReplyManualTags={editReplyManualTags}
              availableTags={availableTags}
              selectedTags={selectedTags}
              replyingToId={replyingToId}
              replyContent={replyContent}
              replyManualTags={replyManualTags}
              expandedEntryReplies={expandedEntryReplies}
              frequentTags={frequentTags}
              recentTags={recentTags}
              onEditEntry={startEditEntry}
              onCancelEditEntry={cancelEditEntry}
              onUpdateEntry={handleUpdateEntry}
              onDeleteEntry={openDeleteDialog}
              onEditContentChange={setEditContent}
              onEditTagAdd={(tag) => {
                if (!editManualTags.includes(tag)) {
                  setEditManualTags([...editManualTags, tag])
                }
              }}
              onEditTagRemove={(tag) => {
                setEditManualTags(editManualTags.filter(t => t !== tag))
              }}
              onEditReply={startEditReply}
              onCancelEditReply={cancelEditReply}
              onUpdateReply={handleUpdateReply}
              onDeleteReply={openDeleteReplyDialog}
              onEditReplyContentChange={setEditReplyContent}
              onEditReplyTagAdd={(tag) => {
                if (!editReplyManualTags.includes(tag)) {
                  setEditReplyManualTags([...editReplyManualTags, tag])
                }
              }}
              onEditReplyTagRemove={(tag) => {
                setEditReplyManualTags(editReplyManualTags.filter(t => t !== tag))
              }}
              onTagClick={handleTagClick}
              onReplyToggle={toggleReplyForm}
              onReplyContentChange={setReplyContent}
              onReplyTagAdd={(tag) => {
                if (!replyManualTags.includes(tag)) {
                  setReplyManualTags([...replyManualTags, tag])
                }
              }}
              onReplyTagRemove={(tag) => {
                setReplyManualTags(replyManualTags.filter(t => t !== tag))
              }}
              onAddReply={async (entryId) => {
                await handleAddReply(entryId)
                await loadIncompleteTodos()
              }}
              onToggleReplies={toggleEntryReplies}
              onScrollToEntry={scrollToEntry}
              onTogglePin={handleTogglePin}
              onToggleArchive={handleToggleArchive}
              onUpdateEntryDirectly={async (entryId, newContent) => {
                await handleDirectUpdateEntry(entryId, newContent)
                await loadTodos()
                await loadCompletedTodos()
                await loadIncompleteTodos()
              }}
              onDirectTagAdd={handleDirectTagAdd}
              onDirectTagRemove={handleDirectTagRemove}
              onUpdateReplyDirectly={async (replyId, newContent) => {
                await handleDirectUpdateReply(replyId, newContent)
                await loadTodos()
                await loadCompletedTodos()
                await loadIncompleteTodos()
              }}
              onToggleReplyArchive={async (replyId, entryId) => {
                await handleToggleReplyArchive(replyId, entryId)
                await loadTodos()
                await loadIncompleteTodos()
              }}
              onImportAsReply={async (entryId, content) => {
                await addReplyWithContent(entryId, content)
                await loadIncompleteTodos()
              }}
              onLinkClaudeSession={handleLinkClaudeSession}
              runningSessionIds={runningSessionIds}
              onSessionStart={handleSessionStart}
            />
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="app-tab-content">
          <TaskManagementPage
            todoItems={todoItems}
            isTodosLoading={isTodosLoading}
            onScrollToEntry={(entryId) => {
              setActiveTab('funhou')
              setTimeout(() => scrollToEntry(entryId), 100)
            }}
            onScrollToReply={(replyId) => {
              setActiveTab('funhou')
              setTimeout(() => scrollToReply(replyId), 100)
            }}
            onStatusChange={handleTaskStatusChange}
            onReorder={async (activeId, overId) => {
              const reorderedDoingTodos = reorderDoingTodos(activeId, overId)
              if (reorderedDoingTodos) {
                await saveDoingOrder(reorderedDoingTodos)
              }
            }}
            completedItems={completedItems}
            isCompletedLoading={isCompletedLoading}
            incompleteTodos={incompleteTodos}
            isIncompleteLoading={isIncompleteLoading}
            onIncompleteStatusChange={async (todo) => {
              const success = await updateToDoingStatus(todo)
              if (success) {
                await loadIncompleteTodos()
                await loadTodos()
              }
            }}
            onIncompleteReorder={async (activeId, overId) => {
              const reordered = reorderIncompleteTodos(activeId, overId)
              if (reordered) {
                await saveIncompleteOrder(reordered)
              }
            }}
            taskSessionsMap={taskSessionsMap}
            onLaunchClaude={handleLaunchClaude}
            onLaunchClaudeExternal={handleLaunchClaudeExternal}
            onManageSessions={handleManageSessions}
          />
        </TabsContent>
      </Tabs>

      <PinnedSidebar
        pinnedItems={pinnedEntries}
        onItemClick={scrollToEntry}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <DailySummarySidebar
        timelineItems={filteredTimelineItems}
        selectedDate={selectedDate}
        ollamaModel={ollamaModel}
        isOpen={summarySidebarOpen}
        onToggle={() => setSummarySidebarOpen(!summarySidebarOpen)}
      />

      <DeleteConfirmDialogs
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onDeleteEntry={async () => {
          await handleDeleteEntry()
          await loadIncompleteTodos()
        }}
        deleteReplyDialogOpen={deleteReplyDialogOpen}
        onDeleteReplyDialogOpenChange={setDeleteReplyDialogOpen}
        onDeleteReply={async () => {
          await handleDeleteReply()
          await loadIncompleteTodos()
        }}
        deleteTagDialogOpen={deleteTagDialogOpen}
        onDeleteTagDialogOpenChange={setDeleteTagDialogOpen}
        onDeleteTag={handleDeleteTag}
        deleteTagTarget={deleteTagTarget}
      />

      <SettingsSidebar
        isOpen={settingsSidebarOpen}
        onToggle={() => setSettingsSidebarOpen(!settingsSidebarOpen)}
        db={database}
        onFontChange={applyFont}
        onFontSizeChange={applyFontSize}
        onThemeChange={handleThemeChange}
        onOllamaEnabledChange={setOllamaEnabled}
        onOllamaModelChange={setOllamaModel}
      />

      {/* バックグラウンド実行中のClaude Codeサイドバー */}
      <ClaudeTerminalWidget
        isOpen={claudeTerminalSidebarOpen}
        onToggle={() => setClaudeTerminalSidebarOpen(!claudeTerminalSidebarOpen)}
      />

      {/* ウィジェットから開かれるダイアログ */}
      <WidgetTerminalDialog />

      {/* タスクからClaude Code起動ダイアログ（アプリ内ターミナル） */}
      <ClaudeTerminalDialog
        open={terminalDialogOpen}
        onOpenChange={(open) => {
          setTerminalDialogOpen(open)
          if (!open) {
            setTerminalDialogTask(null)
            setTerminalDialogLinkedSessionId(null)
            setTerminalDialogLinkedCwd(null)
          }
        }}
        linkedSessionId={terminalDialogLinkedSessionId}
        linkedCwd={terminalDialogLinkedCwd}
        onSessionCreated={handleSessionCreated}
      />

      {/* タスクからClaude Code起動ダイアログ（外部ターミナル） */}
      <TaskClaudeLaunchDialog
        taskText={externalDialogTaskText}
        open={externalDialogOpen}
        onOpenChange={(open) => {
          setExternalDialogOpen(open)
          if (!open) {
            setExternalDialogTask(null)
            setExternalDialogTaskText('')
          }
        }}
        onSessionLaunched={handleExternalSessionLaunched}
      />

      {/* タスクのセッション管理ダイアログ */}
      {sessionsDialogTask && (
        <TaskClaudeSessionsDialog
          taskText={sessionsDialogTaskText}
          sessions={sessionsDialogSessions}
          open={sessionsDialogOpen}
          onOpenChange={setSessionsDialogOpen}
          onSessionResumed={() => {}}
          onSessionUnlinked={handleSessionUnlinked}
          onLaunchNew={() => {
            setSessionsDialogOpen(false)
            handleLaunchClaude(sessionsDialogTask, sessionsDialogTaskText)
          }}
          onResumeInApp={handleResumeInApp}
        />
      )}
    </div>
    </ClaudeTerminalSessionProvider>
  )
}

export default App
