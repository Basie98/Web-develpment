# Day 7 Assignment: SnapShare Scaling Plan

## 1. Assumptions

SnapShare is a photo-sharing application where users upload photos and view photos posted by people they follow.

The following assumptions are used:

- The application has 10 million registered users.
- 10% of registered users are active each day.
- Each daily active user uploads one photo per day.
- Each daily active user views 50 feed pages per day.
- The average original photo is 2 MB.
- Each photo has one thumbnail of 50 KB.
- A day has 86,400 seconds, and a year has 365 days.
- Uploads and feed views are spread across the day for average calculations.
- Peak feed traffic is five times the average traffic.
- Storage calculations exclude backups, database metadata, and extra storage overhead.

### Daily Active Users

Daily active users (DAU) are calculated as:

10,000,000 × 10% = 1,000,000 daily active users.

Therefore, SnapShare has 1 million daily active users.

## 2. Traffic and Storage Estimates

### Uploads per Second

Each daily active user uploads one photo per day.

Daily uploads = 1,000,000 × 1 = 1,000,000 photos.

Average uploads per second = 1,000,000 ÷ 86,400.

Average uploads per second ≈ 11.57.

SnapShare must handle approximately 12 photo uploads per second on average.

### Feed Views per Second

Each daily active user views 50 feed pages per day.

Daily feed views = 1,000,000 × 50 = 50,000,000 feed views.

Average feed views per second = 50,000,000 ÷ 86,400.

Average feed views per second ≈ 578.7.

Peak feed views per second = 578.7 × 5.

Peak feed views per second ≈ 2,894.

The system should be designed to handle approximately 2,894 feed views per second at peak traffic.

### Photo Storage per Year

Daily original photo storage:

1,000,000 × 2 MB = 2,000,000 MB per day, or approximately 2 TB per day using decimal units.

Annual original photo storage:

2 TB × 365 = 730 TB per year.

Daily thumbnail storage:

1,000,000 × 50 KB = 50,000,000 KB per day, or approximately 50 GB per day.

Annual thumbnail storage:

50 GB × 365 = 18.25 TB per year.

Total estimated photo storage per year:

730 TB + 18.25 TB = 748.25 TB per year.

SnapShare needs approximately 748.25 TB of new storage per year for original photos and thumbnails, before replication, backups, and other overhead.

## 3. Read-Heavy or Write-Heavy?

SnapShare is a read-heavy system because users view 50 feed pages per day but upload only one photo per day. Feed views greatly outnumber uploads.

The design should prioritise fast feed loading by using a CDN for photo delivery, a cache for frequently requested data, and a database read replica for read queries. Uploads must still be reliable, but the system should be optimised to serve many simultaneous readers.

## 4. Why Photos Should Not Be Stored Inside the Database

Photos should not be stored directly inside the relational database because large binary files can increase database size, make backups and restores slower, and consume database resources needed for queries. Instead, original photos and thumbnails should be stored in object storage, while the database stores information such as photo IDs, user IDs, captions, timestamps, and object-storage paths.

## 5. Architecture Diagram

                         USERS
                           |
                    +------+------+
                    |             |
                 Uploads       Feed views
                    |             |
                    v             v
              +-----------------------+
              |     Load Balancer     |
              +-----------------------+
                           |
                    +------+------+
                    |             |
                    v             v
              +-----------+  +-----------+
              | App Server|  | App Server|
              +-----------+  +-----------+
                    |             |
          +---------+-------------+----------+
          |         |             |          |
          v         v             v          v
       +------+  +---------+  +----------+  +----------------+
       | Cache|  | Primary |  | Read     |  | Object Storage |
       |      |  | Database|  | Replica  |  | Original photos|
       +------+  +----+----+  +----------+  | and thumbnails |
                      |                     +----------------+
                      |                              ^
                      v                              |
                +-----------+                  +-----------+
                | Photo Job |----------------->|  Worker   |
                |   Queue   |                  | Thumbnail |
                +-----------+                  | generator |
                                               +-----------+

             CDN delivers photos to users
             directly from object storage

## 6. Components and the Problems They Solve

- **Load balancer:** Distributes incoming requests across app servers to prevent one server from becoming overloaded.
- **App servers:** Handle application logic, authenticate users, process uploads, and prepare feed responses.
- **Cache:** Stores frequently requested feed data and metadata to reduce database queries and improve response times.
- **Primary database:** Stores user accounts, photo metadata, captions, follow relationships, and other structured information.
- **Database read replica:** Handles read queries so the primary database has more capacity for writes and updates.
- **Object storage:** Stores original photo files and thumbnails cheaply and durably without placing large files inside the database.
- **CDN (Content Delivery Network):** Delivers photos from locations closer to users, reducing loading time and traffic to the origin storage.
- **Photo job queue:** Holds thumbnail-generation jobs so photo uploads do not have to wait for thumbnail processing to finish.
- **Thumbnail worker:** Processes queued jobs, creates smaller thumbnail images, and saves them to object storage.

## 7. Step-by-Step Photo Upload Flow

1. A user selects a photo and uploads it through the SnapShare application.
2. The load balancer directs the upload request to an available app server.
3. The app server authenticates the user and validates the file type and size.
4. The app server stores the original photo in object storage.
5. The app server saves the photo's metadata and storage location in the primary database.
6. The app server places a thumbnail-generation job on the photo job queue.
7. The app server confirms that the original photo has been uploaded successfully.
8. A thumbnail worker takes the job from the queue and creates a 50 KB thumbnail.
9. The worker saves the thumbnail in object storage and updates the photo metadata if necessary.
10. When users view the photo, the CDN delivers the original image or thumbnail from a nearby location.

## 8. Trade-Offs

### Trade-Off 1: Faster Reads vs. Data Freshness

Caching feed data makes the application faster and reduces database load. However, cached information may be temporarily outdated when a user uploads a new photo or follows someone. SnapShare must balance cache performance with how quickly updates become visible.

### Trade-Off 2: Asynchronous Thumbnails vs. Immediate Availability

Using a queue and background worker allows uploads to finish without waiting for thumbnail generation. However, the thumbnail may not be available immediately, so the application may need to show a placeholder until processing finishes.

### Trade-Off 3: Read Replicas vs. Consistency

A read replica improves the database's ability to serve many feed requests. However, replication can lag behind the primary database, meaning a newly uploaded photo may not appear in a feed immediately. The application can read recent updates from the primary database when necessary.

### Trade-Off 4: CDN Performance vs. Cost and Invalidation

A CDN improves photo delivery speed and reduces repeated requests to object storage. However, CDN traffic costs money, and cached images may need to be invalidated or given new URLs when they change.

## Conclusion

SnapShare should use a scalable architecture that separates photo files from structured database information. Since feed views greatly outnumber uploads, the system should prioritise read performance with a CDN, caching, and a database read replica. Object storage and asynchronous thumbnail processing help the application handle large photo volumes while keeping uploads responsive.
