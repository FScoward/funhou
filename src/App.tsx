import { useState, useMemo } from 'react'
import './App.css'
import { SettingsDialog } from '@/components/SettingsDialog'
import { TagFilter } from '@/components/TagFilter'
import { DateNavigation } from '@/components/DateNavigation'
import { DeleteConfirmDialogs } from '@/components/DeleteConfirmDialogs'
import { InputSection } from '@/components/InputSection'
import { Timeline } from '@/components/Timeline'
import { PinnedSidebar } from '@/components/PinnedSidebar'
import { useDatabase } from '@/hooks/useDatabase'
import { useDateNavigation } from '@/hooks/useDateNavigation'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useTimeline } from '@/hooks/useTimeline'
import { useTags } from '@/hooks/useTags'
import { useEntries } from '@/hooks/useEntries'
import { useReplies } from '@/hooks/useReplies'

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // データベース
  const database = useDatabase()

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
  } = useTags({ database, loadEntries: async () => {} })

  // タイムライン
  const { timelineItems: filteredTimelineItems, setTimelineItems: setFilteredTimelineItems, handleScrollToEntry: scrollToEntry } = useTimeline({
    database,
    selectedDate,
    selectedTags,
    filterMode,
  })

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
          onSettingsClick={() => setSettingsOpen(true)}
        />

        <div className="tag-filter-section">
          <TagFilter
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
            onClearAll={() => {
              setSelectedTags([])
            }}
            onTagDelete={openDeleteTagDialog}
          />
        </div>

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
        />

        <Timeline
          timelineItems={filteredTimelineItems}
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
        />
      </div>

      <PinnedSidebar
        pinnedItems={pinnedEntries}
        onItemClick={scrollToEntry}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
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

      {database && (
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          db={database}
        />
      )}
    </div>
  )
}

export default App
