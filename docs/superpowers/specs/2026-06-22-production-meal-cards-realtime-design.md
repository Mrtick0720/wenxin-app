# Production Meal Cards and Realtime Design

## Goal

Make Production Sheet update after order edits and aggregate production by meal rather than by customer order.

## Structured menu snapshot

Each order stores `production_lines` inside `bento_items`. Every line contains a stable key, meal label, three compartment descriptions, and quantity. It also stores `completed_line_keys`.

New and edited orders write the snapshot. Existing orders without it fall back to one legacy production line.

## Production aggregation

Production expands every order into production lines, then merges lines with the same key into one meal card within the same ready-time/fulfillment block. The card shows total quantity and a customer breakdown.

Marking a meal card Done updates that line for every contributing order. An order becomes completed only when all its production lines are done.

## Realtime refresh

Production reloads from:

- Supabase changes on `bento_orders`;
- the local `bento-order-updated` event, including old and new dates;
- browser focus;
- document visibility returning to visible.

## Compatibility

Legacy orders continue to display as one production card. Editing an order upgrades it to the structured snapshot.
