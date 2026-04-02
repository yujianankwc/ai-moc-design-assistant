alter table public.intent_orders
drop constraint if exists intent_orders_status_check;

alter table public.intent_orders
add constraint intent_orders_status_check
check (
  status in (
    'new',
    'contact_pending',
    'contacted',
    'confirming',
    'quoted',
    'deposit_pending',
    'locked',
    'preparing_delivery',
    'delivering',
    'delivered',
    'closed_won',
    'closed_lost'
  )
);
