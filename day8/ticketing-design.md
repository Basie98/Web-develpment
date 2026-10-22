# TicketHub: System Design

## 1. Requirements

TicketHub is an online ticketing platform where customers can browse events, choose seats, purchase tickets, and manage their orders. The system must support 2 million registered users and handle sudden traffic increases when popular events go on sale.

### Functional Requirements

- Users can register, log in, and manage their accounts.
- Users can browse and search events by name, date, venue, or category.
- Users can view event details, ticket prices, and seat availability.
- Users can temporarily hold available seats while completing checkout.
- Users can create orders and pay securely for tickets.
- Users can view their orders, purchase history, and tickets.
- Users can cancel eligible orders and release seat holds.
- The system sends order confirmations and ticket notifications.
- The system prevents two customers from purchasing the same seat.
- The system prevents duplicate payment processing when requests are retried.

### Non-Functional Requirements

**Speed:** Event listings should load within approximately two seconds under normal conditions. The system should remain responsive during popular ticket sales.

**Correctness:** A seat must never be sold to two different customers. Orders, payments, and seat reservations must remain consistent when requests fail or are repeated.

**Fairness:** A virtual waiting room should manage traffic during high-demand sales. Queue rules should be consistent and prevent customers from bypassing the queue or reserving unlimited seats.

**Scalability:** The system must support 2 million registered users and approximately 3,333 backend requests per second during the assumed popular sale.

**Availability:** The website should remain operational during traffic spikes. Failures must not result in duplicate sales or lost confirmed purchases.

**Security:** Passwords must be securely hashed. The system must authenticate users, authorize access to orders, protect payment information, and validate incoming requests.

**Reliability:** Payment requests and background jobs must be safe to retry without creating duplicate charges, tickets, or notifications.

## 2. Traffic and Capacity Estimates

These figures are planning assumptions, not measured production results.

### Normal Traffic

Assume:

- 50,000 visitors per day.
- Each visitor views 10 pages per day.
- Each page generates approximately 5 backend requests.
- 5,000 tickets are sold on a normal day.
- The platform has 2 million registered users.

**Daily page views:**

50,000 × 10 = 500,000 page views per day.

**Average page views per second:**

500,000 ÷ 86,400 = approximately 5.8 page views per second.

**Average backend requests per second:**

500,000 × 5 ÷ 86,400 = approximately 29 requests per second.

If peak traffic is five times the daily average, the system should plan for approximately 145 requests per second during normal busy periods.

**Average ticket sales rate:**

5,000 ÷ 86,400 = approximately 0.058 tickets per second, or 3.5 tickets per minute.

### Popular Ticket Sale

Assume a popular concert has 20,000 seats and 200,000 customers attempt to purchase tickets within 10 minutes.

**Average customer arrival rate:**

200,000 ÷ 600 = approximately 333 customers per second.

There are ten times as many interested customers as available seats. At most 20,000 customers can obtain a ticket for this event.

Assume each customer generates approximately 10 page or API requests during browsing and checkout.

**Estimated backend request rate:**

200,000 × 10 ÷ 600 = approximately 3,333 requests per second.

**Average successful ticket sales rate if all seats sell within 10 minutes:**

20,000 ÷ 600 = approximately 33.3 tickets per second.

Actual peak traffic could be higher because customers may refresh pages, retry requests, check seat availability repeatedly, or use automated tools.

### Traffic Comparison

| Measurement | Normal Day | Popular Sale |
|---|---|---|
| Registered users | 2,000,000 | 2,000,000 |
| Visitors or interested customers | 50,000 per day | 200,000 in 10 minutes |
| Page views | 500,000 per day | Depends on customer activity |
| Average backend requests | 29 per second | 3,333 per second |
| Available tickets | 5,000 sold per day (assumption) | 20,000 seats |
| Main challenge | Normal browsing and purchases | Traffic spikes, fairness, and seat contention |

These estimates guide capacity planning. Load testing is required to establish actual server capacity and determine the necessary peak capacity.

### Storage Estimates

Assume TicketHub creates 20,000 completed ticket purchase records per day, with approximately 2 KB of core order and ticket data per purchase.

**Daily storage:**

