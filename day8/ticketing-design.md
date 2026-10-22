# TicketHub: System Design

## 1. Requirements

TicketHub is a website where users can browse concerts and events, select seats, purchase tickets, and view their orders. The system must support 2 million registered users and handle sudden increases in traffic when popular concerts go on sale.

### Functional Requirements

- Users can register, log in, and manage their accounts.
- Users can browse events and search by name, date, venue, or category.
- Users can view available, held, and sold seats for an event.
- Users can temporarily hold available seats while completing checkout.
- Users can pay securely for their orders.
- Users can view their purchased tickets and order history.
- The system must prevent two users from purchasing the same seat.
- Users must receive confirmation when their payment succeeds or fails.

### Non-Functional Requirements

**Speed:** Event listings and seat availability should load within approximately two seconds under normal conditions. The system should remain responsive during popular ticket sales.

**Correctness:** A seat must never be sold to two different customers. Orders, payments, and seat reservations must remain consistent, even when requests fail or are repeated.

**Fairness:** Users should be processed through a fair, visible waiting queue during high-demand sales. The system should apply consistent rules and prevent users from bypassing the queue or reserving unlimited seats.

**Availability:** The website should remain operational during traffic spikes. If a component fails, the system should recover without selling seats twice.

**Security:** Passwords must be securely hashed, payment information must be handled by a trusted payment provider, and users must only access their own orders and tickets.

**Scalability:** The system must support 2 million registered users and scale its capacity when many people attempt to purchase tickets simultaneously.

**Reliability:** Failed or repeated payment requests must not create duplicate orders or charge customers twice.

## 2. Traffic and Capacity Estimates

### Normal Traffic

TicketHub has 50,000 visitors per normal day. Each visitor views 10 pages.

Daily page views:

50,000 × 10 = 500,000 page views per day.

Average page requests per second:

500,000 ÷ 86,400 = approximately 5.8 requests per second.

Assuming traffic is five times higher during busy periods, the normal-day peak is approximately 29 page requests per second.

TicketHub sells 5,000 tickets per normal day. This averages approximately 0.058 tickets per second, or 3.5 tickets per minute.

### Popular Concert Sale

When a popular concert goes on sale, 200,000 people attempt to buy 20,000 seats within the first 10 minutes.

Average incoming users per second:

200,000 ÷ 600 = approximately 333 users per second.

The number of people attempting to buy tickets is ten times the number of available seats.

If all 20,000 seats sell during the 10-minute period, the average sales rate is approximately 33.3 tickets per second.

Assuming each of the 200,000 users makes 10 page or API requests during the sale, the system could receive approximately 2 million requests in 10 minutes, or 3,333 requests per second on average. Actual peak traffic could be much higher.

### Comparison

| Measurement | Normal Day | Popular Sale |
|---|---|---|
| Registered users | 2,000,000 | 2,000,000 |
| Visitors or interested buyers | 50,000 per day | 200,000 in 10 minutes |
| Page/API requests | 500,000 page views per day | Up to 2,000,000 requests in 10 minutes |
| Average request rate | 5.8 requests/second | 3,333 requests/second |
| Tickets available or sold | 5,000 sold per day | 20,000 available seats |
| Main challenge | Normal browsing and purchases | Sudden traffic, fairness, and seat contention |

The popular sale can produce hundreds of times more requests per second than the normal daily average. These estimates are based on the assumptions above, and actual peak traffic may be higher.

## 3. API Design

