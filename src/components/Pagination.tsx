interface PaginationProps {
  currentPage: number
  totalPages: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) {
    return null // ページが1つしかない場合は何も表示しない
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="pagination">
      <button
        onClick={handlePrevious}
        disabled={currentPage === 1}
        className="nav-button"
        aria-label="前のページ"
      >
        ◀
      </button>
      <div className="pagination-info">
        <span className="page-number">
          {currentPage} / {totalPages}
        </span>
        <span className="item-count">
          ({startItem}-{endItem} / {totalItems}件)
        </span>
      </div>
      <button
        onClick={handleNext}
        disabled={currentPage === totalPages}
        className="nav-button"
        aria-label="次のページ"
      >
        ▶
      </button>
    </div>
  )
}
