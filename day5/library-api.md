# Library Books REST API Design

## 1. List All Books

* **Method:** GET
* **Path:** `/books`
* **Description:** Returns a list of all books in the library.
* **Success status code:** 200 OK

## 2. Get One Book

* **Method:** GET
* **Path:** `/books/{id}`
* **Description:** Returns the details of a book using its ID.
* **Success status code:** 200 OK

## 3. Create a Book

* **Method:** POST
* **Path:** `/books`
* **Description:** Adds a new book to the library.
* **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "year": 1958
}
```

* **Success status code:** 201 Created

## 4. Update a Book

* **Method:** PUT
* **Path:** `/books/{id}`
* **Description:** Updates an existing book using its ID.
* **Example request body:**

```json
{
  "title": "Things Fall Apart",
  "author": "Chinua Achebe",
  "year": 1959
}
```

* **Success status code:** 200 OK

## 5. Delete a Book

* **Method:** DELETE
* **Path:** `/books/{id}`
* **Description:** Deletes a book from the library using its ID.
* **Success status code:** 204 No Content

## 6. List Books by Author

* **Method:** GET
* **Path:** `/books?author=Chinua%20Achebe`
* **Description:** Returns books written by the specified author using a query parameter.
* **Success status code:** 200 OK

## Error Responses

* **400 Bad Request:** Returned when the request contains invalid data, such as creating a book without a title.
* **404 Not Found:** Returned when a requested book ID does not exist in the library.