20,000 × 2 KB = approximately 40 MB per day.

**Annual storage:**

40 MB × 365 = approximately 14.6 GB per year.

This estimate covers only the assumed core purchase records. Actual storage will be higher after accounting for users, event data, database indexes, payment records, audit logs, backups, and other operational data.

### Capacity Planning Decisions

- Use a content delivery network (CDN) to serve static files and reduce unnecessary backend requests.
- Cache frequently requested event details.
- Use multiple application servers behind a load balancer.
- Use a virtual waiting room to control traffic during popular sales.
- Keep seat reservations and purchase operations consistent in the primary database.
- Use read replicas for suitable read-heavy queries.
- Use monitoring, alerts, connection pooling, and load testing to prepare for major events.

## 3. API Design

TicketHub uses a REST API to connect the frontend to the backend. The API uses JSON for request and response bodies and HTTPS for secure communication.

### Main Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Log in a user |
| GET | `/api/events` | Browse and search events |
| GET | `/api/events/{eventId}` | View event details |
| GET | `/api/events/{eventId}/seats` | View seat availability |
| POST | `/api/holds` | Temporarily hold a seat |
| DELETE | `/api/holds/{holdId}` | Release an eligible hold |
| POST | `/api/orders` | Create an order from a valid hold |
| GET | `/api/orders/{orderId}` | View an order |
| GET | `/api/users/me/orders` | View the logged-in user's orders |
| POST | `/api/payments` | Initiate payment for an order |
| POST | `/api/payments/webhook` | Receive payment-provider notifications |

Authenticated endpoints require a valid session or access token. Users may access only their own orders and holds unless they have authorized administrative permissions.

### Example Seat-Hold Request

`POST /api/holds`

Request:

```json
{
  "event_id": 101,
  "seat_id": 2401
}
```

Example successful response:

```json
{
  "hold_id": 501,
  "event_id": 101,
  "seat_id": 2401,
  "status": "active",
  "expires_at": "2026-10-22T15:10:00Z"
}
```

The backend determines the hold expiry time. The frontend must not be trusted to decide whether a seat is available or how long a hold should last.

If the seat is already held or sold, the API returns `409 Conflict`.

### Example Order Request

`POST /api/orders`

Request:

```json
{
  "hold_id": 501
}
```

Example successful response:

```json
{
  "order_id": 9001,
  "status": "pending",
  "total_amount": 750.00,
  "currency": "ZAR"
}
```

The backend verifies that the hold belongs to the authenticated user, is still valid, and has not already been used. The server calculates the price using its own records rather than trusting a price supplied by the client.

### Example Payment Request

`POST /api/payments`

Request:

```json
{
  "order_id": 9001,
  "payment_method_token": "example_payment_token"
}
```

The client sends a payment token supplied by the payment provider rather than raw card details. The request includes an idempotency key in its HTTP headers.

Example header:

```text
Idempotency-Key: payment-order-9001-attempt-1
```

Repeated requests with the same idempotency key must not create duplicate payment operations. Payment-provider webhooks must be authenticated or cryptographically verified and processed idempotently.

### Error Handling

The API returns appropriate HTTP status codes and a JSON error message.

| Status | Meaning | Example |
|---|---|---|
| 400 Bad Request | Invalid request data | Missing seat ID |
| 401 Unauthorized | Authentication required | User is not logged in |
| 403 Forbidden | Access is not permitted | User tries to view another user's order |
| 404 Not Found | Resource does not exist | Invalid event ID |
| 409 Conflict | Resource state conflicts with the request | Seat is already held or sold |
| 500 Internal Server Error | Unexpected server error | Unhandled backend failure |

Example error response:

```json
{
  "error": "SEAT_UNAVAILABLE",
  "message": "This seat is no longer available."
}
```

The frontend should display a clear message when a seat is unavailable and allow the customer to choose another seat.

## 4. Data Model

TicketHub uses PostgreSQL as its primary relational database because it supports transactions, foreign keys, unique constraints, and row-level locking. These features help protect seat reservations and purchases when many customers act at the same time.

### Main Database Tables

**Users**

