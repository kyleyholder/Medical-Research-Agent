# Medical Research Agent

A specialized AI-powered research agent for finding accurate information about medical professionals. Built on the deep-research framework, this agent focuses specifically on extracting structured information about doctors including their name, specialty, location, and workplace.

This project was developed by Kyley Holder using the deep-research framework and Vibe Code tools like Manus.

## Features

- **Targeted Medical Research**: Specialized search queries for medical professionals
- **Structured JSON Output**: Consistent data format with name, specialty, location, and workplace
- **Multiple Source Validation**: Cross-references information across authoritative medical sources
- **Confidence Scoring**: Provides reliability scores for extracted information
- **API and CLI Interfaces**: Both programmatic and interactive access methods
- **Batch Processing**: Research multiple doctors in a single request

## Quick Start

### Prerequisites

- Node.js 22.x
- OpenAI API key
- Google Custom Search API key
- Google Custom Search Engine ID

### Installation

1. Clone or download the medical-research-agent directory
2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables in `.env.local`:
   ```
   OPENAI_KEY="your_openai_key"
   GOOGLE_API_KEY="your_google_api_key"
   GOOGLE_SEARCH_ENGINE_ID="your_google_search_engine_id"
   CONTEXT_SIZE="128000"
   ```

### Usage

#### CLI Interface
```bash
npm start
```

Follow the interactive prompts to enter:
- Doctor's name
- Medical specialty
- Optional location hint
- Optional institution hint

#### API Server
```bash
npm run api
```

The API server will start on port 3051 with the following endpoints:

- `POST /api/research-doctor` - Research a single doctor
- `POST /api/research-doctors-batch` - Research multiple doctors (max 10)
- `GET /health` - Health check
- `GET /api/docs` - API documentation

#### Example API Request
```bash
curl -X POST http://localhost:3051/api/research-doctor \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Dr. John Smith",
    "specialty": "Cardiology",
    "location_hint": "Boston, MA",
    "institution_hint": "Massachusetts General Hospital"
  }'
```

#### Example Response
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
    "sources": [
      "https://www.massgeneral.org/doctors/...",
      "https://hms.harvard.edu/faculty/..."
    ],
    "last_updated": "2025-06-09T13:54:00.000Z"
  },
  "query": {
    "name": "Dr. John Smith",
    "specialty": "Cardiology",
    "location_hint": "Boston, MA",
    "institution_hint": "Massachusetts General Hospital"
  }
}
```

## How It Works

The medical research agent follows a specialized research methodology:

1. **Query Generation**: Creates targeted search queries optimized for medical sources
2. **Google Custom Search**: Utilizes the Google Custom Search API to perform web searches and retrieve relevant results.
3. **Custom Web Scraping**: Employs a robust, custom-built web scraper to extract and clean content from web pages, handling various user agents and HTML structures.
4. **Information Extraction**: Uses AI to extract structured medical professional data from the scraped content
5. **Cross-Validation**: Compares information across multiple sources for accuracy
6. **Confidence Scoring**: Assigns reliability scores based on source authority and consistency
7. **Result Aggregation**: Combines findings into a structured JSON response

## Source Prioritization

The agent prioritizes sources in the following order:
1. **Medical Directories**: State medical boards, licensing authorities
2. **Hospital Websites**: Official staff directories and profiles
3. **Academic Profiles**: University faculty listings and research profiles
4. **Professional Societies**: Specialty organization member directories
5. **News Articles**: Recent announcements and press releases

## Configuration

### Environment Variables

- `OPENAI_KEY`: Your OpenAI API key for AI processing
- `CONTEXT_SIZE`: Maximum context size for AI processing (default: 128000)
- `PORT`: API server port (default: 3051)

### Customization

The agent can be customized by modifying:
- `src/medical-prompts.ts`: Search and extraction prompts
- `src/medical-schemas.ts`: Input/output data schemas
- `src/medical-research.ts`: Core research logic and aggregation

## API Reference

### POST /api/research-doctor

Research a single medical professional.

**Request Body:**
```json
{
  "name": "string (required)",
  "specialty": "string (required)",
  "location_hint": "string (optional)",
  "institution_hint": "string (optional)"
}
```

**Response:**
```json
{
  "success": boolean,
  "data": {
    "name": "string",
    "specialty": "string",
    "location": "string",
    "workplace": "string",
    "additional_workplaces": ["string"] | undefined,
    "confidence_score": number,
    "sources": ["string"],
    "last_updated": "string"
  },
  "query": object
}
```

### POST /api/research-doctors-batch

Research multiple medical professionals (maximum 10 per request).

**Request Body:**
```json
{
  "doctors": [
    {
      "name": "string (required)",
      "specialty": "string (required)",
      "location_hint": "string (optional)",
      "institution_hint": "string (optional)"
    }
  ]
}
```

## Error Handling

The agent provides detailed error messages for common issues:
- Missing required fields (name, specialty)
- Invalid input data format
- API rate limits or connectivity issues
- No information found for the specified doctor

Low confidence scores (< 0.5) indicate potential issues with:
- Name spelling or formatting
- Specialty specification
- Need for additional location/institution hints

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions:
1. Check the API documentation at `/api/docs`
2. Verify your API keys are correctly configured
3. Ensure the doctor name and specialty are accurate
4. Consider adding location or institution hints for better results

