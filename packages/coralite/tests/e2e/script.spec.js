import { test, expect } from '@playwright/test'

test.describe('Script-based Components', () => {
  test.describe('Counter Component', () => {
    test('should increment counter with default step (1)', async ({ page }) => {
      await page.goto('/script-counter.html')

      // Get the first counter container (after coralite-counter is replaced)
      const firstCounter = page.locator('.counter-container').first()
      const button = firstCounter.locator('button')
      const display = firstCounter.locator('span[data-coralite-ref*="count-display"]')

      // Initial state
      await expect(display).toHaveText('0')

      // Click once
      await button.click()
      await expect(display).toHaveText('1')

      // Click again
      await button.click()
      await expect(display).toHaveText('2')
    })

    test('should increment counter with custom step (5)', async ({ page }) => {
      await page.goto('/script-counter.html')

      // Get the second counter (step=5) - it's the second counter-container
      const secondCounter = page.locator('.counter-container').nth(1)
      const button = secondCounter.locator('button')
      const display = secondCounter.locator('span[data-coralite-ref*="count-display"]')
      const status = secondCounter.locator('div[data-coralite-ref*="status-message"]')

      // Initial state
      await expect(display).toHaveText('0')

      // Click once - should increase by 5
      await button.click()
      await expect(display).toHaveText('5')
      await expect(status).toHaveText('Count increased by 5')
      await expect(status).toHaveCSS('color', 'rgb(0, 128, 0)') // green
    })

    test('should stop at max value', async ({ page }) => {
      await page.goto('/script-counter.html')

      // Get the third counter (max=10) - third counter-container
      const thirdCounter = page.locator('.counter-container').nth(2)
      const button = thirdCounter.locator('button')
      const display = thirdCounter.locator('span[data-coralite-ref*="count-display"]')
      const status = thirdCounter.locator('div[data-coralite-ref*="status-message"]')

      // Click 10 times to reach max
      for (let i = 0; i < 10; i++) {
        await button.click()
      }

      // Should stop at 10
      await expect(display).toHaveText('10')
      await expect(status).toHaveText('Max value 10 reached!')
      await expect(status).toHaveCSS('color', 'rgb(255, 0, 0)') // red
      await expect(button).toBeDisabled()
    })

    test('should work with step=3 and max=15', async ({ page }) => {
      await page.goto('/script-counter.html')

      // Get the fourth counter (step=3, max=15) - fourth counter-container
      const fourthCounter = page.locator('.counter-container').nth(3)
      const button = fourthCounter.locator('button')
      const display = fourthCounter.locator('span[data-coralite-ref*="count-display"]')
      const status = fourthCounter.locator('div[data-coralite-ref*="status-message"]')

      // Click 5 times (5 * 3 = 15)
      for (let i = 0; i < 5; i++) {
        await button.click()
      }

      await expect(display).toHaveText('15')
      await expect(status).toHaveText('Max value 15 reached!')
      await expect(button).toBeDisabled()
    })
  })

  test.describe('Form Validation Component', () => {
    test('should validate email on blur', async ({ page }) => {
      await page.goto('/script-form.html')

      // Get first form (after coralite-form-validator is replaced)
      const form = page.locator('form.validation-form').first()
      const emailInput = form.locator('input[type="email"]')
      const emailError = form.locator('span[data-coralite-ref*="email-error"]')

      // Empty email
      await emailInput.focus()
      await emailInput.blur()
      await expect(emailError).toHaveText('Email is required')
      await expect(emailError).toHaveCSS('color', 'rgb(255, 0, 0)')

      // Invalid email
      await emailInput.fill('invalid-email')
      await emailInput.blur()
      await expect(emailError).toHaveText('Invalid email format')
      await expect(emailError).toHaveCSS('color', 'rgb(255, 0, 0)')

      // Valid email
      await emailInput.fill('test@example.com')
      await emailInput.blur()
      await expect(emailError).toHaveText('✓ Valid email')
      await expect(emailError).toHaveCSS('color', 'rgb(0, 128, 0)')
    })

    test('should validate password on input', async ({ page }) => {
      await page.goto('/script-form.html')

      const form = page.locator('form.validation-form').first()
      const passwordInput = form.locator('input[type="password"]')
      const passwordError = form.locator('span[data-coralite-ref*="password-error"]')

      // Short password
      await passwordInput.fill('short')
      await expect(passwordError).toHaveText('Password must be at least 8 characters')
      await expect(passwordError).toHaveCSS('color', 'rgb(255, 0, 0)')

      // Valid password
      await passwordInput.fill('longpassword')
      await expect(passwordError).toHaveText('✓ Strong password')
      await expect(passwordError).toHaveCSS('color', 'rgb(0, 128, 0)')
    })

    test('should submit form with valid data', async ({ page }) => {
      await page.goto('/script-form.html')

      const form = page.locator('form.validation-form').first()
      const emailInput = form.locator('input[type="email"]')
      const passwordInput = form.locator('input[type="password"]')
      const submitBtn = form.locator('button[type="submit"]')
      const successMessage = form.locator('div[data-coralite-ref*="success-message"]')

      // Fill valid data
      await emailInput.fill('test@example.com')
      await emailInput.blur()
      await passwordInput.fill('password123')

      // Submit
      await submitBtn.click()

      // Check success message
      await expect(successMessage).toHaveText('Form submitted successfully! Email: test@example.com')
      await expect(successMessage).toHaveCSS('color', 'rgb(0, 128, 0)')
      await expect(submitBtn).toBeDisabled()

      // Wait for reset
      await page.waitForTimeout(3100)
      await expect(emailInput).toHaveValue('')
      await expect(passwordInput).toHaveValue('')
      await expect(submitBtn).not.toBeDisabled()
    })

    test('should prevent submission with invalid data', async ({ page }) => {
      await page.goto('/script-form.html')

      const form = page.locator('form.validation-form').first()
      const emailInput = form.locator('input[type="email"]')
      const passwordInput = form.locator('input[type="password"]')
      const submitBtn = form.locator('button[type="submit"]')

      // Invalid email
      await emailInput.fill('invalid')
      await passwordInput.fill('password123')
      await submitBtn.click()

      // Should show error (email validation happens on blur, so it shows "Invalid email format")
      const emailError = form.locator('span[data-coralite-ref*="email-error"]')
      await expect(emailError).toHaveText('Invalid email format')

      // Fix email but invalid password
      await emailInput.fill('test@example.com')
      await emailInput.blur()
      await passwordInput.fill('short')
      await submitBtn.click()

      const passwordError = form.locator('span[data-coralite-ref*="password-error"]')
      await expect(passwordError).toHaveText('Password must be at least 8 characters')
    })

    test('should work with custom min length', async ({ page }) => {
      await page.goto('/script-form.html')

      // Get second form with min-length=3
      const form = page.locator('form.validation-form').nth(1)
      const passwordInput = form.locator('input[type="password"]')
      const passwordError = form.locator('span[data-coralite-ref*="password-error"]')

      // 2 characters - too short
      await passwordInput.fill('ab')
      await expect(passwordError).toHaveText('Password must be at least 3 characters')

      // 3 characters - valid
      await passwordInput.fill('abc')
      await expect(passwordError).toHaveText('✓ Strong password')
    })
  })

  test.describe('Dynamic Content Component', () => {
    test('should add and remove items', async ({ page }) => {
      await page.goto('/script-dynamic.html')

      // Get first dynamic container (after coralite-dynamic-content is replaced)
      const component = page.locator('.dynamic-container').first()
      const addBtn = component.locator('button[data-coralite-ref*="add-btn"]')
      const removeBtn = component.locator('button[data-coralite-ref*="remove-btn"]')
      const clearBtn = component.locator('button[data-coralite-ref*="clear-btn"]')
      const counter = component.locator('div[data-coralite-ref*="counter-display"]')
      const contentArea = component.locator('div[data-coralite-ref*="content-area"]')
      const logDisplay = component.locator('div[data-coralite-ref*="log-display"]')

      // Initial state (script clears content area, so it's empty)
      await expect(counter).toHaveText('Items: 0')
      await expect(contentArea).toBeEmpty()

      // Add item
      await addBtn.click()
      await expect(counter).toHaveText('Items: 1')
      await expect(contentArea).toContainText('Item 1:')
      await expect(logDisplay).toHaveText('+1')

      // Add another
      await addBtn.click()
      await expect(counter).toHaveText('Items: 2')
      await expect(logDisplay).toHaveText('+1 | +2')

      // Remove last
      await removeBtn.click()
      await expect(counter).toHaveText('Items: 1')
      // Log shows last 3 entries
      await expect(logDisplay).toHaveText('+1 | +2 | -1')

      // Clear all
      await clearBtn.click()
      await expect(counter).toHaveText('Items: 0')
      await expect(contentArea).toBeEmpty()
      // Log shows last 3 entries, so it includes previous operations
      await expect(logDisplay).toHaveText('+2 | -1 | C')
    })

    test('should use custom prefix', async ({ page }) => {
      await page.goto('/script-dynamic.html')

      // Get second component with prefix="Task"
      const component = page.locator('.dynamic-container').nth(1)
      const addBtn = component.locator('button[data-coralite-ref*="add-btn"]')
      const contentArea = component.locator('div[data-coralite-ref*="content-area"]')

      await addBtn.click()
      await expect(contentArea).toContainText('Task 1:')
    })
  })

  test.describe('State Manager Component', () => {
    test('should display initial state', async ({ page }) => {
      await page.goto('/script-state.html')

      // Get first state manager container
      const component = page.locator('.state-manager').first()
      const stateValue = component.locator('span[data-coralite-ref*="state-value"]')
      const instanceId = component.locator('span[data-coralite-ref*="instance-id"]')
      const templateId = component.locator('span[data-coralite-ref*="template-id"]')

      await expect(stateValue).toContainText('"value":"default"')
      await expect(stateValue).toContainText('"count":0')
      await expect(stateValue).toContainText('"active":false')
      await expect(templateId).toHaveText('coralite-state-manager')
    })

    test('should update state', async ({ page }) => {
      await page.goto('/script-state.html')

      const component = page.locator('.state-manager').first()
      const updateBtn = component.locator('button[data-coralite-ref*="update-btn"]')
      const stateValue = component.locator('span[data-coralite-ref*="state-value"]')
      const history = component.locator('div[data-coralite-ref*="history"]')

      // Update multiple times
      await updateBtn.click()
      await expect(stateValue).toContainText('"count":1')
      await expect(stateValue).toContainText('"value":"updated-1"')
      await expect(history).toHaveText('U1')

      await updateBtn.click()
      await expect(stateValue).toContainText('"count":2')
      await expect(history).toHaveText('U1 | U2')
    })

    test('should reset state', async ({ page }) => {
      await page.goto('/script-state.html')

      const component = page.locator('.state-manager').first()
      const updateBtn = component.locator('button[data-coralite-ref*="update-btn"]')
      const resetBtn = component.locator('button[data-coralite-ref*="reset-btn"]')
      const stateValue = component.locator('span[data-coralite-ref*="state-value"]')
      const history = component.locator('div[data-coralite-ref*="history"]')

      // Update first
      await updateBtn.click()
      await expect(stateValue).toContainText('"count":1')

      // Reset
      await resetBtn.click()
      await expect(stateValue).toContainText('"count":0')
      await expect(stateValue).toContainText('"value":"default"')
      await expect(history).toHaveText('U1 | R')
    })

    test('should toggle state', async ({ page }) => {
      await page.goto('/script-state.html')

      const component = page.locator('.state-manager').first()
      const toggleBtn = component.locator('button[data-coralite-ref*="toggle-btn"]')
      const stateValue = component.locator('span[data-coralite-ref*="state-value"]')
      const history = component.locator('div[data-coralite-ref*="history"]')

      // Toggle on
      await toggleBtn.click()
      await expect(stateValue).toContainText('"active":true')
      await expect(history).toHaveText('T1')

      // Toggle off
      await toggleBtn.click()
      await expect(stateValue).toContainText('"active":false')
      await expect(history).toHaveText('T1 | T0')
    })

    test('should use custom initial values', async ({ page }) => {
      await page.goto('/script-state.html')

      // Get second component with custom values
      const component = page.locator('.state-manager').nth(1)
      const stateValue = component.locator('span[data-coralite-ref*="state-value"]')

      // Values from attributes are strings
      await expect(stateValue).toContainText('"value":"custom"')
      await expect(stateValue).toContainText('"count":"5"')
      await expect(stateValue).toContainText('"active":"true"')
    })

    test('should have unique instance IDs', async ({ page }) => {
      await page.goto('/script-state.html')

      // Get two instances
      const component1 = page.locator('.state-manager').nth(2)
      const component2 = page.locator('.state-manager').nth(3)

      const id1 = component1.locator('span[data-coralite-ref*="instance-id"]')
      const id2 = component2.locator('span[data-coralite-ref*="instance-id"]')

      const id1Text = await id1.textContent()
      const id2Text = await id2.textContent()

      // Should be different
      expect(id1Text).not.toBe(id2Text)
    })
  })
})