- `id` — primary key.
- `name` — customer's name.
- `email` — unique email address.
- `password_hash` — securely hashed password.
- `created_at` — account creation time.

**Events**

- `id` — primary key.
- `name` — event name.
- `venue` — event venue.
- `event_date` — date and time of the event.
- `category` — event category.
- `status` — event status.

**Seats**

- `id` — primary key.
- `event_id` — foreign key referencing `Events`.
- `seat_number` — seat label.
- `price` — ticket price.
- `status` — available, held, or sold.

A unique constraint on `(event_id, seat_number)` prevents duplicate seat labels within an event.

**Orders**

- `id` — primary key.
- `user_id` — foreign key referencing `Users`.
- `total_amount` — total order price.
- `status` — pending, paid, failed, or cancelled.
- `idempotency_key` — unique key used to prevent duplicate order creation.
- `created_at` — order creation time.

**Order_Items**

- `id` — primary key.
- `order_id` — foreign key referencing `Orders`.
- `seat_id` — foreign key referencing `Seats`.
- `price` — price recorded for the purchased seat.
- `status` — pending, confirmed, or cancelled.

A partial unique index on `seat_id` for confirmed order items prevents a seat from being assigned to more than one confirmed ticket. Legitimate cancellations must update the order item within a transaction before the seat can be sold again.

**Seat_Holds**

- `id` — primary key.
- `seat_id` — foreign key referencing `Seats`.
- `user_id` — foreign key referencing `Users`.
- `expires_at` — time the hold expires.
- `status` — active, expired, released, or purchased.

The system permits only one active hold per seat. Expired holds must be marked expired or reclaimed safely within a transaction before a replacement hold is created.

**Payments**

- `id` — primary key.
- `order_id` — foreign key referencing `Orders`.
- `provider_reference` — payment provider's transaction reference.
- `amount` — payment amount.
- `status` — pending, successful, or failed.
- `idempotency_key` — unique key to prevent duplicate processing of the same payment operation.
- `created_at` — payment creation time.

TicketHub should store payment references and statuses rather than raw payment-card details.

### Table Relationships

- One user can have multiple orders.
- One event can have multiple seats.
- One order can contain multiple order items.
- Each order item refers to one seat.
- One seat can have multiple hold records over time, but only one active hold at a time.
- One order can have multiple payment attempts, but retries of the same payment operation must not create duplicate charges.

### Database Indexes and Constraints

- A unique constraint on `Users.email` prevents duplicate accounts using the same email address.
- A unique constraint on `(Seats.event_id, Seats.seat_number)` prevents duplicate seat labels within an event.
- A partial unique index on `Order_Items.seat_id` for confirmed items prevents the same seat from being assigned to multiple confirmed tickets.
- A partial unique index on `Seat_Holds.seat_id` for active holds prevents multiple active hold records for the same seat.
- Indexes on `Events.event_date`, `Seats.event_id`, `Orders.user_id`, and `Seat_Holds.expires_at` support common searches and cleanup operations.
- Unique idempotency keys prevent duplicate processing of the same order or payment operation.
- Foreign keys maintain relationships between users, events, seats, orders, holds, and payments.
- Seat status, hold status, and order-item status must be updated consistently within database transactions.

The application must explicitly expire old holds because an index cannot automatically treat a hold as inactive solely because its expiry time has passed.

### Preventing Double-Booking: Seat 2401

A database transaction and row-level locking protect the reservation process. The database, rather than the application server or cache, is the final authority on seat ownership.

**1. Customer A requests seat 2401**

The backend starts a transaction and locks the seat row:

```sql
BEGIN;

SELECT id, status
FROM seats
WHERE id = 2401
FOR UPDATE;
```

The backend checks whether the seat is available and whether another customer has an active hold.

**2. Customer B requests the same seat**

If Customer B requests seat 2401 while Customer A holds the row lock, Customer B must wait for Customer A's transaction to finish. After the lock is released, Customer B checks the updated seat state. If Customer A successfully reserved the seat, Customer B cannot reserve it as well.

### 3. Create a temporary hold

The application creates a unique hold ID for the request. The following PostgreSQL example illustrates how the backend can reserve seat 2401 safely by locking the seat row and creating a temporary hold in the `seat_holds` table.