TicketHub uses a REST API to connect the frontend to the backend.

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/register` | Register a user |
| POST | `/api/auth/login` | Log in a user |
| GET | `/api/events` | Browse and search events |
| GET | `/api/events/{eventId}/seats` | View seats for an event |
| POST | `/api/seats/{seatId}/hold` | Temporarily hold a seat |
| POST | `/api/orders` | Create an order |
| POST | `/api/payments` | Process a payment |
| GET | `/api/orders/{orderId}` | View an order |
| DELETE | `/api/holds/{holdId}` | Release a seat hold |

### Example Seat-Hold Request

```json
{
  "eventId": 501,
  "seatId": 2401
}
```

### Example Successful Response

```json
{
  "seatId": 2401,
  "status": "HELD",
  "expiresAt": "2026-10-22T14:30:00Z"
}
```

### Error Responses

- **400 Bad Request:** The request contains invalid data.
- **401 Unauthorized:** The user is not logged in.
- **403 Forbidden:** The user does not have permission.
- **404 Not Found:** The requested resource does not exist.
- **409 Conflict:** The seat is already held or sold.
- **500 Internal Server Error:** An unexpected server error occurred.

Payment requests should use idempotency keys to prevent duplicate charges when requests are retried. The backend must verify payment results before confirming an order. Payment-provider webhooks should also be verified and processed idempotently.

## 4. Data Model

TicketHub uses PostgreSQL because ticket purchases require reliable transactions, relational data, and consistent records.

### Preventing Double-Booking: Seat 2401

TicketHub must prevent two customers from purchasing the same seat, even when thousands of requests arrive simultaneously.

**1. Start a database transaction**

When Customer A requests seat 2401, the application starts a PostgreSQL transaction and locks the relevant seat row using `SELECT ... FOR UPDATE`. It checks whether the seat is available and whether another customer has an active hold.

**2. Handle simultaneous requests**

If Customer B requests seat 2401 at the same time, Customer B must wait for the database lock. After Customer A's transaction commits, Customer B checks the updated seat status. If the seat is held or sold, Customer B receives `409 Conflict` and cannot reserve it.

**3. Create a temporary hold**

The system creates a hold with an expiry time and commits the transaction. The hold prevents another customer from taking the seat while Customer A completes checkout. A background worker marks expired holds as expired, and the application checks the expiry time before allowing another hold.

**4. Confirm the purchase**

After payment is verified, the application starts another transaction, locks the seat row, verifies that the hold belongs to Customer A and is still valid, and records the completed ticket purchase. The seat, hold, and order records are updated consistently within the transaction. A database uniqueness rule prevents the same seat from being assigned to more than one confirmed ticket.

**5. Handle payment failures and retries**

If payment fails or the hold expires, the system follows a safe release or cancellation process. Payment requests use idempotency keys to prevent duplicate charges when a customer retries after a timeout. The application must not keep a database transaction open while waiting for an external payment provider.

This approach combines row-level locking, temporary holds, database constraints, and idempotent payment processing to protect seat ownership during a flash sale.

### Main Tables

**Users**

- `id` — primary key.
- `name` — user's name.
- `email` — unique email address.
- `password_hash` — securely hashed password.
- `created_at` — account creation time.

**Events**

- `id` — primary key.
- `name` — event name.
- `venue` — event venue.
- `event_date` — date and time.
- `category` — event category.
- `status` — event status.

**Seats**

- `id` — primary key.
- `event_id` — foreign key referencing Events.
- `seat_number` — seat label.
- `price` — ticket price.
- `status` — available, held, or sold.

A unique constraint on `(event_id, seat_number)` prevents duplicate seat labels for the same event.

**Orders**

- `id` — primary key.
- `user_id` — foreign key referencing Users.
- `total_amount` — total order price.
- `status` — pending, paid, failed, or cancelled.
- `idempotency_key` — unique key used to prevent duplicate order creation.
- `created_at` — order creation date.

**Order_Items**

- `id` — primary key.
- `order_id` — foreign key referencing Orders.
- `seat_id` — foreign key referencing Seats.
- `price` — price paid for the seat.
- `status` — pending, confirmed, or cancelled.

A database uniqueness rule should prevent a seat from being assigned to more than one confirmed ticket. The application must enforce this rule within the database transaction, not just through a frontend check.

**Seat_Holds**

- `id` — primary key.
- `seat_id` — foreign key referencing Seats.
- `user_id` — foreign key referencing Users.
- `expires_at` — time the hold expires.
- `status` — active, expired, or purchased.

The system must prevent multiple active holds for the same seat. Expired holds must be marked as expired, and the application must check the expiry time before creating a new hold.

**Payments**

- `id` — primary key.
- `order_id` — foreign key referencing Orders.
- `provider_reference` — payment provider's transaction reference.
- `amount` — payment amount.
- `status` — pending, successful, or failed.
- `idempotency_key` — unique key to prevent duplicate payment processing.
- `created_at` — payment creation time.

TicketHub should store payment references and statuses rather than raw payment-card details.

### Relationships

- One user can create many orders.
- One user can create multiple seat holds over time.
- One event can have many seats.
- One event can have many orders through its seat purchases.
- One order can contain multiple order items.
- Each order item refers to one seat.
- One seat can have multiple hold records over time, but only one active hold at a time.
- One order can have multiple payment attempts, but repeated requests for the same payment operation must not create duplicate charges.

### Database Indexes and Constraints

- A unique index on `Users.email` prevents duplicate accounts using the same email address.
- A unique constraint on `(Seats.event_id, Seats.seat_number)` prevents duplicate seat labels within an event.
- A unique constraint or index on confirmed ticket assignments prevents a seat from being sold more than once.
- A partial unique index on active seat holds prevents two active holds for the same seat. Expired holds must be updated by the application or a background worker.
- Indexes on `Events.event_date`, `Seats.event_id`, `Orders.user_id`, and `Seat_Holds.expires_at` help common searches and cleanup operations.
- Foreign keys maintain relationships between users, events, seats, orders, holds, and payments.

## 5. System Architecture

TicketHub uses a scalable architecture that separates browsing traffic from critical ticket-purchase operations.

### Architecture Diagram

```text
Customers
    |
    v
