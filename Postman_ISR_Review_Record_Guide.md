# Postman Collection for ISR Review Record API

## Overview
This guide provides Postman requests for the ISR Review Record endpoints. The ISR Review Record is a summary of a student's reading assessment results over time.

## Base URL
```
http://localhost:5000
```
(For production, replace with your production API URL)

---

## 1. Sync ISR Review Record (POST)

### Endpoint
```
POST /api/isr-review-records/student/:studentId/sync
```

### Description
Syncs/rebuilds the ISR review record from all ISR results for a student. This endpoint:
- Fetches all ISR results for the student from the database
- Recalculates all entries using the ISR review calculator
- Updates or creates the review record with the latest calculated data
- Ensures all flags (wordReading and comprehension) are correctly set based on database data

### Request Details

**Method:** `POST`

**URL:** 
```
http://localhost:5000/api/isr-review-records/student/{studentId}/sync
```

**Path Variables:**
- `studentId` (required): The student ID to sync the review record for

**Headers:**
```
Content-Type: application/json
```

**Body:** 
No body required (empty)

### Example Request

**cURL:**
```bash
curl -X POST \
  http://localhost:5000/api/isr-review-records/student/student123/sync \
  -H 'Content-Type: application/json'
```

**Postman:**
1. Method: `POST`
2. URL: `http://localhost:5000/api/isr-review-records/student/student123/sync`
3. Headers: `Content-Type: application/json`
4. Body: None (leave empty)

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Review record synced from 2 ISR results",
  "record": {
    "_id": "507f1f77bcf86cd799439011",
    "studentId": "student123",
    "studentName": "John Doe",
    "teacherId": "teacher456",
    "teacherName": "Ms. Jane Smith",
    "gradeSection": "Grade 4 - Narra",
    "school": "Sample Elementary School",
    "languages": {
      "english": true,
      "filipino": false
    },
    "levelStarted": "IV",
    "entries": [
      {
        "level": "K",
        "set": "",
        "levelStarted": false,
        "wordReading": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "dateTaken": null
      },
      {
        "level": "I",
        "set": "",
        "levelStarted": false,
        "wordReading": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "dateTaken": null
      },
      {
        "level": "II",
        "set": "",
        "levelStarted": false,
        "wordReading": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "dateTaken": null
      },
      {
        "level": "III",
        "set": "",
        "levelStarted": false,
        "wordReading": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "dateTaken": null
      },
      {
        "level": "IV",
        "set": "A",
        "levelStarted": true,
        "wordReading": {
          "ind": true,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": true,
          "ins": false,
          "frus": false
        },
        "dateTaken": "2024-01-15T00:00:00.000Z"
      },
      {
        "level": "V",
        "set": "",
        "levelStarted": false,
        "wordReading": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "dateTaken": null
      },
      {
        "level": "VI",
        "set": "",
        "levelStarted": false,
        "wordReading": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "dateTaken": null
      },
      {
        "level": "VII",
        "set": "",
        "levelStarted": false,
        "wordReading": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "comprehension": {
          "ind": false,
          "ins": false,
          "frus": false
        },
        "dateTaken": null
      }
    ],
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  "processedResults": 2
}
```

### Error Responses

**404 Not Found - No ISR Results:**
```json
{
  "error": "No ISR results found for this student",
  "studentId": "student123"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to sync ISR review record"
}
```

---

## 2. Get ISR Review Record (GET)

### Endpoint
```
GET /api/isr-review-records/student/:studentId
```

### Description
Retrieves the ISR review record for a student. Optionally syncs before fetching if `sync=true` query parameter is provided.

### Request Details

**Method:** `GET`

**URL:** 
```
http://localhost:5000/api/isr-review-records/student/{studentId}?sync=true
```

**Path Variables:**
- `studentId` (required): The student ID to fetch the review record for

**Query Parameters:**
- `sync` (optional): Set to `"true"` to rebuild from all ISR results before fetching

**Headers:**
```
Content-Type: application/json
```

### Example Request

**cURL:**
```bash
# Without sync
curl -X GET \
  http://localhost:5000/api/isr-review-records/student/student123 \
  -H 'Content-Type: application/json'

# With sync
curl -X GET \
  http://localhost:5000/api/isr-review-records/student/student123?sync=true \
  -H 'Content-Type: application/json'
```

**Postman:**
1. Method: `GET`
2. URL: `http://localhost:5000/api/isr-review-records/student/student123`
3. Query Params (optional): `sync=true`
4. Headers: `Content-Type: application/json`

### Success Response (200 OK)

Same structure as the POST sync response, but without the `success`, `message`, and `processedResults` fields.

---

## Response Field Descriptions

### ISRReviewRecord Object

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | MongoDB document ID |
| `studentId` | String | Unique student identifier |
| `studentName` | String | Student's full name |
| `teacherId` | String | Teacher's unique identifier |
| `teacherName` | String | Teacher's full name |
| `gradeSection` | String | Grade and section (e.g., "Grade 4 - Narra") |
| `school` | String | School name |
| `languages` | Object | Language flags: `{ english: boolean, filipino: boolean }` |
| `levelStarted` | String | The level where the student started (e.g., "IV") |
| `entries` | Array | Array of ISRReviewEntry objects (one for each level K-VII) |
| `updatedAt` | Date | Last update timestamp |
| `createdAt` | Date | Creation timestamp |

### ISRReviewEntry Object

| Field | Type | Description |
|-------|------|-------------|
| `level` | String | Reading level in Roman numerals: "K", "I", "II", "III", "IV", "V", "VI", "VII" |
| `set` | String | Story set: "A", "B", "C", or "D" |
| `levelStarted` | Boolean | Whether this is the level where the student started |
| `wordReading` | Object | Word reading flags: `{ ind: boolean, ins: boolean, frus: boolean }` |
| `comprehension` | Object | Comprehension flags: `{ ind: boolean, ins: boolean, frus: boolean }` |
| `dateTaken` | Date | Date when the assessment was taken |

### Flag Meanings

- **ind** (Independent): Student reads/comprehends at independent level (≥97% accuracy for word reading)
- **ins** (Instructional): Student reads/comprehends at instructional level (90-96% accuracy for word reading)
- **frus** (Frustration): Student reads/comprehends at frustration level (<90% accuracy for word reading)

---

## Importing the Postman Collection

1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose `Postman_ISR_Review_Record_Collection.json`
5. Click **Import**

The collection will be added to your Postman workspace with both requests pre-configured.

---

## Testing Steps

1. **Get a valid student ID** from your database or from the students list in the application
2. **Replace `{studentId}`** in the URL with the actual student ID
3. **Send the POST request** to sync the review record
4. **Check the response** to verify:
   - The record was created/updated successfully
   - The entries array contains data for the student's grade level
   - The wordReading and comprehension flags are correctly set
   - The dateTaken field is populated

---

## Notes

- The sync endpoint automatically calculates all flags based on the ISR results stored in the database
- The review record is automatically updated when new ISR results are saved (via the `/api/isr-results` POST endpoint)
- Use the sync endpoint when you need to rebuild the review record from scratch or fix inconsistencies
- The review record always contains entries for all 8 levels (K, I, II, III, IV, V, VI, VII), but only entries with data will have flags set to true








