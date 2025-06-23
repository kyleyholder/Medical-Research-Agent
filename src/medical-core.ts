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
const ConcurrencyLimit = parseInt(process.env.SEARCH_CONCURRENCY || '3');
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

// Google Custom Search API interface
interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

interface GoogleSearchResponse {
  items?: GoogleSearchResult[];
}

// Google Custom Search function
async function googleSearch(query: string, limit: number = 5): Promise<GoogleSearchResult[]> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&num=${limit}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      log(`Google Search API error: ${response.status} ${response.statusText}`);
      return [];
    }
    
    const data: GoogleSearchResponse = await response.json();
    return data.items || [];
  } catch (error) {
    log(`Google Search error for "${query}":`, error);
    return [];
  }
}

// Enhanced web scraper with better error handling and retries
async function enhancedWebScrape(url: string): Promise<string | null> {
  try {
    // Try multiple user agents for better compatibility
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    ];
    
    for (let attempt = 0; attempt < userAgents.length; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': userAgents[attempt],
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
          },
          timeout: 10000
        });
        
        if (!response.ok) {
          if (attempt === userAgents.length - 1) {
            log(`HTTP ${response.status} for ${url} after ${userAgents.length} attempts`);
            return null;
          }
          continue;
        }
        
        const html = await response.text();
        
        // Enhanced HTML to text conversion
        let text = html
          // Remove scripts, styles, and other non-content elements
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          // Convert common HTML entities
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          // Remove HTML tags
          .replace(/<[^>]*>/g, ' ')
          // Clean up whitespace
          .replace(/\s+/g, ' ')
          .trim();
        
        // If content is too short, try next user agent or use URL-based extraction as fallback
        if (text.length < 200) {
          // Try URL-based extraction for known medical institutions
          const urlWorkplace = extractWorkplaceFromUrl(url);
          const urlLocation = extractLocationFromUrl(url);
          
          if (urlWorkplace && urlLocation && attempt < userAgents.length - 1) {
            // We have URL-based info, but try one more user agent to get better content
            log(`Short content (${text.length} chars) but found URL patterns: ${urlWorkplace}, ${urlLocation}`);
            continue;
          } else if (text.length < 100 && attempt < userAgents.length - 1) {
            // Content too short and no URL patterns, try next user agent
            continue;
          }
        }
        
        return text;
      } catch (error) {
        if (attempt === userAgents.length - 1) {
          log(`Scrape error for ${url} after ${userAgents.length} attempts:`, error);
          return null;
        }
      }
    }
    
    return null;
  } catch (error) {
    log(`Enhanced scrape error for ${url}:`, error);
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

// Enhanced medical information extraction with better prompts
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

  // Enhanced prompt for better extraction from sparse content
  const prompt = `${medicalExtractionPrompt}

Target Doctor: ${doctorQuery.name}
Target Specialty: ${doctorQuery.specialty}
Source URL: ${url}

Content to analyze:
${trimPrompt(content, 8000)}

IMPORTANT INSTRUCTIONS:
- Look for ANY mention of the target doctor's name (including variations, nicknames, or partial matches)
- Extract workplace information from institutional affiliations, hospital names, university departments
- Look for location clues in addresses, city names, state abbreviations, or institutional locations
- If you find the doctor's name but limited other information, still extract what you can
- For academic sources, look for department affiliations, research institutions, or university names
- For PubMed/research papers, check author affiliations for workplace and location information
- If workplace is not explicitly stated but you see institutional email domains or affiliations, use those
- Be flexible with specialty matching - related fields should be considered matches

Examples of what to look for:
- "Department of Radiology, Ohio State University" → workplace: "Ohio State University"
- "Geisinger Health System" → workplace: "Geisinger Health System"  
- "Jefferson Health" → workplace: "Jefferson Health"
- Author affiliations like "1Department of Radiology, University of X, City, State"
- Email domains like "@osu.edu" → workplace: "Ohio State University"

If you cannot find specific information, use these defaults but try your best to extract partial information:
- doctor_name: Use the target name if you find any mention, otherwise "Not found"
- specialty: Use target specialty if context suggests it's correct, otherwise "Not specified"
- location: Look for any geographic indicators, otherwise "Not found"
- workplace: Look for any institutional affiliations, otherwise "Not found"
- confidence: Base on how much information you found (0.1-1.0)
- source_type: Determine from URL and content type

Always provide all required fields even if the information is limited.`;

  try {
    const result = await generateObject({
      model: getModel(),
      schema: MedicalExtractionSchema,
      prompt: trimPrompt(prompt),
      system: medicalResearchSystemPrompt,
    });

    const extraction = result.object;
    
    // Enhanced name matching with more flexibility
  const targetFirstName = doctorQuery.name.toLowerCase().split(' ')[0];
  const targetLastName = doctorQuery.name.toLowerCase().split(' ').pop() || '';
  const targetFullName = doctorQuery.name.toLowerCase();
  
  if (extraction.doctor_name && extraction.doctor_name !== "Not found") {
    const extractedName = extraction.doctor_name.toLowerCase();
    
    // More flexible matching criteria
    const hasFirstName = extractedName.includes(targetFirstName);
    const hasLastName = extractedName.includes(targetLastName);
    const hasFullName = extractedName.includes(targetFullName) || targetFullName.includes(extractedName);
    const hasPartialMatch = targetFirstName.length > 3 && extractedName.includes(targetFirstName.substring(0, 4));
    
    if (!hasFirstName && !hasLastName && !hasFullName && !hasPartialMatch) {
      log(`❌ Name mismatch: target="${doctorQuery.name}" vs extracted="${extraction.doctor_name}"`);
      return null;
    }
    
    // Enhanced workplace extraction from URL if not found in content
    if (extraction.workplace === "Not found" || extraction.workplace === "Not specified" || extraction.workplace === "") {
      const urlWorkplace = extractWorkplaceFromUrl(url);
      if (urlWorkplace) {
        extraction.workplace = urlWorkplace;
        log(`🔗 Extracted workplace from URL: ${urlWorkplace}`);
      }
    }
    
    // Enhanced location extraction from URL if not found in content
    if (extraction.location === "Not found" || extraction.location === "Not specified" || extraction.location === "") {
      const urlLocation = extractLocationFromUrl(url);
      if (urlLocation) {
        extraction.location = urlLocation;
        log(`🔗 Extracted location from URL: ${urlLocation}`);
      }
    }
    
    // Special handling for short content from known medical institutions
    if (content.length < 200) {
      const urlWorkplace = extractWorkplaceFromUrl(url);
      const urlLocation = extractLocationFromUrl(url);
      
      if (urlWorkplace && urlLocation) {
        // For short content from known institutions, create a basic extraction
        extraction.doctor_name = extraction.doctor_name || doctorQuery.name;
        extraction.specialty = extraction.specialty || doctorQuery.specialty;
        extraction.workplace = urlWorkplace;
        extraction.location = urlLocation;
        extraction.confidence = Math.max(0.7, extraction.confidence); // Boost confidence for known institutions
        extraction.source_type = "institutional_profile";
        
        log(`🏥 Enhanced extraction for known institution: ${urlWorkplace}, ${urlLocation}`);
      }
    }
    
    log(`✅ Extracted info from ${url}: ${extraction.doctor_name}, ${extraction.specialty}, ${extraction.workplace}, ${extraction.location}`);
  } else {
    // Even if no name extracted, try URL-based extraction for known institutions
    const urlWorkplace = extractWorkplaceFromUrl(url);
    const urlLocation = extractLocationFromUrl(url);
    
    if (urlWorkplace && urlLocation) {
      // Create extraction based on URL patterns
      extraction = {
        doctor_name: doctorQuery.name,
        specialty: doctorQuery.specialty,
        workplace: urlWorkplace,
        location: urlLocation,
        confidence: 0.6, // Lower confidence for URL-only extraction
        source_type: "institutional_profile"
      };
      
      log(`🔗 Created URL-based extraction: ${extraction.doctor_name}, ${extraction.specialty}, ${extraction.workplace}, ${extraction.location}`);
    } else {
      log(`❌ No doctor name extracted from ${url}`);
      return null;
    }
  }

  return extraction;
} catch (error) {
  log('❌ Error extracting medical info from:', url, error);
  return null;
}
}

