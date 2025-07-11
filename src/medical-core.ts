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
  InstitutionQuery,
  InstitutionInfo,
  InstitutionExtraction,
  InstitutionExtractionSchema,
  NPIQuery,
  NPIInfo,
  NPIExtraction,
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
    { pattern: 'dana-farber.org', location: 'Dana-Farber Cancer Institute' },
    { pattern: 'cancer.gov', location: 'Bethesda, MD' },
    { pattern: 'radiationoncologyassociates.com', location: 'Boston, MA' },
    { pattern: 'oklahomaproton.com', location: 'Oklahoma City, OK' },
    { pattern: 'protonradiationoncology.com', location: 'Oklahoma City, OK' }
  ];
  
  for (const { pattern, location } of locationPatterns) {
    if (urlLower.includes(pattern)) {
      return location;
    }
  }
  
  return null;
}

// Aggregate and rank medical information
function aggregateDoctorInfo(extractions: MedicalExtraction[]): DoctorInfo {
  if (extractions.length === 0) {
    return {
      name: "Not found",
      specialty: "Not specified",
      workplace: "Not found",
      location: "Not found",
      confidence_score: 0,
      extractions: [],
    };
  }

  // Sort by confidence score in descending order
  extractions.sort((a, b) => b.confidence - a.confidence);

  // Use the highest confidence extraction as the primary source of truth
  const bestExtraction = extractions[0];

  const finalDoctorInfo: DoctorInfo = {
    name: bestExtraction.doctor_name,
    specialty: bestExtraction.specialty,
    workplace: bestExtraction.workplace,
    location: bestExtraction.location,
    confidence_score: bestExtraction.confidence,
    extractions: extractions,
  };

  // Post-processing: If primary workplace or location is not found, try to find it in other extractions
  if (finalDoctorInfo.workplace === "Not found" || finalDoctorInfo.workplace === "Not specified") {
    const otherWorkplace = extractions.find(e => e.workplace !== "Not found" && e.workplace !== "Not specified");
    if (otherWorkplace) {
      finalDoctorInfo.workplace = otherWorkplace.workplace;
    }
  }

  if (finalDoctorInfo.location === "Not found" || finalDoctorInfo.location === "Not specified") {
    const otherLocation = extractions.find(e => e.location !== "Not found" && e.location !== "Not specified");
    if (otherLocation) {
      finalDoctorInfo.location = otherLocation.location;
    }
  }

  return finalDoctorInfo;
}

// Main research function for medical professionals
async function researchDoctor(doctorQuery: DoctorQuery): Promise<DoctorInfo> {
  log("Generating search queries...");
  const queries = await generateMedicalSearchQueries(doctorQuery);
  log("Generated queries:", queries);

  const limit = pLimit(ConcurrencyLimit);
  const searchPromises = queries.map(query => limit(() => googleSearch(query)));
  const searchResults = (await Promise.all(searchPromises)).flat();

  log("\nScraping and extracting information...");
  const extractionPromises = searchResults.map(result =>
    limit(async () => {
      const content = await enhancedWebScrape(result.link);
      if (content) {
        return extractMedicalInfo({ content, url: result.link, doctorQuery });
      }
      return null;
    })
  );

  const extractions = compact(await Promise.all(extractionPromises));

  log("\nAggregating and ranking results...");
  const aggregatedInfo = aggregateDoctorInfo(extractions);

  return aggregatedInfo;
}

// Generate search queries for institutions
async function generateInstitutionSearchQueries(institutionQuery: InstitutionQuery): Promise<string[]> {
  const name = institutionQuery.name;
  return [
    `${name} official website`,
    `${name} location`,
    `${name} social media`,
    `${name} about us`,
    `${name} contact information`,
  ];
}

