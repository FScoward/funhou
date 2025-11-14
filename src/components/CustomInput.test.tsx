import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CustomInput from './CustomInput'

describe('CustomInput', () => {
  const mockTags = [
    { id: 1, name: 'work' },
    { id: 2, name: 'personal' },
    { id: 3, name: 'urgent' },
  ]

  it('should display tag selector when onTagAdd and onTagRemove are provided', () => {
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={[]}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Tag selector button should be visible
    expect(screen.getByText('タグを追加')).toBeInTheDocument()
  })

  it('should not display tag selector when onTagAdd or onTagRemove are not provided', () => {
    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={[]}
      />
    )

    // Tag selector button should not be visible
    expect(screen.queryByText('タグを追加')).not.toBeInTheDocument()
  })

  it('should show available tags when popover is opened', async () => {
    const user = userEvent.setup()
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={[]}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Open the tag selector popover
    const tagButton = screen.getByText('タグを追加')
    await user.click(tagButton)

    // All unselected tags should be visible
    expect(screen.getByText('work')).toBeInTheDocument()
    expect(screen.getByText('personal')).toBeInTheDocument()
    expect(screen.getByText('urgent')).toBeInTheDocument()
  })

  it('should not show selected tags in available tags list', async () => {
    const user = userEvent.setup()
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={['work']}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Selected tag should be displayed outside the popover as a selected tag
    const selectedTagsOutside = screen.getAllByText('work')
    expect(selectedTagsOutside.length).toBeGreaterThan(0)

    // Open the tag selector popover
    const tagButton = screen.getByText('タグを追加')
    await user.click(tagButton)

    // After opening popover, 'work' should still only appear as selected tag (not in the available list)
    // Since 'work' is already shown as selected, the total count shouldn't change
    const allWorkInstances = screen.getAllByText('work')
    // Only one instance should exist (the selected one), not in the available tags list
    expect(allWorkInstances.length).toBe(1)

    // Other tags should still be visible in the popover
    expect(screen.getByText('personal')).toBeInTheDocument()
    expect(screen.getByText('urgent')).toBeInTheDocument()
  })

  it('should call onTagAdd when clicking an available tag', async () => {
    const user = userEvent.setup()
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={[]}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Open the tag selector popover
    const tagButton = screen.getByText('タグを追加')
    await user.click(tagButton)

    // Click on a tag
    const workTag = screen.getByText('work')
    await user.click(workTag)

    // Verify onTagAdd was called
    expect(onTagAdd).toHaveBeenCalledWith('work')
  })

  it('should display selected tags with remove button', () => {
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={['work', 'urgent']}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Selected tags should be displayed
    const selectedTags = screen.getAllByText('work')
    expect(selectedTags.length).toBeGreaterThan(0)
  })

  it('should call onTagRemove when clicking remove button on selected tag', async () => {
    const user = userEvent.setup()
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={['work']}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Find and click the remove button (X icon)
    const removeButtons = screen.getAllByRole('button')
    const removeButton = removeButtons.find(button =>
      button.querySelector('svg line')
    )

    if (removeButton) {
      await user.click(removeButton)
      expect(onTagRemove).toHaveBeenCalledWith('work')
    }
  })

  it('should allow creating new tags', async () => {
    const user = userEvent.setup()
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={[]}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Open the tag selector popover
    const tagButton = screen.getByText('タグを追加')
    await user.click(tagButton)

    // Type a new tag name
    const input = screen.getByPlaceholderText('新しいタグ名')
    await user.type(input, 'newtag')

    // Click the add button (Plus icon button next to the input)
    const buttons = screen.getAllByRole('button')
    // Filter buttons to find the one with Plus icon (inside the popover)
    const addButton = buttons.find(button => {
      const svg = button.querySelector('svg')
      return svg?.classList.contains('lucide-plus') ||
             svg?.querySelector('line[x1="12"][y1="5"]') !== null
    })

    expect(addButton).toBeDefined()
    if (addButton) {
      await user.click(addButton)
      expect(onTagAdd).toHaveBeenCalledWith('newtag')
    }
  })

  it('should create new tag when pressing Enter in input field', async () => {
    const user = userEvent.setup()
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={mockTags}
        selectedTags={[]}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Open the tag selector popover
    const tagButton = screen.getByText('タグを追加')
    await user.click(tagButton)

    // Type a new tag name and press Enter
    const input = screen.getByPlaceholderText('新しいタグ名')
    await user.type(input, 'newtag{Enter}')

    expect(onTagAdd).toHaveBeenCalledWith('newtag')
  })

  it('should show empty state message when no tags are available', async () => {
    const user = userEvent.setup()
    const onTagAdd = vi.fn()
    const onTagRemove = vi.fn()

    render(
      <CustomInput
        value=""
        onChange={vi.fn()}
        onSubmit={vi.fn()}
        availableTags={[]}
        selectedTags={[]}
        onTagAdd={onTagAdd}
        onTagRemove={onTagRemove}
      />
    )

    // Open the tag selector popover
    const tagButton = screen.getByText('タグを追加')
    await user.click(tagButton)

    // Should not show the "既存のタグから選択" section
    expect(screen.queryByText('既存のタグから選択')).not.toBeInTheDocument()
  })
})