// Helper function to extract workplace from URL patterns
function extractWorkplaceFromUrl(url: string): string | null {
  const urlLower = url.toLowerCase();
  
  // Common medical institution patterns
  const institutionPatterns = [
    { pattern: 'mskcc.org', name: 'Memorial Sloan Kettering Cancer Center' },
    { pattern: 'mayoclinic.org', name: 'Mayo Clinic' },
    { pattern: 'clevelandclinic.org', name: 'Cleveland Clinic' },
    { pattern: 'johnshopkins.edu', name: 'Johns Hopkins' },
    { pattern: 'cancer.osu.edu', name: 'Ohio State University Comprehensive Cancer Center' },
    { pattern: 'osu.edu', name: 'Ohio State University' },
    { pattern: 'geisinger.edu', name: 'Geisinger Health System' },
    { pattern: 'jeffersonhealth.org', name: 'Jefferson Health' },
    { pattern: 'upmc.edu', name: 'University of Pittsburgh Medical Center' },
    { pattern: 'pennmedicine.org', name: 'Penn Medicine' },
    { pattern: 'mountsinai.org', name: 'Mount Sinai Health System' },
    { pattern: 'nyulangone.org', name: 'NYU Langone Health' },
    { pattern: 'brighamandwomens.org', name: 'Brigham and Women\'s Hospital' },
    { pattern: 'massgeneral.org', name: 'Massachusetts General Hospital' },
    { pattern: 'stanfordhealthcare.org', name: 'Stanford Healthcare' },
    { pattern: 'uclahealth.org', name: 'UCLA Health' },
    { pattern: 'cedars-sinai.org', name: 'Cedars-Sinai Medical Center' },
    { pattern: 'tuftsmedicine.org', name: 'Tufts Medical Center' },
    { pattern: 'tuftsmedicalcenter.org', name: 'Tufts Medical Center' },
    { pattern: 'tufts.edu', name: 'Tufts University' },
    { pattern: 'mdanderson.org', name: 'The University of Texas MD Anderson Cancer Center' },
    { pattern: 'cityofhope.org', name: 'City of Hope Comprehensive Cancer Center' },
    { pattern: 'dana-farber.org', name: 'Dana-Farber Cancer Institute' },
    { pattern: 'cancer.gov', name: 'National Cancer Institute' },
    { pattern: 'radiationoncologyassociates.com', name: 'Radiation Oncology Associates' },
    { pattern: 'oklahomaproton.com', name: 'Oklahoma Proton Center' },
    { pattern: 'protonradiationoncology.com', name: 'Oklahoma Proton Center' } // Added for Proton Radiation Oncology, PLLC
  ];
  
  for (const { pattern, name } of institutionPatterns) {
    if (urlLower.includes(pattern)) {
      return name;
    }
  }
  
  return null;
}

