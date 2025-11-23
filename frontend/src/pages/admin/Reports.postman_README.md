# Postman Collection for Reports API

This collection provides sample requests and data structures for testing the Reports functionality in the Phil I-Ready application.

## Files Included

1. **Reports.postman_collection.json** - Main Postman collection with all API requests
2. **Reports.postman_environment.json** - Environment variables for Postman
3. **Reports.postman_sample_data.json** - Sample data structures for testing
4. **Reports.postman_README.md** - This documentation file

## Importing into Postman

1. Open Postman
2. Click **Import** button
3. Select **Files** tab
4. Import the following files:
   - `Reports.postman_collection.json`
   - `Reports.postman_environment.json`
5. Select the imported environment from the environment dropdown

## Configuration

### Environment Variables

Update the following variables in the environment:

- `base_url`: Your backend API URL (if using Firebase Functions or custom backend)
  - Example: `http://localhost:5001/your-project-id/us-central1`
- `project_id`: Your Firebase project ID
- `firebase_token`: Firebase authentication token (get from Firebase Console)
- `admin_id`: Admin user ID for testing
- `admin_name`: Admin user name

### Getting Firebase Token

1. Go to Firebase Console
2. Navigate to Project Settings > Service Accounts
3. Generate a new private key
4. Use the token from the JSON file, or authenticate via Firebase Auth and get the ID token

## Collection Structure

### 1. Sample Data Structures

Contains sample JSON payloads that match the data structure expected by the Reports page:

- **Approved ISR Record - Sample**: Structure for `approvedISRRecords` collection
- **Admin Inbox Submission - Sample**: Structure for `adminInbox` collection

### 2. Report Data Queries

API endpoints for fetching report data (if you have a backend API):

- **Get Phil-IRI Summary Data**: Fetches combined data from approved and pending ISR records
- **Get Reading Level Distribution**: Fetches reading level statistics by grade
- **Get Teacher ISR Submissions**: Fetches teacher submission tracking
- **Get Comprehension Analysis**: Fetches comprehension data with observations
- **Get Report Statistics**: Fetches overall statistics

### 3. Report Generation

Endpoints for generating reports:

- **Generate Report - Excel**: Generates report in .xlsx format
- **Generate Report - PDF**: Generates report in PDF format

### 4. Firebase Firestore Direct

Direct Firestore REST API calls (if using Firestore REST API):

- **Get Approved ISR Records**: Direct query to `approvedISRRecords` collection
- **Get Admin Inbox Submissions**: Direct query to `adminInbox` collection

## Query Parameters

### Academic Period Options

- `current-quarter`: Current academic quarter
- `q1-2024-25`: 1st Quarter (Aug-Oct 2024)
- `q2-2024-25`: 2nd Quarter (Nov-Jan 2025)
- `q3-2024-25`: 3rd Quarter (Feb-Apr 2025)
- `q4-2024-25`: 4th Quarter (May-Jul 2025)
- `semester1-2024-25`: 1st Semester (Aug-Jan 2025)
- `semester2-2024-25`: 2nd Semester (Feb-Jul 2025)
- `school-year-2024-25`: Full School Year 2024-2025
- `school-year-2023-24`: Previous School Year 2023-2024

### Status Options

- `pending`: Pending approval
- `approved`: Approved records
- `rejected`: Rejected records
- `all`: All statuses

### Language Options

- `Filipino`: Tagalog/Filipino language
- `English`: English language
- `all`: Both languages

## Data Structure Reference

### Reading Level Determination

The system determines reading levels based on Phil-IRI criteria:

- **Independent**: Both word reading and comprehension are independent
- **Instructional**: Word reading or comprehension is instructional
- **Frustration**: Neither word reading nor comprehension meets independent/instructional criteria

### Student Reading Data Structure

```json
{
  "readingData": [{
    "dateTaken": "2024-01-10",
    "wordReading": {
      "ind": true,   // Independent
      "ins": false   // Instructional
    },
    "comprehension": {
      "ind": true,   // Independent
      "ins": false   // Instructional
    }
  }]
}
```

### Observations Structure

```json
{
  "observations": {
    "wordByWord": false,
    "lacksExpression": false,
    "hardlyAudible": false,
    "disregardsPunctuation": false,
    "pointsToWords": false,
    "littleAnalysis": false,
    "otherObservations": "Additional notes here"
  }
}
```

## Testing Workflow

1. **Setup**: Import collection and environment, configure variables
2. **Create Test Data**: Use sample data structures to create test records in Firestore
3. **Query Data**: Test report data queries with different filters
4. **Generate Reports**: Test report generation in different formats
5. **Verify Results**: Check that generated reports match expected structure

## Notes

- The Reports page uses **direct Firestore queries** in the frontend, not REST API endpoints
- If you're building a backend API, use the provided request structures as reference
- The sample data structures match exactly what the `reportService.ts` expects
- All dates should be in ISO 8601 format or Firestore Timestamp format
- Reading levels are calculated automatically based on `wordReading` and `comprehension` flags

## Troubleshooting

### Common Issues

1. **401 Unauthorized**: Check that `firebase_token` is valid and not expired
2. **404 Not Found**: Verify `base_url` and `project_id` are correct
3. **Empty Results**: Ensure test data exists in Firestore collections
4. **Invalid Query**: Check that query parameters match expected format

### Firestore Collection Names

- `approvedISRRecords`: Approved Individual Summary Records
- `adminInbox`: Pending teacher submissions awaiting approval

## Support

For issues or questions, refer to:
- `frontend/src/services/reportService.ts` - Service implementation
- `frontend/src/pages/admin/Reports.tsx` - Component implementation

