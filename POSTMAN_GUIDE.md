# Postman Guide: Sending Datasets to API

This guide shows you how to send datasets to your backend API using Postman.

## Table of Contents
1. [Basic Setup](#basic-setup)
2. [Sending JSON Data (Reading Session Results)](#sending-json-data-reading-session-results)
3. [Sending JSON Data (Test/Quiz Results)](#sending-json-data-testquiz-results)
4. [Sending Form-Data with Files](#sending-form-data-with-files)
5. [Common Issues & Solutions](#common-issues--solutions)

---

## Basic Setup

### 1. Set Your Base URL
- **Local Development**: `http://localhost:5000`
- **Production**: Your production URL

### 2. Set Request Method
- Select the HTTP method (GET, POST, PUT, DELETE) from the dropdown

### 3. Set Headers
For JSON requests, add:
```
Content-Type: application/json
```

For form-data with files, Postman will automatically set:
```
Content-Type: multipart/form-data
```

---

## Sending JSON Data (Reading Session Results)

### Endpoint: `POST /api/results`

**Step 1:** Select **POST** method

**Step 2:** Enter URL: `http://localhost:5000/api/results`

**Step 3:** Go to **Headers** tab and add:
```
Content-Type: application/json
```

**Step 4:** Go to **Body** tab:
- Select **raw**
- Select **JSON** from the dropdown

**Step 5:** Paste this example JSON:

```json
{
  "teacherId": "teacher123",
  "type": "reading-session",
  "sessionId": "session456",
  "sessionTitle": "Reading Practice Session 1",
  "book": "The Cat in the Hat",
  "gradeId": "grade3",
  "studentId": "student789",
  "wordsRead": 150,
  "totalWords": 200,
  "miscues": 5,
  "oralReadingScore": 92.5,
  "readingSpeed": 120,
  "elapsedTime": 100,
  "transcript": "The cat in the hat sat on the mat...",
  "sessionDate": "2024-01-15T10:30:00Z"
}
```

**Step 6:** Click **Send**

---

## Sending JSON Data (Test/Quiz Results)

### Endpoint: `POST /api/results`

**Step 1-4:** Same as above

**Step 5:** Use this example JSON for quiz results:

```json
{
  "teacherId": "teacher123",
  "type": "test",
  "testId": "test456",
  "testName": "Comprehension Quiz - The Cat in the Hat",
  "testCategory": "comprehension",
  "studentId": "student789",
  "studentName": "John Doe",
  "totalQuestions": 10,
  "correctAnswers": 8,
  "score": 80,
  "comprehension": 80,
  "answers": [
    {
      "questionId": "test456-q0",
      "question": "What is the main character's name?",
      "selectedAnswer": "The Cat",
      "correctAnswer": "The Cat",
      "isCorrect": true
    },
    {
      "questionId": "test456-q1",
      "question": "Where does the story take place?",
      "selectedAnswer": "At the park",
      "correctAnswer": "At home",
      "isCorrect": false
    }
  ],
  "testDate": "2024-01-15T11:00:00Z"
}
```

---

## Sending Form-Data with Files

### Endpoint: `POST /api/stories`

**Step 1:** Select **POST** method

**Step 2:** Enter URL: `http://localhost:5000/api/stories`

**Step 3:** Go to **Body** tab:
- Select **form-data**

**Step 4:** Add the following key-value pairs:

| Key | Type | Value |
|-----|------|-------|
| `pdf` | **File** | Click "Select Files" and choose your PDF file |
| `title` | **Text** | "The Cat in the Hat" |
| `description` | **Text** | "A classic children's story about a cat" |
| `language` | **Text** | "english" (or "tagalog") |
| `readingLevel` | **Text** | "beginner" |
| `grade` | **Text** | "3" |
| `storySet` | **Text** | "set1" (optional) |
| `categories` | **Text** | `["fiction", "children"]` (JSON array as string) |
| `createdBy` | **Text** | "teacher123" |

**Important Notes:**
- The `pdf` field **must** be of type **File** (not Text)
- `categories` should be a JSON array string: `["category1", "category2"]`
- `grade` and `storySet` are strings, not numbers

**Step 5:** Click **Send**

---

## Example: Complete Reading Session Dataset

Here's a complete example for a reading session with all fields:

```json
{
  "teacherId": "teacher_abc123",
  "type": "reading-session",
  "sessionId": "session_xyz789",
  "sessionTitle": "Grade 3 Reading Practice - Week 1",
  "book": "The Cat in the Hat",
  "gradeId": "grade3",
  "studentId": "student_def456",
  "wordsRead": 245,
  "totalWords": 300,
  "miscues": 8,
  "oralReadingScore": 91.7,
  "readingSpeed": 135,
  "elapsedTime": 109,
  "transcript": "The sun did not shine. It was too wet to play. So we sat in the house all that cold, cold, wet day.",
  "audioUrl": "https://storage.example.com/audio/session_xyz789.webm",
  "storyUrl": "https://storage.example.com/stories/cat_in_hat.pdf",
  "sessionDate": "2024-01-15T14:30:00.000Z"
}
```

---

## Example: Complete Quiz Dataset

Here's a complete example for a quiz with multiple questions:

```json
{
  "teacherId": "teacher_abc123",
  "type": "test",
  "testId": "test_quiz123",
  "testName": "The Cat in the Hat - Comprehension Quiz",
  "testCategory": "reading-comprehension",
  "studentId": "student_def456",
  "studentName": "Jane Smith",
  "totalQuestions": 5,
  "correctAnswers": 4,
  "score": 80,
  "comprehension": 80,
  "answers": [
    {
      "questionId": "test_quiz123-q0",
      "question": "What was the weather like at the beginning of the story?",
      "selectedAnswer": "Rainy and cold",
      "correctAnswer": "Rainy and cold",
      "isCorrect": true
    },
    {
      "questionId": "test_quiz123-q1",
      "question": "Who came to visit the children?",
      "selectedAnswer": "The Cat in the Hat",
      "correctAnswer": "The Cat in the Hat",
      "isCorrect": true
    },
    {
      "questionId": "test_quiz123-q2",
      "question": "What did the cat do to entertain the children?",
      "selectedAnswer": "Told jokes",
      "correctAnswer": "Performed tricks",
      "isCorrect": false
    },
    {
      "questionId": "test_quiz123-q3",
      "question": "How did the children feel about the cat?",
      "selectedAnswer": "Excited",
      "correctAnswer": "Excited",
      "isCorrect": true
    },
    {
      "questionId": "test_quiz123-q4",
      "question": "What happened at the end of the story?",
      "selectedAnswer": "The cat cleaned up",
      "correctAnswer": "The cat cleaned up",
      "isCorrect": true
    }
  ],
  "testDate": "2024-01-15T15:00:00.000Z"
}
```

---

## Common Issues & Solutions

### Issue 1: "Missing required fields" Error
**Solution:** Make sure you're sending all required fields:
- For results: `teacherId` and `type` are required
- For stories: `title` and `description` are required

### Issue 2: "Invalid PDF file" Error
**Solution:** 
- Make sure the file is actually a PDF
- Check file size (max 10MB)
- Ensure you're using the `pdf` field name (not `file` or `document`)

### Issue 3: CORS Error
**Solution:**
- Make sure your backend CORS is configured correctly
- Check if you're using the correct origin URL

### Issue 4: Date Format Issues
**Solution:** Use ISO 8601 format:
```
"2024-01-15T14:30:00.000Z"
```

### Issue 5: Categories Not Parsing
**Solution:** Send categories as a JSON string:
```
categories: ["fiction", "children"]
```
Not as separate fields.

---

## Quick Test Endpoint

Test if your server is running:

**GET** `http://localhost:5000/api/test`

Expected response:
```json
{
  "message": "Backend server is working!",
  "timestamp": "2024-01-15T14:30:00.000Z"
}
```

---

## Tips

1. **Save Requests**: Save your requests in Postman collections for easy reuse
2. **Environment Variables**: Use Postman environments to switch between local/production
3. **Pre-request Scripts**: Use scripts to generate dynamic data
4. **Tests**: Add tests to verify responses automatically

---

## Environment Variables Setup

Create a Postman environment with:
- `base_url`: `http://localhost:5000`
- `teacher_id`: Your teacher ID
- `student_id`: Your student ID

Then use in requests: `{{base_url}}/api/results`

