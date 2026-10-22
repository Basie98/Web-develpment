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

**Speed:** Event listings and seat availability should load within approximately two seconds under normal conditions. The system should remain responsive during a popular ticket sale.

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
|---|---:|---:|
| Registered users | 2,000,000 | 2,000,000 |
| Visitors or interested buyers | 50,000 per day | 200,000 in 10 minutes |
| Page/API requests | 500,000 page views per day | Up to 2,000,000 requests in 10 minutes under the stated assumption |
| Average request rate | 5.8 page requests/second | 3,333 requests/second under the stated assumption |
| Tickets available or sold | 5,000 sold per day | 20,000 available seats |
| Main challenge | Normal browsing and purchases | Sudden traffic, fairness, and seat contention |

The popular sale can produce hundreds of times more requests per second than the normal daily average
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

### Example seat-hold request

```json
{
  "eventId": 501,
  "seatId": 2401
}
```

### Example successful response

```json
{
  "seatId": 2401,
  "status": "HELD",
  "expiresAt": "2026-10-22T14:30:00Z"
}
```

### Error responses

- **400 Bad Request:** Invalid request data.
- **401 Unauthorized:** The user is not logged in.
- **403 Forbidden:** The user does not have permission.
- **404 Not Found:** The requested resource does not exist.
- **409 Conflict:** The seat is already held or sold.
- **500 Internal Server Error:** An unexpected error occurred.

Payment requests should use idempotency keys to prevent duplicate charges when requests are retried.

## 4. Data Model

TicketHub uses PostgreSQL because ticket purchases require reliable transactions and consistent data.

### Main tables

**Users**
- `id` — primary key
- `name` — user's name
- `email` — unique email address
- `password_hash` — securely hashed password

**Events**
- `id` — primary key
- `name` — event name
- `venue` — event venue
- `event_date` — date and time
- `status` — event status

**Seats**
- `id` — primary key
- `event_id` — foreign key referencing Events
- `seat_number` — seat label
- `price` — ticket price
- `status` — available, held, or sold

**Orders**
- `id` — primary key
- `user_id` — foreign key referencing Users
- `total_amount` — total order price
- `status` — pending, paid, failed, or cancelled
- `created_at` — order creation date

**Order_Items**
- `id` — primary key
- `order_id` — foreign key referencing Orders
- `seat_id` — foreign key referencing Seats
- `price` — price paid for the seat

**Seat_Holds**
- `id` — primary key
- `seat_id` — foreign key referencing Seats
- `user_id` — foreign key referencing Users
- `expires_at` — time the hold expires
- `status` — active, expired, or purchased

### Relationships

- One user can have many orders.
- One event can have many seats.
- One order can contain multiple order items.
- Each order item refers to a seat.
- A seat can have a temporary hold before purchase.

### Preventing two people from buying the same seat

When a customer selects a seat, the backend starts a database transaction and locks the seat's database row. It checks whether the seat is available and whether another customer has an active hold.

If the seat is available, the system creates a temporary hold with an expiry time. If another customer tries to hold the same seat, that request must wait or receive a conflict response.

After successful payment, the system marks the seat as sold and records the order. A database constraint prevents the same seat from being included in multiple completed purchases. If the hold expires or payment fails, the seat can be released safely.

## 5. System Architecture

```text
Customers
    |
    v
CDN and Waiting Room
    |
    v
Load Balancer
    |
    v
Application Servers
    |
    +------> Event Cache
    |
    +------> PostgreSQL Primary Database
    |                    |
    |                    v
    |                Read Replica
    |
    +------> Message Queue
    |              |
    |              v
    |       Background Workers
    |
    +------> Payment Provider
```

### Architecture components

- **CDN:** Delivers static files and reduces the load on application servers.
- **Waiting Room:** Controls entry during popular sales to reduce overload and improve fairness.
- **Load Balancer:** Distributes requests across application servers.
- **Application Servers:** Handle accounts, event searches, seat holds, orders, and payment workflows.
- **Event Cache:** Stores frequently requested event information. Seat availability must still be checked against the primary database.
- **PostgreSQL Primary Database:** Stores users, events, seats, orders, and holds. Transactions protect purchase correctness.
- **Read Replica:** Handles suitable read-only requests to reduce pressure on the primary database.
- **Message Queue and Background Workers:** Handle email confirmations, ticket generation, and expired-hold cleanup.
- **Payment Provider:** Processes payments securely. TicketHub should not store raw payment-card details.
- **Monitoring and Backups:** Help detect problems and recover from data loss.

### Handling the popular sale

The waiting room limits how many customers enter checkout simultaneously. The CDN and cache help handle browsing traffic, while the load balancer distributes requests across application servers.

Seat holds and purchases are processed through the primary database. Transactions and database constraints prevent duplicate sales. The system should be load-tested before major events and adjusted using measured traffic and database performance.

## 6. Trade-Offs

### Trade-Off 1: Fairness versus speed

A waiting room improves fairness and protects the system, but customers may have to wait before purchasing tickets.

**Decision:** Use a transparent queue with consistent admission rules rather than allowing everyone to enter checkout simultaneously.

### Trade-Off 2: Consistency versus scalability

Database transactions and row locks protect seat ownership, but heavy demand for popular seats can slow purchases.

**Decision:** Keep seat ownership decisions on the primary database while using caching and read replicas for suitable browsing requests. Correct ticket sales are more important than maximizing raw speed.

### Trade-Off 3: Immediate versus background processing

Sending emails and generating tickets during checkout can make purchases slower. Background workers improve responsiveness but introduce extra complexity.

**Decision:** Record the order and verified payment result reliably, then process non-critical tasks asynchronously.

## Conclusion

TicketHub combines a scalable web architecture, a relational database, a waiting room, and secure payment processing. It is designed to support normal traffic and sudden increases during popular ticket sales while prioritizing fairness, reliability, and preventing double-booking.