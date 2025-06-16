import FirecrawlApp from '@mendable/firecrawl-js';
import { generateObject } from 'ai';
import { compact } from 'lodash-es';
import pLimit from 'p-limit';

import { getModel } from './ai/providers';
import {
  DoctorInfo,
  DoctorInfoSchema,
  DoctorQuery,
  DoctorQuerySchema,
  MedicalExtraction,
  MedicalExtractionSchema,
  MedicalSearchQueries,
  MedicalSearchQueriesSchema,
} from './medical-schemas';
import {
  medicalExtractionPrompt,
  medicalQueryGenerationPrompt,
  medicalResearchSystemPrompt,
} from './medical-prompts';

// Helper function for consistent logging
function log(...args: any[]) {
  console.log(...args);
}

// Helper function to trim prompts to fit context
function trimPrompt(text: string, maxLength: number = 4000): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Configuration
const ConcurrencyLimit = parseInt(process.env.FIRECRAWL_CONCURRENCY || '2');
const firecrawl = new FirecrawlApp({ apiKey: process.env.FIRECRAWL_KEY });

// Simple web scraper using fetch (fallback when Firecrawl fails)
async function simpleWebScrape(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      return null;
    }
    
    const html = await response.text();
    
    // Simple HTML to text conversion (remove tags, scripts, styles)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    return text;
  } catch (error) {
    log(`Simple scrape error for ${url}:`, error);
    return null;
  }
}

// Generate search queries for medical professionals
async function generateMedicalSearchQueries(doctorQuery: DoctorQuery): Promise<string[]> {
  const prompt = `${medicalQueryGenerationPrompt}

Doctor: ${doctorQuery.name}
Specialty: ${doctorQuery.specialty}
Location hint: ${doctorQuery.location_hint || 'Not specified'}
Institution hint: ${doctorQuery.institution_hint || 'Not specified'}

Generate 6 targeted search queries to find information about this medical professional.`;

  try {
    const result = await generateObject({
      model: getModel(),
      schema: MedicalSearchQueriesSchema,
      prompt: trimPrompt(prompt),
      system: medicalResearchSystemPrompt,
    });

    return result.object.queries;
  } catch (error) {
    log('Error generating search queries:', error);
    
    // Fallback to manual query generation
    const name = doctorQuery.name;
    const specialty = doctorQuery.specialty;
    const location = doctorQuery.location_hint || '';
    const institution = doctorQuery.institution_hint || '';

    return [
      `${name} ${specialty} ${location}`.trim(),
      `${name} MD ${institution}`.trim(),
      `${name} ${specialty} hospital clinic`,
      `${name} medical license`,
      `${name} faculty university`,
      `Dr. ${name} ${specialty} profile`
    ].filter(query => query.length > 10);
  }
}