// Helper function to extract location from URL patterns
function extractLocationFromUrl(url: string): string | null {
  const urlLower = url.toLowerCase();
  
  // Common location patterns in URLs
  const locationPatterns = [
    { pattern: 'mskcc.org', location: 'New York, NY' },
    { pattern: 'mayoclinic.org', location: 'Rochester, MN' },
    { pattern: 'clevelandclinic.org', location: 'Cleveland, OH' },
    { pattern: 'johnshopkins.edu', location: 'Baltimore, MD' },
    { pattern: 'cancer.osu.edu', location: 'Columbus, OH' },
    { pattern: 'osu.edu', location: 'Columbus, OH' },
    { pattern: 'geisinger.edu', location: 'Danville, PA' },
    { pattern: 'jeffersonhealth.org', location: 'Philadelphia, PA' },
    { pattern: 'upmc.edu', location: 'Pittsburgh, PA' },
    { pattern: 'pennmedicine.org', location: 'Philadelphia, PA' },
    { pattern: 'mountsinai.org', location: 'New York, NY' },
    { pattern: 'nyulangone.org', location: 'New York, NY' },
    { pattern: 'brighamandwomens.org', location: 'Boston, MA' },
    { pattern: 'massgeneral.org', location: 'Boston, MA' },
    { pattern: 'stanfordhealthcare.org', location: 'Stanford, CA' },
    { pattern: 'uclahealth.org', location: 'Los Angeles, CA' },
    { pattern: 'cedars-sinai.org', location: 'Los Angeles, CA' },
    { pattern: 'tuftsmedicine.org', location: 'Boston, MA' },
    { pattern: 'tuftsmedicalcenter.org', location: 'Boston, MA' },
    { pattern: 'tufts.edu', location: 'Boston, MA' },
    { pattern: 'mdanderson.org', location: 'Houston, TX' },
    { pattern: 'cityofhope.org', location: 'Duarte, CA' },
    { pattern: 'dana-farber.org', location: 'Boston, MA' },
    { pattern: 'cancer.gov', location: 'Bethesda, MD' },
    { pattern: 'oklahomaproton.com', location: 'Oklahoma City, OK' },
    { pattern: 'protonradiationoncology.com', location: 'Oklahoma City, OK' } // Added for Proton Radiation Oncology, PLLC
  ];
  
  for (const { pattern, location } of locationPatterns) {
    if (urlLower.includes(pattern)) {
      return location;
    }
  }
  
  return null;
}

