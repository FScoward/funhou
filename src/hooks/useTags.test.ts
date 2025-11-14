import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useTags } from './useTags'
import * as tagsLib from '@/lib/tags'

// Mock the tags library
vi.mock('@/lib/tags', () => ({
  getAllTags: vi.fn(),
  deleteTag: vi.fn(),
}))

describe('useTags', () => {
  const mockDatabase = {} as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load available tags when database is provided', async () => {
    const mockTags = [
      { id: 1, name: 'tag1' },
      { id: 2, name: 'tag2' },
    ]

    vi.mocked(tagsLib.getAllTags).mockResolvedValue(mockTags)

    const { result } = renderHook(() =>
      useTags({
        database: mockDatabase,
        loadEntries: vi.fn(),
      })
    )

    // Initially, availableTags should be empty
    expect(result.current.availableTags).toEqual([])

    // Wait for the effect to run and load tags
    await waitFor(() => {
      expect(result.current.availableTags).toEqual(mockTags)
    })

    // Verify getAllTags was called with the database
    expect(tagsLib.getAllTags).toHaveBeenCalledWith(mockDatabase)
  })

  it('should not load tags when database is null', async () => {
    const { result } = renderHook(() =>
      useTags({
        database: null,
        loadEntries: vi.fn(),
      })
    )

    // availableTags should remain empty
    expect(result.current.availableTags).toEqual([])

    // getAllTags should not be called
    expect(tagsLib.getAllTags).not.toHaveBeenCalled()
  })

  it('should reload tags when database changes', async () => {
    const mockTags1 = [{ id: 1, name: 'tag1' }]
    const mockTags2 = [
      { id: 1, name: 'tag1' },
      { id: 2, name: 'tag2' },
    ]

    vi.mocked(tagsLib.getAllTags)
      .mockResolvedValueOnce(mockTags1)
      .mockResolvedValueOnce(mockTags2)

    const { result, rerender } = renderHook(
      ({ db }) =>
        useTags({
          database: db,
          loadEntries: vi.fn(),
        }),
      { initialProps: { db: mockDatabase } }
    )

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.availableTags).toEqual(mockTags1)
    })

    // Change database (simulate reconnection)
    const newDatabase = {} as any
    rerender({ db: newDatabase })

    // Wait for reload
    await waitFor(() => {
      expect(result.current.availableTags).toEqual(mockTags2)
    })

    // Verify getAllTags was called twice
    expect(tagsLib.getAllTags).toHaveBeenCalledTimes(2)
  })

  it('should handle tag click to toggle selection', async () => {
    const { result } = renderHook(() =>
      useTags({
        database: mockDatabase,
        loadEntries: vi.fn(),
      })
    )

    // Initially no tags selected
    expect(result.current.selectedTags).toEqual([])

    // Click a tag to select it
    await waitFor(() => {
      result.current.handleTagClick('tag1')
    })

    await waitFor(() => {
      expect(result.current.selectedTags).toEqual(['tag1'])
    })

    // Click the same tag to deselect it
    await waitFor(() => {
      result.current.handleTagClick('tag1')
    })

    await waitFor(() => {
      expect(result.current.selectedTags).toEqual([])
    })
  })

  it('should allow manual tag addition via loadAvailableTags function', async () => {
    const mockTags = [
      { id: 1, name: 'tag1' },
      { id: 2, name: 'tag2' },
    ]

    vi.mocked(tagsLib.getAllTags).mockResolvedValue(mockTags)

    const { result } = renderHook(() =>
      useTags({
        database: mockDatabase,
        loadEntries: vi.fn(),
      })
    )

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.availableTags).toEqual(mockTags)
    })

    // Add a new tag in database and reload
    const updatedTags = [...mockTags, { id: 3, name: 'tag3' }]
    vi.mocked(tagsLib.getAllTags).mockResolvedValue(updatedTags)

    await result.current.loadAvailableTags()

    // Verify tags were reloaded
    await waitFor(() => {
      expect(result.current.availableTags).toEqual(updatedTags)
    })
  })
})
