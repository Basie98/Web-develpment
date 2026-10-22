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