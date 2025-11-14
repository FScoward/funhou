import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'

interface DeleteConfirmDialogsProps {
  // エントリー削除
  deleteDialogOpen: boolean
  onDeleteDialogOpenChange: (open: boolean) => void
  onDeleteEntry: () => void
  // 返信削除
  deleteReplyDialogOpen: boolean
  onDeleteReplyDialogOpenChange: (open: boolean) => void
  onDeleteReply: () => void
  // タグ削除
  deleteTagDialogOpen: boolean
  onDeleteTagDialogOpenChange: (open: boolean) => void
  onDeleteTag: () => void
  deleteTagTarget: string | null
}

export function DeleteConfirmDialogs({
  deleteDialogOpen,
  onDeleteDialogOpenChange,
  onDeleteEntry,
  deleteReplyDialogOpen,
  onDeleteReplyDialogOpenChange,
  onDeleteReply,
  deleteTagDialogOpen,
  onDeleteTagDialogOpenChange,
  onDeleteTag,
  deleteTagTarget,
}: DeleteConfirmDialogsProps) {
  return (
    <>
      <AlertDialog open={deleteDialogOpen} onOpenChange={onDeleteDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>エントリーを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteEntry}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteReplyDialogOpen} onOpenChange={onDeleteReplyDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>返信を削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteReply}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteTagDialogOpen} onOpenChange={onDeleteTagDialogOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>タグを削除しますか？</AlertDialogTitle>
            <AlertDialogDescription>
              タグ「{deleteTagTarget}」を削除します。このタグが付いているエントリーや返信からも削除されます。
              この操作は取り消せません。本当に削除してもよろしいですか？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={onDeleteTag}>削除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
