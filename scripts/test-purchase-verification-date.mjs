import { projectAcceptedVerification } from '../lib/purchaseLedger/verification.ts'

const original = {
  id: 301,
  date: '2026-06-29',
  status: 'pending_verification',
  created_at: '2026-06-29T03:15:00.000Z',
  verified_by_name: null,
  verified_at: null,
  received_quantity: null,
}

const accepted = projectAcceptedVerification(original, {
  businessDate: '2026-07-01',
  verifiedByName: 'Bruce',
  verifiedAt: '2026-07-01T02:00:00.000Z',
  receivedQuantity: 3,
})

const checks = [
  [accepted.date === '2026-07-01', 'uses the verification business date'],
  [accepted.created_at === original.created_at, 'preserves the original submission timestamp'],
  [accepted.status === 'verified', 'marks the record verified'],
  [accepted.verified_by_name === 'Bruce', 'records the verifier'],
  [accepted.verified_at === '2026-07-01T02:00:00.000Z', 'records the verification timestamp'],
  [accepted.received_quantity === 3, 'records the received quantity'],
]

let failed = 0
for (const [passed, label] of checks) {
  if (passed) console.log(`PASS: ${label}`)
  else {
    failed++
    console.error(`FAIL: ${label}`)
  }
}

process.exit(failed === 0 ? 0 : 1)
