import FirecrawlApp, { SearchResponse } from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';

import { getModel, trimPrompt } from './ai/providers';
import { 
  DoctorQuery, 
  DoctorInfo, 
  MedicalSearchQueries, 
  MedicalExtraction,
  DoctorQuerySchema,
  DoctorInfoSchema,
  MedicalSearchQueriesSchema,
  MedicalExtractionSchema
} from './medical-schemas';
import { 
  medicalResearchSystemPrompt, 
  medicalQueryGenerationPrompt, 
  medicalExtractionPrompt 
} from './medical-prompts';

function log(...args: any[]) {
  console.log(...args);
}

// Initialize Firecrawl
const firecrawl = new FirecrawlApp({
  apiKey: process.env.FIRECRAWL_KEY ?? '',
  apiUrl: process.env.FIRECRAWL_BASE_URL,
});

const ConcurrencyLimit = Number(process.env.FIRECRAWL_CONCURRENCY) || 2;

// Generate medical-specific search queries
async function generateMedicalSearchQueries({
  doctorQuery,
  numQueries = 5,
}: {
  doctorQuery: DoctorQuery;
  numQueries?: number;
}): Promise<string[]> {
  const { name, specialty, location_hint, institution_hint } = doctorQuery;
  
  const contextInfo = [
    `Doctor Name: ${name}`,
    `Specialty: ${specialty}`,
    location_hint ? `Location Hint: ${location_hint}` : '',
    institution_hint ? `Institution Hint: ${institution_hint}` : '',
  ].filter(Boolean).join('\n');

  const prompt = `${medicalQueryGenerationPrompt}

Context:
${contextInfo}

Generate ${numQueries} targeted search queries to find authoritative information about this medical professional.`;

  try {
    const result = await generateObject({
      model: getModel(),
      schema: MedicalSearchQueriesSchema,
      prompt: trimPrompt(prompt),
      system: medicalResearchSystemPrompt,
    });

    return result.object.queries;
  } catch (error) {
    log('Error generating medical search queries:', error);
    // Fallback to basic queries
    return [
      `"${name}" ${specialty} doctor`,
      `"${name}" MD ${specialty}`,
      `"${name}" ${specialty} ${location_hint || ''}`.trim(),
      `"${name}" ${specialty} hospital clinic`,
      `"${name}" medical license ${specialty}`,
    ].filter(query => query.length > 10);
  }
}

// Extract medical information from search results
async function extractMedicalInfo({
  content,
  url,
  doctorQuery,
}: {
  content: string;
  url: string;
  doctorQuery: DoctorQuery;
}): Promise<MedicalExtraction | null> {
  if (!content || content.length < 50) {
    log(`Skipping ${url}: content too short (${content.length} chars)`);
    return null;
  }

  const prompt = `${medicalExtractionPrompt}

Target Doctor: ${doctorQuery.name}
Target Specialty: ${doctorQuery.specialty}
Source URL: ${url}

Content to analyze:
${trimPrompt(content, 8000)}

Extract medical professional information from this content. Look for any mention of the target doctor and extract available information.

If you cannot find specific information, use these defaults:
- doctor_name: "Not found" if no name is found
- specialty: "Not specified" if no specialty is found  
- location: "Not found" if no location is found
- workplace: "Not found" if no workplace is found
- confidence: 0.0 if no information is found
- source_type: "other" if uncertain about source type

Always provide all required fields even if the information is not available.`;

  try {
    const result = await generateObject({
      model: getModel(),
      schema: MedicalExtractionSchema,
      prompt: trimPrompt(prompt),
      system: medicalResearchSystemPrompt,
    });

    // Validate that the extracted information is about the target doctor
    const extraction = result.object;
    
    // More flexible name matching
    const targetFirstName = doctorQuery.name.toLowerCase().split(' ')[0];
    const targetLastName = doctorQuery.name.toLowerCase().split(' ').pop() || '';
    
    if (extraction.doctor_name && extraction.doctor_name !== "Not found") {
      const extractedName = extraction.doctor_name.toLowerCase();
      // Check if either first name or last name matches
      const hasFirstName = extractedName.includes(targetFirstName);
      const hasLastName = extractedName.includes(targetLastName);
      
      if (!hasFirstName && !hasLastName) {
        log(`Name mismatch: target="${doctorQuery.name}" vs extracted="${extraction.doctor_name}"`);
        return null;
      }
      
      log(`✅ Extracted info from ${url}: ${extraction.doctor_name}, ${extraction.specialty}, ${extraction.workplace}`);
    } else {
      log(`No doctor name extracted from ${url}`);
      return null;
    }

    return extraction;
  } catch (error) {
    log('Error extracting medical info from:', url, error);
    return null;
  }
}

