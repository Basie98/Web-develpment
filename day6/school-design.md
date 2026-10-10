# School Database Design

## 1. Tables and Entities

### Students

The students table stores information about each student. It contains the student's ID, name and email address. The student ID is the primary key, and the email address must be unique so that two students cannot register with the same email.

### Courses

The courses table stores information about the courses offered by the school. It contains the course ID, course name and course code. The course ID is the primary key, and the course code is unique.

### Enrolments

The enrolments table records which students are enrolled in which courses. It contains an enrolment ID, student ID, course ID and grade. The student ID and course ID are foreign keys that reference the students and courses tables. A unique constraint on the combination of student ID and course ID prevents the same student from enrolling in the same course more than once.

## 2. Relationships

The relationship between students and enrolments is one-to-many because one student can enrol in several courses, while each enrolment belongs to one student.

The relationship between courses and enrolments is also one-to-many because one course can have many student enrolments, while each enrolment refers to one course.

Students and courses therefore have a many-to-many relationship: a student can take several courses, and a course can have several students. The enrolments table is needed as a join table to connect these two entities. It also stores information specific to the relationship, such as the student's grade for a particular course.

## 3. Recommended Index

I would add an index on `enrolments(course_id)` to make it faster to find all students enrolled in a particular course and to support queries that group enrolments by course. This index is useful because course-based searches are common operations in a school system.

## 4. SQL or NoSQL?

I would choose a SQL database such as SQLite for this school system. Students, courses and enrolments have clear relationships, and the database needs primary keys, foreign keys and constraints to maintain accurate data. SQL supports joins and aggregate queries, making it easy to find course lists, count students and identify students without enrolments. A relational database is a good fit because the data is structured and consistency is important.