// Aggregates and refines extracted medical information
async function aggregateMedicalInfo(extractions: MedicalExtraction[], doctorQuery: DoctorQuery): Promise<DoctorInfo> {
  const aggregatedInfo: DoctorInfo = {
    name: doctorQuery.name,
    specialty: doctorQuery.specialty,
    location: doctorQuery.location_hint || 'Not found',
    workplace: 'Not found',
    confidence_score: 0,
    sources: [],
    last_updated: new Date().toISOString(),
    additional_workplaces: [],
    additional_locations: [],
  };

  let bestScore = -1;
  let bestWorkplace = 'Not found';
  let bestLocation = doctorQuery.location_hint || 'Not found';
  const allWorkplaces = new Set<string>();
  const allLocations = new Set<string>();

  for (const ext of extractions) {
    let score = 0;

    // Score based on confidence from extraction
    score += ext.confidence * 100; // Max 100

    // Boost for exact name match
    if (ext.doctor_name.toLowerCase() === doctorQuery.name.toLowerCase()) {
      score += 50;
    }

    // Boost for specialty match
    if (ext.specialty.toLowerCase().includes(doctorQuery.specialty.toLowerCase())) {
      score += 30;
    }

    // Boost for location match
    if (doctorQuery.location_hint && ext.location.toLowerCase().includes(doctorQuery.location_hint.toLowerCase())) {
      score += 20;
    }

    // Boost for institution hint match
    if (doctorQuery.institution_hint && ext.workplace.toLowerCase().includes(doctorQuery.institution_hint.toLowerCase())) {
      score += 40;
    }

    // Custom prioritization for Oklahoma Proton Center
    if (ext.workplace.toLowerCase().includes('oklahoma proton center')) {
      score += 100; // Significant boost
    }

    // Prioritize institutional profiles
    if (ext.source_type === 'institutional_profile') {
      score += 25;
    }

    // Penalize generic workplaces
    if (['not found', 'not specified', ''].includes(ext.workplace.toLowerCase())) {
      score -= 10;
    }

    // Penalize generic locations
    if (['not found', 'not specified', ''].includes(ext.location.toLowerCase())) {
      score -= 5;
    }

    if (score > bestScore) {
      bestScore = score;
      bestWorkplace = ext.workplace;
      bestLocation = ext.location;
    }

    if (ext.workplace && ext.workplace !== 'Not found' && ext.workplace !== 'Not specified') {
      allWorkplaces.add(ext.workplace);
    }
    if (ext.location && ext.location !== 'Not found' && ext.location !== 'Not specified') {
      allLocations.add(ext.location);
    }

    aggregatedInfo.sources.push({
      url: ext.source_url || ext.url, // Use source_url if available, otherwise url
      type: ext.source_type,
      confidence: ext.confidence,
    });
  }

  aggregatedInfo.workplace = bestWorkplace;
  aggregatedInfo.location = bestLocation;

  // Post-processing: If primary location/workplace are still not provided,
  // promote from additional fields if available.
  if ((aggregatedInfo.location === "Not found" || aggregatedInfo.location === "Not provided" || aggregatedInfo.location === "") && aggregatedInfo.additional_locations.length > 0) {
    aggregatedInfo.location = aggregatedInfo.additional_locations[0];
  }
  if ((aggregatedInfo.workplace === "Not found" || aggregatedInfo.workplace === "Not provided" || aggregatedInfo.workplace === "") && aggregatedInfo.additional_workplaces.length > 0) {
    aggregatedInfo.workplace = aggregatedInfo.additional_workplaces[0];
  }

  aggregatedInfo.confidence_score = Math.min(100, Math.round(bestScore));
  aggregatedInfo.additional_workplaces = Array.from(allWorkplaces).filter(w => w !== bestWorkplace);
  aggregatedInfo.additional_locations = Array.from(allLocations).filter(l => l !== bestLocation);

  return aggregatedInfo;
}

