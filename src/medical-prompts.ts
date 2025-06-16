export const medicalQueryGenerationPrompt = `Generate targeted search queries to find information about a medical professional. Focus on queries that will find authoritative sources like medical directories, hospital websites, and academic profiles.

Consider these query types:
1. "[Doctor Name] [Specialty] [Location]" - for general professional searches
2. "[Doctor Name] MD [Institution]" - for institutional affiliation searches  
3. "[Doctor Name] [Specialty] hospital clinic" - for practice location searches
4. "[Doctor Name] medical license [State]" - for licensing verification
5. "[Doctor Name] faculty [University]" - for academic positions

Avoid overly complex queries. Keep them simple and targeted for better results.`;

export const medicalExtractionPrompt = `Extract medical professional information from the provided content. Be flexible and look for any relevant information about the target doctor.

Extract the following if found:
1. Full name with titles (Dr., Professor, MD, PhD, etc.)
2. Medical specialty or field (oncology, urology, surgery, etc.)
3. Current workplace/institution (hospital, university, clinic)
4. Location (city, state, country) - can be inferred from institution location
5. Position/title (Professor, Consultant, Director, etc.)

Be flexible with name matching:
- Look for variations (Tom/Thomas, Dr./Professor)
- Match partial names if context is clear
- Consider nicknames and professional titles

For location, accept:
- Institution addresses
- City/country mentioned in context
- Geographic references in the content

For workplace, look for:
- Hospital names
- University affiliations
- Medical centers
- Research institutions
- Clinical practices

Provide confidence based on:
- How clearly the information is stated
- Authority of the source
- Completeness of information found

Even partial information is valuable - extract what you can find.`;

export const medicalResearchSystemPrompt = `You are a specialized medical research assistant. Your goal is to extract any available information about medical professionals from web content.

Be flexible and adaptive:
- Accept partial matches and variations in names
- Look for context clues about location and workplace
- Extract information even if not perfectly formatted
- Consider international variations in titles and institutions

Focus on finding:
- Any form of the doctor's name (with or without titles)
- Medical specialty or field of practice
- Current institutional affiliation
- Geographic location (city, country)
- Professional position or title

Prioritize extracting available information over perfect matches.`;

export const medicalReportPrompt = `Generate a comprehensive report about the medical professional based on the research findings. Structure the report as follows:

## Medical Professional Profile

### Basic Information
- Full Name: [Include titles and credentials]
- Primary Specialty: [Be specific about subspecialties]
- Practice Location: [City, State/Province, Country]
- Primary Workplace: [Institution name and type]

### Professional Background
[Summarize key career highlights, education, and experience]

### Current Practice
[Details about current position, responsibilities, and practice focus]

### Additional Affiliations
[Secondary appointments, consulting roles, board positions]

### Verification Sources
[List all sources used with URLs for verification]

### Research Notes
[Any limitations, conflicting information, or areas needing further verification]

Ensure all information is factual and properly attributed to sources.`;

