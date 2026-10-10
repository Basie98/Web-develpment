# SnapShare - Scaling Plan

## 1. Assumptions

- SnapShare has 10,000,000 registered users.
- 10% of registered users are active each day.
- Each active user uploads one photo per day.
- Each active user views 50 feed pages per day.
- Each original photo is 2 MB.
- Each thumbnail is 50 KB (approximately 0.05 MB).
- One day is approximately 100,000 seconds for these estimates.
- Peak traffic is five times the average traffic.
- Storage estimates exclude backups, replication and other overhead.

## 2. Traffic and Storage Estimates

### Daily Active Users

10,000,000 × 10% = 1,000,000 daily active users.

SnapShare has approximately 1 million daily active users.

### Uploads per Second

Daily uploads = 1,000,000 × 1 = 1,000,000 photos.

Average uploads per second = 1,000,000 ÷ 100,000 = 10 uploads per second.

Peak uploads per second = 10 × 5 = 50 uploads per second.

SnapShare should support approximately 10 uploads per second on average and 50 uploads per second at peak.

### Feed Views per Second

Daily feed views = 1,000,000 × 50 = 50,000,000 feed views.

Average feed views per second = 50,000,000 ÷ 100,000 = 500 feed views per second.

Peak feed views per second = 500 × 5 = 2,500 feed views per second.

The system should support approximately 500 feed views per second on average and 2,500 at peak.

### Storage per Year

Each uploaded photo requires storage for the original and thumbnail.

Total storage per photo = 2 MB + 0.05 MB = 2.05 MB.

Daily storage = 1,000,000 × 2.05 MB = 2,050,000 MB, or approximately 2.05 TB per day using decimal units.

Annual storage = 2.05 TB × 365 = 748.25 TB per year.

SnapShare therefore needs approximately 750 TB of new storage per year for originals and thumbnails, excluding backups, replication and overhead.

## 3. Is SnapShare Read-Heavy or Write-Heavy?

SnapShare is read-heavy because each active user views 50 feed pages for every photo uploaded. This means there are approximately 50 feed views for every upload.

The architecture should prioritise fast reads using a CDN, caching and database read replicas. Uploads must also be reliable, but thumbnail processing can happen in the background so users do not have to wait for it to finish.

## 4. Where Should Photos Be Stored?

Original photos and thumbnails should be stored in object storage, such as Amazon S3, rather than directly inside the database.

Storing hundreds of terabytes of image files in a relational database would increase its size, make backups slower and consume resources needed for database queries.

The database should store structured information such as photo ID, owner ID, caption, timestamp and the storage locations of the original photo and thumbnail.

## 5. Architecture Diagram

```text
                         USERS
                           |
                    +------+------+
                    |             |
                 API calls    Photo requests
                    |             |
                    v             v
                   DNS           CDN
                    |             |
                    v             v
             Load Balancer   Object Storage
                    |        (photos and
          +---------+---------+ thumbnails)
          |         |         ^
          v         v         |
      App Server  App Server  |
          1          2        |
          |          |        |
          +-----+----+        |
                |             |
       +--------+--------+    |
       |        |        |    |
       v        v        v    |
     Cache   Primary DB  Queue|
   (Redis)      |         |   |
                |         v   |
                |      Thumbnail
                |       Worker-+
                v
           Read Replica

Primary DB replicates changes to the read replica.
The worker saves generated thumbnails to object storage.
The CDN delivers stored images to users.
```

## 6. Components and the Problems They Solve

- **DNS:** Translates the SnapShare domain name into the address of the service so users can reach it.
- **CDN:** Delivers images from locations closer to users, reducing image loading time and repeated requests to the origin.
- **Load balancer:** Distributes API requests across healthy application servers and stops sending traffic to failed servers.
- **App servers:** Authenticate users, validate requests, process uploads and prepare feed responses; multiple servers allow the application to scale horizontally.
- **Cache:** Keeps frequently requested feed data and metadata in memory to reduce database queries and improve response times.
- **Primary database:** Stores the source-of-truth records for users, follows and photo metadata.
- **Read replica:** Handles many read queries, reducing pressure on the primary database.
- **Object storage:** Stores original photos and thumbnails durably without filling the database with large binary files.
- **Queue:** Holds thumbnail-generation jobs so uploads can finish without waiting for image processing.
- **Thumbnail worker:** Processes queued jobs, creates smaller images and saves them to object storage.

## 7. Step-by-Step Photo Upload Flow

1. The user selects a photo in the mobile app or browser.
2. The app sends an upload request to SnapShare through the service endpoint and load balancer.
3. An available app server authenticates the user and checks the file type and size.
4. The original photo is saved to object storage.
5. The app server saves the photo metadata and storage location in the primary database.
6. The app server places a thumbnail-generation job on the queue.
7. The server returns a successful upload response to the user without waiting for thumbnail generation.
8. A thumbnail worker retrieves the queued job and creates a thumbnail of approximately 50 KB.
9. The worker saves the thumbnail to object storage and updates the thumbnail location in the database.
10. When a user views a feed, the application retrieves feed metadata and the CDN delivers the relevant images.

## 8. Trade-Offs

### Trade-Off 1: Speed vs. Freshness

Caching makes feeds faster and reduces database load. However, cached feeds may temporarily show old information after a new photo is uploaded. SnapShare can use cache expiration or invalidation to keep feeds reasonably fresh.

### Trade-Off 2: Fast Uploads vs. Immediate Thumbnail Availability

Generating thumbnails in the background keeps upload requests fast. However, a thumbnail might not be available immediately. The application can show a placeholder until the worker finishes processing the image.

### Trade-Off 3: Read Replicas vs. Consistency

Read replicas help handle many feed queries, but replication can lag behind the primary database. The application can read recent updates from the primary database when immediate consistency is necessary.

### Trade-Off 4: Availability vs. Cost

Multiple servers, database replicas, durable queues and backups improve reliability but increase infrastructure costs. SnapShare should choose redundancy based on the importance of each service and the expected traffic.

## 9. Avoiding Single Points of Failure

- **Application servers:** Run at least two app servers across separate instances or availability zones so one server can fail without stopping the service.
- **Load balancer and DNS:** Use highly available or managed services and health checks to reduce the risk of one network component taking down the application.
- **Database:** Configure automated backups and a tested failover process for the read replica or another standby database. A read replica alone does not guarantee automatic failover.
- **Queue and workers:** Use a durable queue, retry failed jobs and run multiple workers so a single worker failure does not permanently stop thumbnail generation.
- **Object storage:** Use a durable storage service, appropriate access controls and backup or recovery policies for important data.

Redundancy reduces the risk of service interruption, but it does not eliminate every possible failure. SnapShare should also monitor its services and regularly test its recovery procedures.

## Conclusion

SnapShare is a read-heavy application that must store approximately 750 TB of new photo data each year. Separating image files into object storage, delivering them through a CDN, caching feed data and using database read replicas helps improve performance. Multiple application servers and reliable background processing help the service remain available as traffic grows.