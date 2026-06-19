# Bento Customer Subscription Modes Design

## Goal

Add two persisted subscription modes to Bento customers:

- `fixed`: meals follow a generated daily or weekday schedule.
- `flexible`: meals are credits consumed only when linked orders are delivered.

Existing customers remain fixed. The change must preserve current fixed schedules and make flexible credit accounting correct regardless of which Bento screen completes an order.

## Data model

### `bento_customers`

Add:

- `subscription_mode text not null default 'fixed'`
  - Allowed values: `fixed`, `flexible`.
- `credit_expiry_date date null`
  - Used only by flexible customers.

Existing fields keep their meanings:

- `total_portions`: total scheduled meals for fixed customers; total purchased credits for flexible customers.
- `used_portions`: delivered meals. For flexible customers this value is maintained by a database trigger.
- `delivery_frequency`, `start_date`: fixed-only schedule fields.

### `bento_orders`

Add:

- `customer_id bigint null references bento_customers(id) on delete set null`

New customer-linked orders must store `customer_id`. Customer names remain denormalized display snapshots but are not used for credit accounting.

Existing subscription-linked orders are backfilled from `bento_subscription_days.order_id`. The migration does not infer customer IDs from names because names are not unique.

## Flexible credit accounting

An order contributes credits only when all are true:

- It has `customer_id`.
- The customer is `subscription_mode = 'flexible'`.
- The order status is `completed`.

The contribution is the order's non-negative quantity, defaulting to one.

An `AFTER INSERT OR UPDATE OR DELETE` trigger on `bento_orders` applies contribution deltas:

- Pending/scheduled insert: zero.
- Completed insert: add quantity.
- Pending to completed: add quantity.
- Completed quantity edit: apply new quantity minus old quantity.
- Completed to pending/canceled: subtract old quantity.
- Completed order deletion: subtract old quantity.
- Completed order reassignment: restore the old customer and charge the new flexible customer.

`used_portions` is never allowed below zero. Fixed customers are never changed by this trigger.

## New Customer form

Add required Subscription Mode before schedule fields:

- Fixed Schedule
- Flexible Credits

Fixed Schedule shows:

- Delivery Frequency: Daily / Weekdays
- Start Date
- Total Meals
- Read-only Estimated End Date preview

Flexible Credits shows:

- Total Meal Credits
- Optional Expiry Date

Creating a flexible customer stores:

- `subscription_mode = 'flexible'`
- `total_portions = total credits`
- `used_portions = 0`
- `credit_expiry_date`
- no generated subscription days

## Customer list

Each customer card shows one mode badge:

- `Fixed · Daily`
- `Fixed · Weekdays`
- `Flexible`

Existing grouping by weekly/monthly/school remains unchanged unless separately redesigned.

## Customer detail

### Fixed

Keep:

- Subscription usage
- Start and estimated end
- Subscription calendar
- Fixed schedule controls

### Flexible

Show:

- Total credits
- Delivered credits
- Remaining balance
- Optional expiry date
- Upcoming linked orders

Hide:

- Estimated end date
- Generated subscription calendar
- Fixed schedule controls

Flexible details must not call subscription-day generation.

The optional expiry date is informational in this initial implementation. It is stored and displayed, but does not automatically cancel orders or block completion.

## Order creation and updates

Customer-aware order creation must save `customer_id`. Existing status update paths remain unchanged because the trigger performs accounting.

Order editing must preserve `customer_id` and quantity. No client code should directly increment flexible `used_portions`; doing so would double-charge credits.

## Safety and rollout

1. Apply the migration before deploying UI code.
2. Existing customers automatically remain fixed.
3. Backfill only orders that are already linked through `bento_subscription_days`.
4. Verify trigger transitions in a transaction before enabling flexible customers.
5. Deploy UI changes after the schema is present.

## Acceptance criteria

- Fixed customers behave as they do today.
- Flexible customers never generate subscription dates.
- Pending and canceled flexible orders consume zero credits.
- Completed flexible orders consume their actual quantity.
- Quantity edits and status reversals reconcile by exact delta.
- Customer cards and details render the correct mode-specific UI.
