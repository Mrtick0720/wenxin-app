# Bento Unpaid Daily Bills Design

## Goal

Make the Bento unpaid workflow match how customers are billed: one bill per
customer per natural day, with payment applied to that full daily bill.

Also restore normal vertical scrolling on the Unpaid Orders page.

## Navigation Flow

The page uses three levels:

1. **Customers** — each customer appears once with their total outstanding
   amount and number of unpaid daily bills.
2. **Daily bills** — tapping a customer shows one row per natural date.
3. **Bill detail** — tapping a date opens a bottom sheet showing all Bento
   orders included in that day's bill.

The green `Mark All Paid` button appears only inside the selected daily bill
detail. It marks every unpaid Bento order for that customer and date as paid.
It does not affect the customer's other dates.

## Grouping Rules

Orders are grouped first by normalized customer name and then by the database
`date` value (`YYYY-MM-DD`).

Each daily bill displays:

- formatted date;
- total amount for all included orders;
- number of included order rows;
- order item descriptions and individual amounts in the detail sheet.

Canceled and already-paid orders remain excluded from the page.

## Payment Update

When `Mark All Paid` is tapped:

1. collect the IDs of all orders in the selected daily bill;
2. update those rows to `paid = true`;
3. also set `payment_status = 'paid'` and `amount_paid = amount` so the newer
   payment fields stay consistent;
4. remove the paid orders from local state after the database update succeeds;
5. close the detail sheet;
6. remove empty dates and customers automatically through derived grouping.

If the update fails, keep the bill open and show the database or network error.

## Scrolling

`UnpaidPage` becomes a full-height flex column. The header remains fixed within
the page and the content area receives its own `overflow-y-auto`,
`min-height: 0`, iOS momentum scrolling, and safe-area bottom padding.

This avoids relying on an outer navigation container whose overflow may be
locked by the custom stack.

## Bill Detail Sheet

The daily bill detail is rendered in a portal above the navigation stack.

It includes:

- customer name;
- bill date;
- bill total;
- all included order lines;
- one green `Mark All Paid` button;
- close by tapping the overlay or close control.

The payment button is disabled while the batch update is running.

## Verification

Automated tests will verify:

- multiple orders for the same customer and date form one bill;
- different dates form separate bills;
- different customers never merge;
- daily totals and order counts are correct;
- the selected bill exposes only its own order IDs;
- paid and canceled orders are excluded;
- the page source contains an explicit vertical scroll container;
- TypeScript and lint checks pass.