CDN and Web Frontend
    |
    v
Virtual Waiting Room
    |
    v
Load Balancer
    |
    v
Application Servers
    |
    +------> Redis Event Cache
    |
    +------> PostgreSQL Primary Database
    |                  |
    |                  +------> Read Replica
    |
    +------> Message Queue
                       |
                       v
               Background Workers
                       |
                       +------> Email and Ticket Notifications

Application Servers
    |
    v
External Payment Provider
```

### Architecture Components

- **CDN:** Delivers static files and reduces the load on application servers.
- **Virtual Waiting Room:** Controls entry during popular sales to reduce overload and improve fairness.
- **Load Balancer:** Distributes requests across application servers.
- **Application Servers:** Handle accounts, event searches, seat holds, orders, and payment workflows. Multiple instances allow the system to scale horizontally.
- **Redis Event Cache:** Stores frequently requested event information. Seat availability and ownership must still be validated against the primary database before a hold or purchase is confirmed.
- **PostgreSQL Primary Database:** Stores users, events, seats, orders, holds, and payment records. Transactions and constraints protect purchase correctness.
- **Read Replica:** Handles suitable read-only requests to reduce pressure on the primary database. It should not be used as the authority for final seat-purchase decisions.
- **Message Queue and Background Workers:** Handle email confirmations, ticket generation, and expired-hold cleanup. Failed background tasks should be retried safely.
- **External Payment Provider:** Processes payments securely. TicketHub should not store raw payment-card details.
- **Monitoring and Backups:** Help detect problems, track database performance, and recover from data loss.

### Handling the Popular Sale

The waiting room limits how many customers enter checkout simultaneously. The CDN and event cache help handle browsing traffic, while the load balancer distributes requests across application servers.

Seat holds and purchases are processed through the primary database. Transactions, row-level locks, and database constraints prevent duplicate sales. Payment operations are protected against duplicate processing using idempotency keys.

The system should be load-tested before major events and adjusted using measured traffic, queue length, application performance, and database performance.

## 6. Trade-Offs

### Trade-Off 1: Fairness Versus Speed

A waiting room improves fairness and protects the system, but customers may have to wait before purchasing tickets.

**Decision:** Use a transparent queue with consistent admission rules rather than allowing everyone to enter checkout simultaneously.

### Trade-Off 2: Consistency Versus Scalability

Database transactions and row locks protect seat ownership, but heavy demand for popular seats can slow purchases.

**Decision:** Keep seat ownership decisions on the primary database while using caching and read replicas for suitable browsing requests. Correct ticket sales are more important than maximizing raw speed.

### Trade-Off 3: Immediate Versus Background Processing

Sending emails and generating tickets during checkout can make purchases slower. Background workers improve responsiveness but introduce extra complexity.

**Decision:** Record order and payment state reliably, then process non-critical tasks asynchronously. Background jobs must be safe to retry.

### Trade-Off 4: Availability Versus Complexity

Multiple application servers, replicas, queues, and monitoring improve resilience, but they make the system more difficult to build and operate.

**Decision:** Introduce redundancy and recovery procedures for critical components, and monitor failures so the team can respond quickly.

### Trade-Off 5: Security Versus Convenience

Authentication, authorization, payment verification, and rate limiting add extra processing and development work.

**Decision:** Apply these controls because protecting customer accounts and preventing fraudulent or duplicate purchases is more important than removing a small amount of processing overhead.

## Conclusion

TicketHub combines a scalable web architecture, a relational database, a waiting room, and secure payment processing. It is designed to support 2 million registered users and sudden increases in traffic during popular ticket sales.

The design prioritizes fairness, reliability, and data consistency. Temporary seat holds, database transactions, uniqueness constraints, and idempotent payment processing help prevent double-booking and duplicate charges. Caching, read replicas, load balancing, and background workers help the system handle high traffic while keeping critical purchase operations reliable.