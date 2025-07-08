# Medical Research Agent

A specialized AI-powered research agent for finding accurate information about medical professionals and institutions. Built on the deep-research framework, this agent provides multiple search capabilities including doctor profiles, institution locations, and NPI number lookups.

This project was developed by Kyley Holder using the deep-research framework and Vibe Code tools like Manus.

## Features

- **Multiple Search Options**: Choose from doctor profiles, institution research, or NPI lookups
- **Doctor Profile Research**: Comprehensive information about medical professionals including specialty, location, and workplace
- **Institution Location Research**: Find detailed information about medical institutions including location, websites, and social media
- **NPI Number Lookup**: Search the official NPPES registry for National Provider Identifier information
- **Structured JSON Output**: Consistent data format with confidence scoring
- **Multiple Source Validation**: Cross-references information across authoritative medical sources
- **Interactive CLI Interface**: User-friendly numbered menu system
- **API and CLI Interfaces**: Both programmatic and interactive access methods

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

The interactive menu provides the following options:

1. **Research full doctor profile** - Comprehensive research about a medical professional
2. **Find medical institution location** - Research medical institutions and their details
3. **Find NPI number for US doctor** - Look up National Provider Identifier information
4. **Exit** - Close the application

#### Option 1: Doctor Profile Research
Follow the prompts to enter:
- Doctor's name
- Medical specialty
- Optional location hint
- Optional institution hint

#### Option 2: Institution Research
Enter the institution's name to find:
- Primary location
- Official websites
- Social media profiles
- Contact information

#### Option 3: NPI Number Lookup
Enter the following information:
- Doctor's first name
- Doctor's last name
- Optional state abbreviation (e.g., 'CA', 'NY')
- Optional city
- Optional specialty

#### API Server
```bash
npm run api
```

The API server will start on port 3051 with the following endpoints:

- `POST /api/research-doctor` - Research a single doctor
- `POST /api/research-doctors-batch` - Research multiple doctors (max 10)
- `GET /health` - Health check
- `GET /api/docs` - API documentation

#### Example API Request - Doctor Research
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

#### Example Response - Doctor Research
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

#### Example Response - Institution Research
```json
{
  "name": "Mayo Clinic",
  "location": "Rochester, Minnesota",
  "websites": [
    "https://www.mayoclinic.org",
    "https://www.mayo.edu"
  ],
  "social_media": [
    "https://www.facebook.com/MayoClinic",
    "https://twitter.com/MayoClinic"
  ],
  "confidence_score": 1.0,
  "sources": [
    "https://www.mayoclinic.org/about-mayo-clinic",
    "https://www.mayo.edu/research"
  ],
  "last_updated": "2025-07-03T18:30:00.000Z"
}
```

#### Example Response - NPI Lookup
```json
{
  "npi_number": "1234567890",
  "name": "John Smith, MD",
  "credential": "MD",
  "specialty": "Internal Medicine",
  "practice_address": "123 Medical Center Dr, Boston, MA, 02101",
  "mailing_address": "PO Box 123, Boston, MA, 02101",
  "phone": "617-555-0123",
  "enumeration_date": "2015-01-15",
  "last_updated": "2025-07-03T18:30:00.000Z",
  "status": "Active",
  "entity_type": "Individual Provider",
  "sources": [
    "https://npiregistry.cms.hhs.gov/api/?version=2.1&..."
  ],
  "confidence_score": 0.9
}
```

## How It Works

The medical research agent follows specialized research methodologies for each search type:

### Doctor Profile Research
1. **Query Generation**: Creates targeted search queries optimized for medical sources
2. **Google Custom Search**: Utilizes the Google Custom Search API to perform web searches
3. **Custom Web Scraping**: Employs robust web scraping to extract content from medical websites
4. **Information Extraction**: Uses AI to extract structured medical professional data
5. **Cross-Validation**: Compares information across multiple sources for accuracy
6. **Confidence Scoring**: Assigns reliability scores based on source authority and consistency

