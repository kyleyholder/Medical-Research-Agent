# Medical Research Agent - Usage Guide

## Quick Start

### 1. CLI Usage (Interactive)
```bash
cd medical-research-agent
npm start
```

Follow the prompts to enter:
- Doctor's name
- Medical specialty  
- Optional location hint
- Optional institution hint

### 2. API Usage (Programmatic)
```bash
# Start the API server
npm run api

# Make a request
curl -X POST http://localhost:3051/api/research-doctor \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. John Smith",
    "specialty": "Cardiology"
  }'
```

### 3. Example API Response
```json
{
  "success": true,
  "data": {
    "name": "Dr. John Smith, MD",
    "specialty": "Interventional Cardiology",
    "location": "Boston, Massachusetts, USA",
    "workplace": "Massachusetts General Hospital",
    "additional_workplaces": ["Harvard Medical School"],
    "confidence_score": 0.85,
    "sources": ["https://www.massgeneral.org/doctors/..."],
    "last_updated": "2025-06-09T13:54:00.000Z"
  }
}
```

## Configuration

Ensure your `.env.local` file contains:
```
FIRECRAWL_KEY="your_firecrawl_key"
OPENAI_KEY="your_openai_key"
CONTEXT_SIZE="128000"
FIRECRAWL_CONCURRENCY="2"
```

## API Endpoints

- `POST /api/research-doctor` - Research single doctor
- `POST /api/research-doctors-batch` - Research multiple doctors (max 10)
- `GET /health` - Health check
- `GET /api/docs` - API documentation

## Tips for Best Results

1. **Use full names**: "Dr. John Smith" works better than "J. Smith"
2. **Be specific with specialties**: "Interventional Cardiology" vs "Cardiology"
3. **Add location hints**: Helps with disambiguation
4. **Include institution hints**: Improves accuracy for academic physicians

## Rate Limiting

The free Firecrawl tier has rate limits. For production use:
- Upgrade to a paid Firecrawl plan
- Reduce FIRECRAWL_CONCURRENCY to 1
- Add delays between requests