// Perform medical research on a doctor
export async function researchDoctor(doctorQuery: DoctorQuery): Promise<DoctorInfo> {
  log(`Starting medical research for: ${doctorQuery.name} (${doctorQuery.specialty})`);

  // Validate input
  const validatedQuery = DoctorQuerySchema.parse(doctorQuery);

  // Generate search queries
  const searchQueries = await generateMedicalSearchQueries({
    doctorQuery: validatedQuery,
    numQueries: 6,
  });

  log(`Generated ${searchQueries.length} search queries:`, searchQueries);

  // Perform searches with concurrency control
  const limit = pLimit(ConcurrencyLimit);
  const searchPromises = searchQueries.map(query =>
    limit(async () => {
      try {
        log(`Searching: ${query}`);
        const searchResult = await firecrawl.search(query, {
          limit: 5,
        });

        if (!searchResult.success || !searchResult.data) {
          log(`Search failed for: ${query}`);
          return [];
        }

        return searchResult.data;
      } catch (error) {
        log(`Search error for "${query}":`, error);
        return [];
      }
    })
  );

  const searchResults = await Promise.all(searchPromises);
  const allResults = searchResults.flat();

  log(`Found ${allResults.length} total search results`);

  // Get unique URLs and scrape their content
  const uniqueUrls = [...new Set(allResults.map(r => r.url))].slice(0, 10);
  log(`Scraping content from ${uniqueUrls.length} unique URLs`);

  // Scrape content from URLs
  const scrapePromises = uniqueUrls.map(url =>
    limit(async () => {
      try {
        log(`Scraping: ${url}`);
        const scrapeResult = await firecrawl.scrape(url, {
          formats: ['markdown'],
        });

        if (!scrapeResult.success || !scrapeResult.data?.markdown) {
          log(`Scrape failed for: ${url}`);
          return null;
        }

        log(`Scraped ${url}: ${scrapeResult.data.markdown.length} chars`);
        return {
          url: url,
          content: scrapeResult.data.markdown,
        };
      } catch (error) {
        log(`Scrape error for "${url}":`, error);
        return null;
      }
    })
  );

  const scrapedResults = await Promise.all(scrapePromises);
  const validScrapedResults = scrapedResults.filter(r => r !== null);

  log(`Successfully scraped ${validScrapedResults.length} pages`);

  // Extract information from scraped content
  const extractionPromises = validScrapedResults.map(result =>
    limit(async () => {
      try {
        if (!result.content || result.content.length < 100) {
          log(`Skipping ${result.url}: content too short (${result.content?.length || 0} chars)`);
          return null;
        }

        log(`Processing ${result.url}: ${result.content.length} chars`);
        
        return await extractMedicalInfo({
          content: result.content,
          url: result.url,
          doctorQuery: validatedQuery,
        });
      } catch (error) {
        log(`Extraction error for ${result.url}:`, error);
        return null;
      }
    })
  );

  const extractions = await Promise.all(extractionPromises);
  const validExtractions = compact(extractions);

  log(`Successfully extracted information from ${validExtractions.length} sources`);

  // Aggregate and validate information
  const aggregatedInfo = aggregateMedicalInfo(validExtractions, validatedQuery);
  
  // Add metadata
  aggregatedInfo.last_updated = new Date().toISOString();
  aggregatedInfo.sources = uniqueUrls.slice(0, 10);

  return DoctorInfoSchema.parse(aggregatedInfo);
}

// Aggregate medical information from multiple sources
function aggregateMedicalInfo(extractions: MedicalExtraction[], originalQuery: DoctorQuery): Partial<DoctorInfo> {
  if (extractions.length === 0) {
    return {
      name: originalQuery.name,
      specialty: originalQuery.specialty,
      location: "Information not found",
      workplace: "Information not found",
      confidence_score: 0,
      sources: [],
    };
  }

  // Sort by confidence score
  const sortedExtractions = extractions.sort((a, b) => b.confidence - a.confidence);
  
  // Get the most confident extraction as base
  const bestExtraction = sortedExtractions[0];
  
  // Aggregate information with preference for high-confidence sources
  const name = findMostReliableValue(extractions, 'doctor_name') || originalQuery.name;
  const specialty = findMostReliableValue(extractions, 'specialty') || originalQuery.specialty;
  const location = findMostReliableValue(extractions, 'location') || "Location not found";
  const workplace = findMostReliableValue(extractions, 'workplace') || "Workplace not found";
  
  // Collect additional workplaces
  const allWorkplaces = extractions
    .map(e => e.workplace)
    .filter(Boolean)
    .filter(w => w !== workplace);
  const additional_workplaces = [...new Set(allWorkplaces)];

  // Calculate overall confidence score
  const avgConfidence = extractions.reduce((sum, e) => sum + e.confidence, 0) / extractions.length;
  const sourceTypeBonus = extractions.some(e => 
    e.source_type === 'medical_directory' || e.source_type === 'hospital_website'
  ) ? 0.1 : 0;
  
  const confidence_score = Math.min(1, avgConfidence + sourceTypeBonus);

  return {
    name,
    specialty,
    location,
    workplace,
    additional_workplaces: additional_workplaces.length > 0 ? additional_workplaces : undefined,
    confidence_score: Math.round(confidence_score * 100) / 100,
  };
}

// Find the most reliable value for a field across extractions
function findMostReliableValue(extractions: MedicalExtraction[], field: keyof MedicalExtraction): string | undefined {
  const values = extractions
    .filter(e => e[field])
    .map(e => ({ value: e[field] as string, confidence: e.confidence, sourceType: e.source_type }))
    .sort((a, b) => {
      // Prioritize by source type first, then confidence
      const sourceTypeScore = (type: string) => {
        switch (type) {
          case 'medical_directory': return 3;
          case 'hospital_website': return 2;
          case 'academic_profile': return 1;
          default: return 0;
        }
      };
      
      const aScore = sourceTypeScore(a.sourceType) + a.confidence;
      const bScore = sourceTypeScore(b.sourceType) + b.confidence;
      
      return bScore - aScore;
    });

  return values.length > 0 ? values[0].value : undefined;
}