### Institution Research
1. **Institution-Specific Queries**: Generates search queries focused on institutional information
2. **Multi-Source Extraction**: Gathers data from official websites, directories, and social media
3. **Location Verification**: Cross-validates location information across multiple sources
4. **Website and Social Media Discovery**: Identifies official online presence
5. **Information Aggregation**: Combines findings into structured institutional profiles

### NPI Lookup
1. **NPPES API Integration**: Direct connection to the official National Provider Identifier registry
2. **Real-Time Data**: Accesses up-to-date NPI information from CMS (Centers for Medicare & Medicaid Services)
3. **Comprehensive Provider Data**: Retrieves practice addresses, specialties, credentials, and status
4. **Official Source Verification**: Uses only authoritative government data for maximum accuracy

## Source Prioritization

The agent prioritizes sources in the following order:

### For Doctor Research:
1. **Medical Directories**: State medical boards, licensing authorities
2. **Hospital Websites**: Official staff directories and profiles
3. **Academic Profiles**: University faculty listings and research profiles
4. **Professional Societies**: Specialty organization member directories
5. **News Articles**: Recent announcements and press releases

### For Institution Research:
1. **Official Institution Websites**: Primary institutional domains
2. **Government Directories**: CMS, state health departments
3. **Academic Affiliations**: University and medical school listings
4. **Professional Networks**: Healthcare organization directories

### For NPI Lookup:
1. **NPPES Registry**: Official CMS National Provider Identifier database (primary source)

## Configuration

### Environment Variables

- `OPENAI_KEY`: Your OpenAI API key for AI processing
- `GOOGLE_API_KEY`: Your Google Custom Search API key for web searches
- `GOOGLE_SEARCH_ENGINE_ID`: Your Google Custom Search Engine ID
- `CONTEXT_SIZE`: Maximum context size for AI processing (default: 128000)
- `PORT`: API server port (default: 3051)

### Setting Up Google Custom Search

1. Go to the [Google Custom Search Engine](https://cse.google.com/cse/) page
2. Create a new search engine or use an existing one
3. Configure it to search the entire web
4. Get your Search Engine ID from the control panel
5. Enable the Custom Search API in the [Google Cloud Console](https://console.cloud.google.com/)
6. Create an API key for the Custom Search API

### Customization

The agent can be customized by modifying:
- `src/medical-prompts.ts`: Search and extraction prompts
- `src/medical-schemas.ts`: Input/output data schemas
- `src/medical-core.ts`: Core research logic and aggregation

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

## CLI Menu Options

### 1. Research Full Doctor Profile
Comprehensive research including:
- Full name with credentials
- Medical specialty and subspecialties
- Primary practice location
- Current workplace/institution
- Additional affiliations
- Confidence scoring
- Source verification

### 2. Find Medical Institution Location
Institution research including:
- Official institution name
- Primary location and address
- Official websites
- Social media profiles
- Contact information
- Confidence scoring

### 3. Find NPI Number for US Doctor
Official NPI registry lookup including:
- 10-digit National Provider Identifier
- Provider name and credentials
- Primary specialty/taxonomy
- Practice and mailing addresses
- Phone numbers
- Enumeration and update dates
- Provider status (Active/Inactive)
- Entity type (Individual/Organizational)

## Error Handling

The agent provides detailed error messages for common issues:
- Missing required fields (name, specialty)
- Invalid input data format
- API rate limits or connectivity issues
- No information found for the specified doctor/institution
- NPI registry connection issues

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
5. For NPI lookups, verify the doctor practices in the United States

## Recent Updates

### Version 1.1.0
- Added numbered menu system for better user experience
- Implemented NPI number lookup using official NPPES API
- Added institution location research capability
- Enhanced CLI interface with multiple search options
- Improved error handling and user guidance
- Added comprehensive documentation for all features

