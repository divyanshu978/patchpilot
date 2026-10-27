/**
 * Internal shared types for service modules. Not exported from the package.
 *
 * @typedef {object} RawFinding
 * @property {string}  title
 * @property {string}  description
 * @property {string}  severity    — CRITICAL | HIGH | MEDIUM | LOW | INFO
 * @property {string}  category    — SECURITY | BUG | PERFORMANCE | TEST | MAINTAINABILITY | STYLE | DEPENDENCY
 * @property {string|null}  filePath
 * @property {number|null}  startLine
 * @property {number|null}  endLine
 * @property {string|null}  evidence
 * @property {string|null}  suggestedFix
 * @property {number}  confidence
 * @property {string}  source      — 'heuristic' | 'eslint' | 'ai' | 'test-gap'
 * @property {string}  ruleId
 *
 * @typedef {object} ESLintMessage
 * @property {number}  line
 * @property {number}  column
 * @property {string}  message
 * @property {string}  ruleId
 * @property {'error'|'warn'} severity
 */

// This file is only documentation; no runtime exports needed.
export {};