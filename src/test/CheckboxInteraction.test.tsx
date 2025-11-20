import { render, screen, fireEvent } from '@testing-library/react'
import MarkdownPreview from '../components/MarkdownPreview'
import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom'

describe('MarkdownPreview Checkbox Interaction', () => {
    it('should call onContentUpdate with updated content when a checkbox is clicked', () => {
        const content = '- [ ] Task 1\n- [x] Task 2'
        const onContentUpdate = vi.fn()

        render(
            <MarkdownPreview
                content={content}
                onContentUpdate={onContentUpdate}
            />
        )

        // Find checkboxes
        const checkboxes = screen.getAllByRole('checkbox')
        expect(checkboxes).toHaveLength(2)

        // Click the first checkbox (unchecked -> checked)
        fireEvent.click(checkboxes[0])

        expect(onContentUpdate).toHaveBeenCalledWith('- [x] Task 1\n- [x] Task 2')
    })

    it('should uncheck a checked checkbox', () => {
        const content = '- [x] Task 1'
        const onContentUpdate = vi.fn()

        render(
            <MarkdownPreview
                content={content}
                onContentUpdate={onContentUpdate}
            />
        )

        const checkbox = screen.getByRole('checkbox')
        fireEvent.click(checkbox)

        expect(onContentUpdate).toHaveBeenCalledWith('- [ ] Task 1')
    })

    it('should not be interactive if onContentUpdate is not provided', () => {
        const content = '- [ ] Task 1'

        render(<MarkdownPreview content={content} />)

        const checkbox = screen.getByRole('checkbox')
        expect(checkbox).toBeDisabled()
    })
})
