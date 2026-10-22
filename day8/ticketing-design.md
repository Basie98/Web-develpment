# TicketHub: System Design

## 1. Requirements

TicketHub is a website where users can browse concerts and events, select seats, purchase tickets, and view their orders. The system must support 2 million registered users and handle sudden increases in traffic when popular concerts go on sale.

### Functional Requirements

- Users can register, log in, and manage their accounts.
- Users can browse and search for events.
- Users can view event details, available seats, and ticket prices.
- Users can temporarily hold a seat while completing checkout.
- Users can create orders and pay for tickets.
- Users can view their orders and purchased tickets.
- Users can cancel eligible orders and release seat holds.
- The system sends order confirmations and ticket notifications.
- The system prevents two customers from purchasing the same seat.
- The system prevents duplicate payment processing when requests are retried.

### Non-Functional Requirements

**Speed:** Event listings and seat availability should load within approximately two seconds under normal conditions. The system should remain responsive during popular ticket sales.

**Correctness:** A seat must never be sold to two different customers. Orders, payments, and seat reservations must remain consistent, even when requests fail or are repeated.

**Scalability:** The system must support 2 million registered users and scale to handle sudden increases in traffic.

**Availability:** The system should remain operational during high-demand sales. If a component fails, the system should recover safely without losing confirmed purchases.

**Security:** Passwords must be securely hashed. The system must authenticate users, authorize access to orders, protect payment information, and validate incoming requests.

**Reliability:** Payment requests and background jobs must be safe to retry without creating duplicate charges, tickets, or notifications.

## 2. Traffic and Capacity Estimates

TicketHub must support normal browsing traffic and sudden spikes when popular events go on sale.

### Normal Traffic

Assume the following:

- 50,000 daily visitors.
- Each visitor views approximately 10 pages per day.
- Each page generates approximately 5 backend requests.
- The system must support 2 million registered users.

**Daily page views:**

50,000 × 10 = 500,000 page views per day.

**Average page views per second:**

500,000 ÷ 86,400 = approximately 5.8 page views per second.

**Estimated average backend requests per second:**

500,000 × 5 ÷ 86,400 = approximately 29 requests per second.

For planning purposes, TicketHub should allow for higher peak traffic than the daily average. The system will be load-tested to establish its actual capacity.

### Popular Ticket Sale

Assume a popular event has 20,000 seats and 200,000 customers attempt to purchase tickets during a 10-minute sale.

**Average customer arrival rate:**

200,000 ÷ 600 = approximately 333 customers per second.

There are ten times as many interested customers as available seats.

If all 20,000 seats sell during the 10-minute period, the average successful sales rate is approximately 33 seats per second.

Assume each customer generates approximately 10 requests during browsing and checkout.

**Estimated request rate during the sale:**

200,000 × 10 ÷ 600 = approximately 3,333 requests per second.

This estimate is for planning and does not represent a measured result. Actual traffic could be higher because of retries, repeated seat checks, and automated requests.

### Storage Estimates

Assume TicketHub records approximately 20,000 completed ticket purchases per day, with an average of 2 KB of core order and ticket data per purchase.

20,000 × 2 KB = approximately 40 MB of new core purchase data per day.

40 MB × 365 = approximately 14.6 GB per year.

This estimate excludes indexes, backups, payment records, audit logs, application logs, and other data. Actual storage requirements will be higher, and the database must be monitored as usage grows.

### Capacity Planning Decisions

- Use a CDN to deliver static files and reduce unnecessary backend requests.
- Cache frequently requested event information.
- Use multiple application servers behind a load balancer.
- Use a virtual waiting room to control traffic during popular sales.
- Keep critical seat reservations and purchases consistent in the primary database.
- Use monitoring and load testing to adjust capacity before major events.

## 3. API Design

TicketHub uses a REST API to connect the frontend to the backend. The API uses JSON for request and response bodies and HTTPS for secure communication.

### Main Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/users/register` | Register a new user |
| POST | `/api/users/login` | Log in a user |
| GET | `/api/events` | List and search events |
| GET | `/api/events/{eventId}` | View event details |
| GET | `/api/events/{eventId}/seats` | View seats and their availability |
| POST | `/api/holds` | Temporarily hold a seat |
| DELETE | `/api/holds/{holdId}` | Release a seat hold |
| POST | `/api/orders` | Create an order |
| GET | `/api/orders/{orderId}` | View an order |
| POST | `/api/payments` | Process a payment |
| POST | `/api/payments/webhook` | Receive payment-provider notifications |

Authenticated endpoints require a valid session or access token. Users may only access their own orders and holds unless they have authorized administrative permissions.

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

The server determines the hold expiry time. The frontend must not be trusted to decide whether a seat is available or how long a hold should last.

### Example Order Request

`POST /api/orders`

Request:

```json
{
  "hold_id": 501
}
```

The backend verifies that the hold belongs to the authenticated user, is still valid, and has not already been used. It then creates an order using the price recorded by the server.

### Example Payment Request

`POST /api/payments`

Request:

```json
{
  "order_id": 9001,
  "payment_method_token": "example_payment_token"
}
```