```sql
BEGIN;

SELECT id, status
FROM seats
WHERE id = 2401
FOR UPDATE;

-- The backend checks that the seat is available
-- and has no unexpired active hold.

INSERT INTO seat_holds (
    seat_id,
    user_id,
    expires_at,
    status
)
VALUES (
    2401,
    101,
    NOW() + INTERVAL '10 minutes',
    'active'
);

COMMIT;
```

The backend must verify that the seat is available and has no unexpired active hold before inserting the new hold. If the seat is unavailable or the hold cannot be created, the transaction must be rolled back and the API should return `409 Conflict`.

The row lock helps prevent competing requests from reserving the same seat simultaneously. Expired holds must be handled safely before a new hold is created.

For a request involving multiple seats, the backend must verify that every requested seat was held successfully. If any seat cannot be held, the backend rolls back the entire transaction so the customer does not receive only part of the requested reservation.

Expired holds must be released or reclaimed safely within a transaction before a replacement hold is created. A background worker can clean up expired holds, but the purchase path must independently validate hold expiry.

**4. Confirm the purchase**

After payment is verified, the application starts another transaction, locks the relevant seat row, and verifies that the hold belongs to the customer and is still valid. It then records the order item and confirms the ticket while updating the related records consistently.

A database uniqueness constraint on confirmed order items prevents the same seat from being assigned to more than one confirmed ticket. This is a second layer of protection in addition to row-level locking.

**5. Handle payment failures and retries**

If payment fails or the hold expires, the system follows a safe release or cancellation process. If the payment outcome is uncertain, the system checks or reconciles the payment result before deciding whether to release the seat.

Payment requests use idempotency keys to prevent duplicate charges when a customer retries after a timeout. The application must not keep a database transaction open while waiting for an external payment provider.

This approach combines row-level locking, temporary holds, database constraints, and idempotent payment processing to protect seat ownership during a popular ticket sale.

## 5. System Architecture

TicketHub uses a scalable architecture that separates browsing traffic from critical purchase operations.

### Architecture Diagram

```text
Customers
    |
    v
CDN (static files and event images)
    |
    v
Load Balancer
    |
    v
Virtual Waiting Room
    |
    v
Application Servers
    |
    +--------------------+
    |                    |
    v                    v
Redis Cache         PostgreSQL Primary
(event data)        (holds, seats, orders)
                         |
                         +------> Read Replicas
                         |        (browsing queries)
                         |
                         +------> Message Queue
                                      |
                                      v
                               Background Workers
                               (tickets and emails)

Application Servers ------> Payment Provider
Application Servers ------> Monitoring and Alerts
```

### Architecture Components

1. **CDN:** Delivers static files such as images, CSS, and JavaScript from locations closer to customers.
2. **Virtual Waiting Room:** Controls customer admission during popular ticket sales and helps prevent backend overload.
3. **Load Balancer:** Distributes incoming requests across multiple application servers.
4. **Application Servers:** Handle authentication, event browsing, seat holds, orders, and payment coordination. They are stateless so more instances can be added when demand increases.
5. **Redis Cache:** Stores suitable temporary data, such as frequently requested event details. Cached seat availability may be stale and is never the final authority for seat ownership.
6. **PostgreSQL Primary Database:** Stores users, events, seats, orders, holds, and payments. Critical purchase operations use transactions and database constraints.
7. **Read Replicas:** Handle suitable read-heavy queries to reduce the load on the primary database. Critical seat holds and purchases always use the primary database.
8. **Message Queue and Background Workers:** Process ticket notifications, email delivery, and other asynchronous tasks. Jobs can be retried safely.
9. **Payment Provider:** Processes payments securely and sends verified payment results to TicketHub.
10. **Monitoring and Backups:** Track system health, errors, latency, database load, and payment failures. Backups support recovery.

### Request Flow

**Browsing events**

1. A customer opens the TicketHub website.
2. The CDN serves static assets.
3. The frontend requests event information from the backend.
4. The application checks the cache and uses the database when necessary.
5. Event information is returned to the customer.

**Purchasing a ticket**

