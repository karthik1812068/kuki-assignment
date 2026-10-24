# Documents

`GET` and `POST /documents` require the session cookie. Files are stored under `data/documents`. Processing status lives in Postgres, so it survives an API or worker restart.

## `POST /documents`

`multipart/form-data` field name `files`. Up to 12 files. Accepted extensions: `pdf`, `xlsx`, `xls`, `csv`, `txt`, `md`, `json`. Returns 202 and one row per file.

- A new file is `queued`, then the worker sets `processing`, then `completed` or `failed`.
- The same bytes uploaded again become `duplicate` and point at the earlier row. They are not processed twice.
- One rejected file does not stop the rest of the batch.

The storage path and file bytes are not returned.

## `POST /documents/ask`

JSON `{ "question": "..." }`. Only completed files. Each answer includes locators. If the topic isn't in the files we say so instead of grabbing a random number.

## `GET /documents` and `GET /documents/:id`

Lists or shows rows for the signed-in user only. Completed rows include extracted facts with a locator (sheet row or line) and any Indian financial year labels (`FY 2023-24` → `FY2024`).