The client sends a payment token supplied by the payment provider, not raw card details. The request also includes an idempotency key in the request headers.

Example header:

```text
Idempotency-Key: payment-order-9001-attempt-1
```

The backend verifies the payment result before marking the order as paid and confirming the ticket. Repeated requests with the same idempotency key must not create duplicate payment operations.

Payment-provider webhooks must be authenticated or cryptographically verified and processed idempotently.

### Error Handling

The API returns appropriate HTTP status codes and a JSON error message.

| Status | Meaning | Example |
|---|---|---|
| 400 Bad Request | Invalid request data | Missing seat ID |
| 401 Unauthorized | Authentication required | User is not logged in |
| 403 Forbidden | Access is not permitted | User tries to view another user's order |
| 404 Not Found | Resource does not exist | Invalid event ID |
| 409 Conflict | Resource state conflicts with request | Seat is already held or sold |
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

TicketHub uses PostgreSQL because ticket purchases require reliable transactions, relational data, and consistent records.

### Preventing Double-Booking: Seat 2401

TicketHub must prevent two customers from purchasing the same seat, even when thousands of requests arrive simultaneously.

**1. Start a database transaction**

When Customer A requests seat 2401, the application starts a PostgreSQL transaction and locks the relevant seat row using `SELECT ... FOR UPDATE`. It checks whether the seat is available and whether another customer has an active hold.

**2. Handle simultaneous requests**

If Customer B requests seat 2401 at the same time, Customer B must wait for the database lock. After Customer A's transaction commits, Customer B checks the updated seat status. If the seat is held or sold, Customer B receives `409 Conflict` and cannot reserve it.

**3. Create a temporary hold**

The system creates a hold with an expiry time and commits the transaction. The hold prevents another customer from taking the seat while Customer A completes checkout.

When another customer requests the same seat, the backend checks the existing hold's status and expiry time within a transaction. If the hold is still valid, the request is rejected. If it has expired, the backend safely marks it as expired before allowing a new hold. A background worker can also clean up expired holds.

**4. Confirm the purchase**

After payment is verified, the application starts another transaction, locks the seat row, and verifies that the hold belongs to Customer A and is still valid. It records the completed ticket purchase and updates the seat, hold, and order-item records consistently within the transaction.

A database uniqueness rule prevents a seat from being assigned to more than one confirmed ticket. This rule is enforced by the database, not just by the frontend.

**5. Handle payment failures and retries**

If payment fails or the hold expires, the system follows a safe release or cancellation process. It must reconcile payment results before releasing a seat if the payment outcome is uncertain.

Payment requests use idempotency keys to prevent duplicate charges when a customer retries after a timeout. The application must not keep a database transaction open while waiting for an external payment provider.

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
- `event_date` — date and time of the event.
- `category` — event category.
- `status` — event status.

**Seats**

- `id` — primary key.
- `event_id` — foreign key referencing `Events`.
- `seat_number` — seat label.
- `price` — ticket price.
- `status` — available, held, or sold.

A unique constraint on `(event_id, seat_number)` prevents duplicate seat labels for the same event.

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
- `price` — price paid for the seat.
- `status` — pending, confirmed, or cancelled.

A seat must not have more than one confirmed ticket assignment. This can be enforced with a partial unique index on `seat_id` for confirmed order items. When a ticket is legitimately cancelled, its order item must be marked as cancelled within the appropriate transaction so the seat can be sold again.

**Seat_Holds**

- `id` — primary key.
- `seat_id` — foreign key referencing `Seats`.
- `user_id` — foreign key referencing `Users`.
- `expires_at` — time the hold expires.
- `status` — active, expired, or purchased.

A partial unique index on `seat_id` for records with `status = 'active'` prevents multiple active hold records for the same seat. The application must check the expiry time and mark an expired hold as expired within a transaction before creating a replacement hold.

**Payments**

- `id` — primary key.
- `order_id` — foreign key referencing `Orders`.
- `provider_reference` — payment provider's transaction reference.
- `amount` — payment amount.
- `status` — pending, successful, or failed.
- `idempotency_key` — unique key to prevent duplicate processing of the same payment operation.
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
- One order can have multiple payment attempts, but retries of the same payment operation must not create duplicate charges.

### Database Indexes and Constraints

- A unique constraint on `Users.email` prevents duplicate accounts using the same email address.
- A unique constraint on `(Seats.event_id, Seats.seat_number)` prevents duplicate seat labels within an event.
- A partial unique index on `Order_Items.seat_id` for confirmed items prevents the same seat from being assigned to multiple confirmed tickets.
- A partial unique index on `Seat_Holds.seat_id` for active holds prevents multiple active hold records for the same seat.
- Indexes on `Events.event_date`, `Seats.event_id`, `Orders.user_id`, and `Seat_Holds.expires_at` help common searches and cleanup operations.
- Unique idempotency keys prevent duplicate processing of the same order or payment operation.
- Foreign keys maintain relationships between users, events, seats, orders, holds, and payments.
- Seat status, hold status, and order-item status must be updated consistently within database transactions.

The application must explicitly expire old holds because an index cannot automatically treat a hold as inactive solely because its expiry time has passed.

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