1. A customer enters the waiting room during a high-demand sale.
2. The waiting room admits customers at a controlled rate based on backend capacity.
3. The application validates the customer's request and checks authoritative seat state.
4. A database transaction locks the requested seat and creates a temporary hold if the seat is available.
5. The customer completes checkout and the backend creates an order linked to the valid hold.
6. The payment provider processes the payment without the database transaction remaining open while the external service responds.
7. The backend verifies the payment result and confirms the order and ticket using a safe database transaction.
8. A background worker sends the confirmation and ticket notification through the message queue.

If payment fails, the order follows the failure-handling process. If a payment result is uncertain, the system reconciles the result before deciding whether to release the seat.

### Handling the Flash Sale

During the assumed sale, 200,000 customers may generate approximately 3,333 requests per second. The design controls this load in several ways:

- The CDN serves static content without sending every request to the application servers.
- The virtual waiting room controls how many customers enter the purchase flow at a time and uses consistent queue rules.
- Application servers scale horizontally before known major sales and use connection pooling to limit database connections.
- Redis reduces repeated reads for event information, while critical seat updates always use the primary database.
- The primary database uses transactions, row-level locks, and uniqueness constraints to protect seat ownership.
- Read replicas handle suitable browsing queries, leaving the primary database available for reservations and purchases.
- Message queues move email and ticket-delivery work away from the checkout request.
- Monitoring tracks request rates, response times, database connection use, lock waits, error rates, queue depth, and payment outcomes.

The waiting room's admission rate must be established through load testing. It should not be treated as a fixed number until the application and database capacity have been measured.

### Scaling and Reliability Decisions

- Scale application servers horizontally to handle additional traffic.
- Cache public event information, but always validate critical seat reservations against authoritative database state.
- Use a virtual waiting room and rate limiting to protect the system from sudden request spikes.
- Use PostgreSQL transactions, row-level locks, and uniqueness constraints to prevent double-booking.
- Use idempotency keys for order and payment operations.
- Process notifications asynchronously so email or ticket delivery does not delay checkout.
- Use read replicas for appropriate queries without directing critical seat updates to stale data.
- Use database connection pooling and monitor connection limits to prevent connection exhaustion.
- Back up the database and test recovery procedures regularly.

## 6. Trade-Offs

**1. Consistency vs. Availability**

TicketHub prioritizes correct seat ownership during purchases. If the primary database cannot safely confirm a reservation, the system should reject or delay the purchase rather than risk selling the same seat twice.

**2. Caching vs. Freshness**

Caching reduces database load and improves browsing speed. However, cached seat information can become outdated, so the backend must verify availability before creating a hold or confirming a purchase. Customers may receive a `409 Conflict` and need to select another seat.

**3. Fairness vs. Immediate Access**

A waiting room can make popular sales fairer and protect the backend from overload. However, customers may have to wait before accessing the event. The system needs clear queue information and consistent admission rules.

**4. Synchronous vs. Asynchronous Processing**

Payment verification and critical purchase updates require careful coordination. Notifications and ticket delivery can be processed asynchronously to improve responsiveness, but background jobs must be safe to retry.

**5. Primary Database vs. Read Replicas**

Read replicas help scale browsing traffic, but their data may be slightly out of date. Critical seat holds and purchase decisions must use authoritative state and safe transactions on the primary database.

**6. Strict Database Locking vs. Throughput**

Row-level locks protect seats from simultaneous reservations, but heavy contention can cause requests to wait. The waiting room, short transactions, suitable indexes, and connection pooling help limit pressure on the database. Transactions should not remain open while waiting for payment-provider responses.

## Conclusion

TicketHub combines a scalable web architecture, a virtual waiting room, a relational database, caching, and secure payment processing. It is designed to support 2 million registered users and sudden increases in traffic during popular ticket sales.

The design prioritizes fairness, reliability, and data consistency. Temporary seat holds, row-level locking, database transactions, uniqueness constraints, and idempotent payment processing help prevent double-booking and duplicate charges. Caching, read replicas, load balancing, connection pooling, and background workers help the system handle high traffic while keeping critical purchase operations reliable.

The proposed capacity is a planning estimate that must be validated with load testing before production use.