// Extract medical information from content
async function extractMedicalInfo({
  content,
  url,
  doctorQuery,
}: {
  content: string;
  url: string;
  doctorQuery: DoctorQuery;
}): Promise<MedicalExtraction | null> {
  if (!content || content.length < 100) {
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

// Aggregate medical information from multiple sources
function aggregateMedicalInfo(extractions: MedicalExtraction[], doctorQuery: DoctorQuery): DoctorInfo {
  if (extractions.length === 0) {
    return {
      name: doctorQuery.name,
      specialty: doctorQuery.specialty,
      location: "Information not found",
      workplace: "Information not found",
      confidence_score: 0,
      sources: [],
      last_updated: new Date().toISOString(),
    };
  }

  // Group extractions by doctor identity (similar names and specialties)
  const doctorGroups = new Map<string, MedicalExtraction[]>();
  
  for (const extraction of extractions) {
    // Create a key based on name similarity and specialty match
    const nameWords = extraction.doctor_name.toLowerCase().split(/\s+/);
    const targetWords = doctorQuery.name.toLowerCase().split(/\s+/);
    
    // Check if this extraction matches the target specialty
    const specialtyMatch = extraction.specialty.toLowerCase().includes(doctorQuery.specialty.toLowerCase()) ||
                          doctorQuery.specialty.toLowerCase().includes(extraction.specialty.toLowerCase());
    
    // Check if name has significant overlap
    const nameOverlap = nameWords.filter(word => 
      targetWords.some(targetWord => targetWord.includes(word) || word.includes(targetWord))
    ).length;
    
    // Only include if specialty matches and name has good overlap
    if (specialtyMatch && nameOverlap >= 2) {
      const key = `${extraction.doctor_name}_${extraction.specialty}`;
      if (!doctorGroups.has(key)) {
        doctorGroups.set(key, []);
      }
      doctorGroups.get(key)!.push(extraction);
    } else {
      log(`Filtering out potential different person: ${extraction.doctor_name} (${extraction.specialty}) - specialty match: ${specialtyMatch}, name overlap: ${nameOverlap}`);
    }
  }

  // If no valid groups, return not found
  if (doctorGroups.size === 0) {
    log('No consistent doctor identity found after filtering');
    return {
      name: doctorQuery.name,
      specialty: doctorQuery.specialty,
      location: "Information not found",
      workplace: "Information not found",
      confidence_score: 0,
      sources: [],
      last_updated: new Date().toISOString(),
    };
  }

  // Find the group with the most sources (most likely to be the target doctor)
  let bestGroup: MedicalExtraction[] = [];
  let bestGroupSize = 0;
  
  for (const [key, group] of doctorGroups) {
    if (group.length > bestGroupSize) {
      bestGroup = group;
      bestGroupSize = group.length;
    }
  }

  log(`Selected doctor group with ${bestGroup.length} consistent sources`);

  // Find the extraction with highest confidence within the best group
  const bestExtraction = bestGroup.reduce((best, current) => 
    current.confidence > best.confidence ? current : best
  );

  // Aggregate workplaces from the best group only
  const workplaces = bestGroup
    .map(e => e.workplace)
    .filter(w => w && w !== "Not found" && w !== "Not specified")
    .filter((w, i, arr) => arr.indexOf(w) === i); // unique

  const primaryWorkplace = workplaces[0] || "Information not found";
  const additionalWorkplaces = workplaces.slice(1);

  // Aggregate locations from the best group only
  const locations = bestGroup
    .map(e => e.location)
    .filter(l => l && l !== "Not found" && l !== "Not specified")
    .filter((l, i, arr) => arr.indexOf(l) === i); // unique

  const location = locations[0] || "Information not found";

  // Calculate average confidence from the best group only
  const avgConfidence = bestGroup.reduce((sum, e) => sum + e.confidence, 0) / bestGroup.length;

  return {
    name: bestExtraction.doctor_name || doctorQuery.name,
    specialty: bestExtraction.specialty || doctorQuery.specialty,
    location: location,
    workplace: primaryWorkplace,
    additional_workplaces: additionalWorkplaces.length > 0 ? additionalWorkplaces : undefined,
    confidence_score: avgConfidence,
    sources: [],
    last_updated: new Date().toISOString(),
  };
}

// Main research function
export async function researchDoctor(doctorQuery: DoctorQuery): Promise<DoctorInfo> {
  log(`Starting medical research for: ${doctorQuery.name} (${doctorQuery.specialty})`);

  // Validate input
  const validatedQuery = DoctorQuerySchema.parse(doctorQuery);

  // Generate search queries
  const searchQueries = await generateMedicalSearchQueries(validatedQuery);
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

  // Get unique URLs and scrape their content using simple web scraping
  const uniqueUrls = [...new Set(allResults.map(r => r.url))].slice(0, 10);
  log(`Scraping content from ${uniqueUrls.length} unique URLs`);

  // Scrape content from URLs using simple fetch
  const scrapePromises = uniqueUrls.map(url =>
    limit(async () => {
      try {
        log(`Scraping: ${url}`);
        
        // Try Firecrawl first, fallback to simple scraping
        let content: string | null = null;
        
        try {
          // Check if Firecrawl has a scrapeUrl method
          if (typeof (firecrawl as any).scrapeUrl === 'function') {
            const scrapeResult = await (firecrawl as any).scrapeUrl(url, {
              formats: ['markdown'],
            });
            if (scrapeResult.success && scrapeResult.data?.markdown) {
              content = scrapeResult.data.markdown;
            }
          }
        } catch (firecrawlError) {
          log(`Firecrawl scrape failed for ${url}, trying simple scrape`);
        }
        
        // Fallback to simple web scraping
        if (!content) {
          content = await simpleWebScrape(url);
        }

        if (!content) {
          log(`Scrape failed for: ${url}`);
          return null;
        }

        log(`Scraped ${url}: ${content.length} chars`);
        return {
          url: url,
          content: content,
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

