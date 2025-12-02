import { useState, useMemo, useEffect } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { invoke } from '@tauri-apps/api/core'
import './App.css'
import { SettingsSidebar } from '@/components/SettingsSidebar'
import { DateNavigation } from '@/components/DateNavigation'
import { DeleteConfirmDialogs } from '@/components/DeleteConfirmDialogs'
import { InputSection } from '@/components/InputSection'
import { Timeline } from '@/components/Timeline'
import { Pagination } from '@/components/Pagination'
import { PinnedSidebar } from '@/components/PinnedSidebar'
import { FilterBar } from '@/components/FilterBar'
import { useDatabase } from '@/hooks/useDatabase'
import { useDateNavigation } from '@/hooks/useDateNavigation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTimeline } from '@/hooks/useTimeline'
import { useTags } from '@/hooks/useTags'
import { useEntries } from '@/hooks/useEntries'
import { useReplies } from '@/hooks/useReplies'
import { useTodos } from '@/hooks/useTodos'
import { useCompletedTodos } from '@/hooks/useCompletedTodos'
import { CurrentActivitySection } from '@/components/CurrentActivitySection'
import { CompletedTasksSidebar } from '@/components/CompletedTasksSidebar'
import { getSettings, applyFont, applyFontSize } from '@/lib/settings'
import { applyTheme, ThemeVariant } from '@/lib/themes'

function App() {
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [doneSidebarOpen, setDoneSidebarOpen] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [ollamaEnabled, setOllamaEnabled] = useState(false)
  const [ollamaModel, setOllamaModel] = useState('gemma3:4b')

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

  // メインウィンドウの移動イベントを監視し、タブウィンドウを追従させる
  useEffect(() => {
    const setupMoveListener = async () => {
      const currentWindow = getCurrentWindow()
      const unlisten = await currentWindow.onMoved(async (event) => {
        try {
          await invoke('set_tab_window_y', { y: event.payload.y })
        } catch (e) {
          console.error('Failed to sync tab window position:', e)
        }
      })
      return unlisten
    }

    const unlistenPromise = setupMoveListener()

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
  } = useTodos({ database })

  // 完了タスク
  const {
    completedItems,
    isLoading: isCompletedLoading,
    loadCompletedTodos,
  } = useCompletedTodos({ database, selectedDate })

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
  })

  // ピン留めされたエントリーのみをフィルタリング
  const pinnedEntries = useMemo(() => {
    return filteredTimelineItems.filter(
      (item) => item.type === 'entry' && item.pinned === true
    )
  }, [filteredTimelineItems])

  return (
    <div className="app">
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
          currentEntry={currentEntry}
          onEntryChange={setCurrentEntry}
          onSubmit={handleAddEntry}
          onKeyDown={handleKeyDown}
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
        />

        <CurrentActivitySection
          isLoading={isTodosLoading}
          todoItems={todoItems}
          onScrollToEntry={scrollToEntry}
          onScrollToReply={scrollToReply}
          onStatusChange={async (todo, newStatus) => {
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
          onAddReply={handleAddReply}
          onToggleReplies={toggleEntryReplies}
          onScrollToEntry={scrollToEntry}
          onTogglePin={handleTogglePin}
          onToggleArchive={handleToggleArchive}
          onUpdateEntryDirectly={async (entryId, newContent) => {
            await handleDirectUpdateEntry(entryId, newContent)
            await loadTodos()
            await loadCompletedTodos()
          }}
          onDirectTagAdd={handleDirectTagAdd}
          onDirectTagRemove={handleDirectTagRemove}
          onUpdateReplyDirectly={async (replyId, newContent) => {
            await handleDirectUpdateReply(replyId, newContent)
            await loadTodos()
            await loadCompletedTodos()
          }}
          onToggleReplyArchive={async (replyId, entryId) => {
            await handleToggleReplyArchive(replyId, entryId)
            await loadTodos()
          }}
        />
      </div>

      <PinnedSidebar
        pinnedItems={pinnedEntries}
        onItemClick={scrollToEntry}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <CompletedTasksSidebar
        completedItems={completedItems}
        isLoading={isCompletedLoading}
        onItemClick={scrollToEntry}
        isOpen={doneSidebarOpen}
        onToggle={() => setDoneSidebarOpen(!doneSidebarOpen)}
      />

      <DeleteConfirmDialogs
        deleteDialogOpen={deleteDialogOpen}
        onDeleteDialogOpenChange={setDeleteDialogOpen}
        onDeleteEntry={handleDeleteEntry}
        deleteReplyDialogOpen={deleteReplyDialogOpen}
        onDeleteReplyDialogOpenChange={setDeleteReplyDialogOpen}
        onDeleteReply={handleDeleteReply}
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
    </div>
  )
}

export default App
