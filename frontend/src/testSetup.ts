import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// runs before every frontend test file

// clear the page between tests so they don't affect each other
afterEach(cleanup)

// jsdom has no <dialog> methods yet, so add simple versions that open and close it
HTMLDialogElement.prototype.showModal = function showModal() {
  this.open = true
}
HTMLDialogElement.prototype.close = function close() {
  this.open = false
  this.dispatchEvent(new Event('close'))
}
