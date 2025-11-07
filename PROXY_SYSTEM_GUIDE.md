# Encrypted Proxy System Guide

## Overview

The encrypted proxy system at `/proxy/beta` provides secure, credit-based access to an encrypted HTTP proxy service. All requests are encrypted using AES-256 cipher with Base64 encoding for double-layer security. Session and usage data is stored in MongoDB.

## System Architecture

### Access Requirements
- **Minimum Credits**: 1,000 credits required to access proxy
- **Cost**: 20 credits per minute of usage
- **Charging**: Credits deducted at the start of each minute

### Security Features

#### Double-Layer Encryption
1. **Base64 Encoding**: All requests are first encoded in Base64
2. **AES-256 Cipher**: Additional layer of AES-256 encryption with random IV (Initialization Vector)
3. **Response Encryption**: All responses are encrypted using the same pipeline

#### Request Validation
- Blocked domains: localhost, 127.0.0.1, 0.0.0.0, 192.168.*, 10.*, 172.16.*
- Forbidden headers filtered: host, connection, content-length, transfer-encoding
- Request timeout: 30 seconds
- Allowed methods: GET, POST, PUT, DELETE, PATCH, HEAD

### Database Collections (MongoDB)

#### proxy_sessions
Tracks active and historical proxy sessions:
- `_id`: MongoDB ObjectId (auto-generated)
- `userId`: User ID reference
- `startTime`: Session start timestamp
- `endTime`: Session end timestamp (nullable)
- `totalCreditsCharged`: Total credits deducted
- `status`: 'active', 'completed', or 'terminated'
- `createdAt`: Record creation timestamp

#### proxy_usage_logs
Detailed logs of proxy requests:
- `_id`: MongoDB ObjectId (auto-generated)
- `sessionId`: Foreign key to proxy_sessions
- `userId`: User ID
- `destinationUrl`: Target URL
- `requestMethod`: HTTP method used
- `responseStatus`: HTTP response status code
- `timestamp`: When request was made
- `createdAt`: Record creation timestamp

#### credit_transactions
Credit deduction history:
- `_id`: MongoDB ObjectId (auto-generated)
- `userId`: User ID
- `sessionId`: Foreign key to proxy_sessions
- `creditsDeducted`: Number of credits deducted
- `reason`: 'minute_charge' or 'session_termination'
- `timestamp`: When deduction occurred
- `createdAt`: Record creation timestamp

## API Endpoints

### GET /proxy/beta
Initializes a proxy session and displays the web interface.

**Authentication**: Required (1000+ credits)
**Response**: HTML page with proxy interface

### POST /api/proxy/request/:sessionId
Handles encrypted proxy requests.

**Authentication**: Required
**Request Body**:
```json
{
  "encryptedRequest": "base64_encoded_and_encrypted_request"
}
```

**Request Format** (before encryption and Base64 encoding):
```json
{
  "url": "https://example.com/api",
  "method": "GET",
  "headers": {"Authorization": "Bearer token"},
  "body": null
}
```

**Response**:
```json
{
  "success": true,
  "encryptedResponse": "base64_encoded_and_encrypted_response"
}
```

### GET /api/proxy/credits/:sessionId
Get current credit balance and session statistics.

**Response**:
```json
{
  "credits": 1500,
  "minutesElapsed": 5,
  "chargedMinutes": 5,
  "totalCharged": 100
}
```

### POST /api/proxy/end/:sessionId
Terminate the current proxy session.

**Response**:
```json
{
  "success": true
}
```

## Usage Example

### Client-Side Implementation

```javascript
// 1. Encrypt request payload
const requestData = {
  url: "https://api.example.com/data",
  method: "GET",
  headers: {},
  body: null
};

const encryptedRequest = btoa(JSON.stringify(requestData));

// 2. Send to proxy
const response = await fetch('/api/proxy/request/session-id-here', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ encryptedRequest })
});

const result = await response.json();

// 3. The result contains an encrypted response
// Response format (encrypted):
// {
//   "status": 200,
//   "statusText": "OK",
//   "headers": {...},
//   "body": "response content"
// }
```

## Real-Time Features

### Live Credit Display
- Updates every 1 second
- Shows current balance
- Color coding: Green (>100), Orange (50-100), Red (<50)

### Next Charge Timer
- Countdown timer showing seconds until next charge
- Resets to 60 seconds after each charge
- Visual indicator: Orange/warning color

### Automatic Charging
- Charges 20 credits at the start of each minute
- Automatic session termination if insufficient credits
- All charges logged to MongoDB

### Session Tracking
- Active session indicator with pulsing dot
- Real-time status display
- Automatic cleanup on disconnect

## Files Structure

```
/utils/
  ├── encryption.js          # Base64 and AES-256 encryption
  └── proxySessionManager.js # Session lifecycle management (MongoDB)

/routes/
  └── proxyHandler.js        # Proxy request handling and routing

/views/
  ├── proxy.ejs              # Main proxy interface
  └── error.ejs              # Error page template

server.js (updated)
  - /proxy/beta              # GET route for proxy interface
  - /api/proxy/request/:id   # POST route for proxy requests
  - /api/proxy/credits/:id   # GET route for credit status
  - /api/proxy/end/:id       # POST route to end session
```

## Logging

All proxy activity is logged with different severity levels:

### Server Console
- Session creation/termination
- Credit deductions (every minute)
- Failed requests
- Invalid domains/methods

### MongoDB Collections
- Complete usage logs with timestamps
- Credit transaction history
- Request/response metadata

## Security Considerations

1. **Encryption Key**: Uses 32-byte AES-256 key from environment or random generation
2. **IV Randomization**: Each request uses a unique Initialization Vector
3. **Domain Blocking**: Local/private IP ranges automatically blocked
4. **Rate Limiting**: Implement at application level if needed
5. **Header Filtering**: Dangerous headers removed automatically
6. **Timeout Protection**: 30-second timeout on all outbound requests

## Configuration

### Constants (in server.js)
- `PROXY_ACCESS_REQUIREMENT`: 1000 (minimum credits)
- `PROXY_COST_PER_MINUTE`: 20 (cost per minute)

### Environment Variables
- `MONGODB_URI`: MongoDB connection string
- `PROXY_ENCRYPTION_KEY`: Optional. If not set, randomly generated

## Troubleshooting

### Session Not Found
- Ensure session ID is correct
- Check that session hasn't expired
- Verify user authentication

### Insufficient Credits
- Balance must be ≥ 1000 to access proxy
- ≥ 20 credits needed for each request
- Purchase credits or wait for daily login reward

### Encryption/Decryption Errors
- Verify Base64 encoding is correct
- Check that request format matches expected structure
- Ensure encryption key hasn't changed

### Blocked Domain Error
- Private IP ranges are blocked for security
- Must use public URLs
- Check domain against blocked list

### MongoDB Connection Issues
- Verify `MONGODB_URI` is set in `.env`
- Test connection: `mongosh "your-connection-string"`
- Check MongoDB Atlas IP whitelist if using cloud MongoDB

## Performance Notes

- Charging happens every 60 seconds (1 minute)
- Credit updates sync every 1 second
- Average response time: <500ms (depends on target server)
- Maximum request body size: No strict limit (system dependent)
- Maximum response size: Limited by available memory
- MongoDB indexes on `userId`, `sessionId` for fast lookups

## Future Enhancements

- WebSocket support for persistent connections
- Request/response compression
- Advanced analytics dashboard
- Geographic IP logging
- Rate limiting per user
- Monthly usage reports
- Session pause/resume functionality