// Extract institution information from content
async function extractInstitutionInfo({
  content,
  url,
  institutionQuery,
}: {
  content: string;
  url: string;
  institutionQuery: InstitutionQuery;
}): Promise<InstitutionExtraction | null> {
  if (!content || content.length < 50) {
    log(`Skipping ${url}: content too short (${content.length} chars)`);
    return null;
  }

  const prompt = `Extract institution information from the following content. Focus on location, official websites, and social media links.

Target Institution: ${institutionQuery.name}
Source URL: ${url}

Content to analyze:
${trimPrompt(content, 8000)}

IMPORTANT INSTRUCTIONS:
- Extract the full address, including city, state, and zip code if available.
- Extract all official websites and social media links. Look for:
  * Official website URLs (mayoclinic.org, etc.)
  * Facebook URLs (facebook.com/...)
  * Instagram URLs (instagram.com/...)
  * Twitter/X URLs (twitter.com/... or x.com/...)
  * LinkedIn URLs (linkedin.com/...)
  * YouTube URLs (youtube.com/...)
- Ensure URLs are complete and valid with proper protocols (https://).
- Always return 'websites' and 'social_media' as arrays, even if empty.
- If you cannot find specific information, use these defaults:
  - location: "Not found"
  - websites: []
  - social_media: []
  - confidence: Base on how much information you found (0.1-1.0)

Always provide all required fields even if the information is limited.`;

  try {
    const result = await generateObject({
      model: getModel(),
      schema: InstitutionExtractionSchema,
      prompt: trimPrompt(prompt),
      system: medicalResearchSystemPrompt,
    });

    const extraction = result.object;

    // Ensure websites and social_media are arrays, even if empty
    extraction.websites = extraction.websites || [];
    extraction.social_media = extraction.social_media || [];

    // Normalize and validate URLs
    extraction.websites = extraction.websites.map(normalizeUrl).filter(isValidUrl);
    extraction.social_media = extraction.social_media.map(normalizeUrl).filter(isValidUrl);

    log(`✅ Extracted institution info from ${url}: ${extraction.location}`);
    return extraction;
  } catch (error) {
    log("❌ Error extracting institution info from:", url, error);
    return null;
  }
}

// Aggregate and rank institution information
function aggregateInstitutionInfo(extractions: InstitutionExtraction[], searchResults: any[]): InstitutionInfo {
  if (extractions.length === 0) {
    return {
      name: "Not found",
      location: "Not found",
      websites: [],
      social_media: [],
      confidence_score: 0,
      sources: [],
      last_updated: new Date().toISOString(),
    };
  }

  // Sort by confidence score in descending order
  extractions.sort((a, b) => b.confidence - a.confidence);

  // Use the highest confidence extraction as the primary source of truth
  const bestExtraction = extractions[0];

  // Collect unique sources from search results
  const sources = [...new Set(searchResults.map(result => result.link))];

  // Collect all unique websites and social media from all extractions
  const allWebsites = new Set<string>();
  const allSocialMedia = new Set<string>();

  extractions.forEach(extraction => {
    if (extraction.websites) {
      extraction.websites.forEach(website => allWebsites.add(website));
    }
    if (extraction.social_media) {
      extraction.social_media.forEach(social => allSocialMedia.add(social));
    }
  });

  const finalInstitutionInfo: InstitutionInfo = {
    name: bestExtraction.institution_name,
    location: bestExtraction.location,
    websites: Array.from(allWebsites),
    social_media: Array.from(allSocialMedia),
    confidence_score: bestExtraction.confidence,
    sources: sources,
    last_updated: new Date().toISOString(),
  };

  return finalInstitutionInfo;
}

// Main research function for institutions
async function researchInstitution(institutionQuery: InstitutionQuery): Promise<InstitutionInfo> {
  log("Generating search queries...");
  const queries = await generateInstitutionSearchQueries(institutionQuery);
  log("Generated queries:", queries);

  const limit = pLimit(ConcurrencyLimit);
  const searchPromises = queries.map(query => limit(() => googleSearch(query)));
  const searchResults = (await Promise.all(searchPromises)).flat();

  log("\nScraping and extracting information...");
  const extractionPromises = searchResults.map(result =>
    limit(async () => {
      const content = await enhancedWebScrape(result.link);
      if (content) {
        return extractInstitutionInfo({ content, url: result.link, institutionQuery });
      }
      return null;
    })
  );

  const extractions = compact(await Promise.all(extractionPromises));

  log("\nAggregating and ranking results...");
  const aggregatedInfo = aggregateInstitutionInfo(extractions, searchResults);

  return aggregatedInfo;
}

// Helper function to validate and normalize URLs
function normalizeUrl(url: string): string {
  try {
    let parsedUrl = new URL(url);
    // Ensure protocol is present
    if (!parsedUrl.protocol) {
      parsedUrl = new URL(`https://${url}`);
    }
    // Remove trailing slash if it's just the domain or path
    if (parsedUrl.pathname === '/' && parsedUrl.search === '' && parsedUrl.hash === '') {
      return parsedUrl.origin;
    }
    return parsedUrl.toString();
  } catch (error) {
    return url; // Return original if parsing fails
  }
}

function isValidUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:'
  } catch (error) {
    return false;
  }
}





// NPI lookup function using NPPES API
async function lookupNPI(npiQuery: NPIQuery): Promise<NPIInfo> {
  log("Looking up NPI information...");
  
  try {
    // Construct API URL with query parameters
    const baseUrl = "https://npiregistry.cms.hhs.gov/api/";
    const params = new URLSearchParams({
      version: "2.1",
      enumeration_type: "NPI-1", // Individual providers
      first_name: npiQuery.first_name,
      last_name: npiQuery.last_name,
      limit: "10"
    });

    // Add optional parameters if provided
    if (npiQuery.state) {
      params.append("state", npiQuery.state.toUpperCase());
    }
    if (npiQuery.city) {
      params.append("city", npiQuery.city);
    }
    if (npiQuery.specialty) {
      params.append("taxonomy_description", npiQuery.specialty);
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;
    log("NPI API URL:", apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Medical-Research-Agent/1.0',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`NPI API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    log("NPI API response:", JSON.stringify(data, null, 2));

    if (!data.results || data.results.length === 0) {
      return {
        npi_number: "Not found",
        name: `${npiQuery.first_name} ${npiQuery.last_name}`,
        specialty: "Not found",
        practice_address: "Not found",
        enumeration_date: "Not found",
        last_updated: new Date().toISOString(),
        status: "Not found",
        entity_type: "Individual Provider",
        sources: [apiUrl],
        confidence_score: 0,
      };
    }

    // Process the first (best) result
    const result = data.results[0];
    const basicInfo = result.basic || {};
    const addresses = result.addresses || [];
    const taxonomies = result.taxonomies || [];
    
    // Find practice location (first address) and mailing address
    const practiceAddress = addresses.find(addr => addr.address_purpose === "LOCATION") || addresses[0];
    const mailingAddress = addresses.find(addr => addr.address_purpose === "MAILING");
    
    // Format practice address
    const formatAddress = (addr: any) => {
      if (!addr) return "Not found";
      const parts = [
        addr.address_1,
        addr.address_2,
        addr.city,
        addr.state,
        addr.postal_code
      ].filter(Boolean);
      return parts.join(", ");
    };

    // Get primary taxonomy/specialty
    const primaryTaxonomy = taxonomies.find(tax => tax.primary === true) || taxonomies[0];
    const specialty = primaryTaxonomy?.desc || "Not specified";

    // Format name with credentials
    const credential = basicInfo.credential || "";
    const fullName = `${basicInfo.first_name || ""} ${basicInfo.last_name || ""}`.trim();
    const nameWithCredential = credential ? `${fullName}, ${credential}` : fullName;

    const npiInfo: NPIInfo = {
      npi_number: result.number || "Not found",
      name: nameWithCredential,
      credential: credential,
      specialty: specialty,
      practice_address: formatAddress(practiceAddress),
      mailing_address: mailingAddress ? formatAddress(mailingAddress) : undefined,
      phone: practiceAddress?.telephone_number || undefined,
      enumeration_date: result.enumeration_date || "Not found",
      last_updated: result.last_updated_epoch ? new Date(parseInt(result.last_updated_epoch) * 1000).toISOString() : new Date().toISOString(),
      status: basicInfo.status || "Unknown",
      entity_type: result.enumeration_type === "NPI-1" ? "Individual Provider" : "Organizational Provider",
      sources: [apiUrl],
      confidence_score: 0.9, // High confidence for official NPI registry
    };

    log("✅ NPI lookup successful:", npiInfo.npi_number);
    return npiInfo;

  } catch (error) {
    log("❌ Error during NPI lookup:", error);
    return {
      npi_number: "Error",
      name: `${npiQuery.first_name} ${npiQuery.last_name}`,
      specialty: "Error during lookup",
      practice_address: "Error during lookup",
      enumeration_date: "Error",
      last_updated: new Date().toISOString(),
      status: "Error",
      entity_type: "Individual Provider",
      sources: [],
      confidence_score: 0,
    };
  }
}

export { researchDoctor, researchInstitution, lookupNPI };