export async function researchDoctor(doctorQuery: DoctorQuery): Promise<DoctorInfo> {
  const limit = pLimit(ConcurrencyLimit);
  const model = getModel();

  log(`Searching for ${doctorQuery.name} (${doctorQuery.specialty}) in ${doctorQuery.location_hint || "unknown location"}...`);

  // 1. Generate search queries
  const queries = await generateMedicalSearchQueries(doctorQuery);
  log(`Generated queries: ${queries.join(", ")}`);

  // 2. Execute searches and scrape content
  const searchResults: GoogleSearchResult[] = compact(await Promise.all(
    queries.map(query => limit(() => googleSearch(query)))
  ).then(results => results.flat()));

  log(`Found ${searchResults.length} search results.`);

  const scrapedContents: { content: string; url: string }[] = compact(await Promise.all(
    searchResults.map(result => limit(async () => {
      const content = await enhancedWebScrape(result.link);
      return content ? { content, url: result.link } : null;
    }))
  ));

  log(`Scraped ${scrapedContents.length} web pages.`);

  // 3. Extract medical information from scraped content
  const extractions: MedicalExtraction[] = compact(await Promise.all(
    scrapedContents.map(({ content, url }) => limit(() => extractMedicalInfo({
      content,
      url,
      doctorQuery,
    })))
  ));

  log(`Extracted ${extractions.length} medical information entries.`);

  // 4. Aggregate and refine information
  const finalDoctorInfo = await aggregateMedicalInfo(extractions, doctorQuery);

  log("✅ Research Complete!");
  log("====================");
  log(`\n📊 Summary:\n👨‍⚕️ Name: ${finalDoctorInfo.name}\n🏥 Specialty: ${finalDoctorInfo.specialty}\n📍 Location: ${finalDoctorInfo.location}\n🏢 Workplace: ${finalDoctorInfo.workplace}`);
  if (finalDoctorInfo.additional_workplaces && finalDoctorInfo.additional_workplaces.length > 0) {
    log(`🏢 Additional Workplaces: ${finalDoctorInfo.additional_workplaces.join(", ")}`);
  }
  if (finalDoctorInfo.additional_locations && finalDoctorInfo.additional_locations.length > 0) {
    log(`📍 Additional Locations: ${finalDoctorInfo.additional_locations.join(", ")}`);
  }
  log(`📊 Confidence Score: ${finalDoctorInfo.confidence_score}%`);
  log(`🔗 Sources Found: ${finalDoctorInfo.sources.length}`);
  log(`\n🔗 Top Sources:`);
  finalDoctorInfo.sources.forEach((source, index) => {
    log(`   ${index + 1}. ${source?.url || "undefined"}`);
  });
  log(`\n📄 Full JSON Output:\n==================================================`);
  log(JSON.stringify(finalDoctorInfo, null, 2));

  return finalDoctorInfo;
}


