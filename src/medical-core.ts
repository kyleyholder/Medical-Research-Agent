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
  XProfileQuery,
  XProfileClassification,
  XProfileClassificationSchema,
  XProfileAnalysis,
  SocialMediaQuery,
  SocialMediaResult,
  SocialMediaFinder,
  SocialMediaResultSchema,
  SocialMediaFinderSchema,
} from './medical-schemas';
import {
  medicalExtractionPrompt,
  medicalQueryGenerationPrompt,
  medicalResearchSystemPrompt,
} from './medical-prompts';

// Helper function for consistent logging
function log(...args: any[]) {
  // Only log if not in quiet mode
  if (!process.env.QUIET_MODE) {
    console.log(...args);
  }
}

// Helper function for quiet progress updates
function quietLog(message: string) {
  console.log(message);
}

// Function to lookup Twitter/X ID from username using twiteridfinder.com
async function lookupTwitterId(username: string): Promise<string | null> {
  try {
    // Remove @ symbol if present
    const cleanUsername = username.replace('@', '');
    
    log(`🔍 Looking up Twitter ID for @${cleanUsername}...`);
    
    // Simple, single search with timeout protection
    const searchQuery = `"${cleanUsername}" site:twiteridfinder.com OR "${cleanUsername}" twitter id`;
    
    try {
      // Add timeout protection
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Twitter ID lookup timeout')), 10000)
      );
      
      const searchPromise = googleSearch(searchQuery, 2);
      const searchResults = await Promise.race([searchPromise, timeoutPromise]);
      
      for (const result of searchResults) {
        const textToSearch = `${result.title} ${result.snippet}`;
        
        // Simple pattern matching for Twitter IDs
        const idPatterns = [
          /ID[:\s]*(\d{10,20})/i,
          /(\d{15,20})/,
        ];
        
        for (const pattern of idPatterns) {
          const match = textToSearch.match(pattern);
          if (match && match[1] && /^\d{10,20}$/.test(match[1])) {
            log(`✅ Found Twitter ID: ${match[1]} for @${cleanUsername}`);
            return match[1];
          }
        }
      }
    } catch (searchError) {
      log(`Search error for Twitter ID lookup:`, searchError);
    }
    
    log(`❌ Could not find Twitter ID for @${cleanUsername}`);
    return null;
    
  } catch (error) {
    log(`❌ Error looking up Twitter ID for @${username}:`, error);
    return null;
  }
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

  // Track all sources used during research
  const sourcesUsed: string[] = [];

  const limit = pLimit(ConcurrencyLimit);
  const searchPromises = queries.map(query => limit(() => googleSearch(query)));
  const searchResults = (await Promise.all(searchPromises)).flat();

  // Add search result URLs to sources
  searchResults.forEach(result => {
    if (result.link && !sourcesUsed.includes(result.link)) {
      sourcesUsed.push(result.link);
    }
  });

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

  // Add sources to the final result
  return {
    ...aggregatedInfo,
    sources: sourcesUsed,
    last_updated: new Date().toISOString(),
  };
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





// Enhanced NPI lookup function with progressive filtering
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
      limit: "200" // Increased limit for better filtering
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
    log(`NPI API returned ${data.result_count || 0} results`);

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
      specialty: specialty,
      practice_address: formatAddress(practiceAddress),
      mailing_address: formatAddress(mailingAddress),
      phone: practiceAddress?.telephone_number || "Not found",
      enumeration_date: basicInfo.enumeration_date || "Not found",
      last_updated: basicInfo.last_updated || new Date().toISOString(),
      status: basicInfo.status || "Active",
      entity_type: result.enumeration_type === "NPI-1" ? "Individual Provider" : "Organizational Provider",
      sources: [apiUrl],
      confidence_score: 0.9,
    };

    log("✅ NPI lookup completed successfully");
    return npiInfo;

  } catch (error) {
    log("❌ Error during NPI lookup:", error);
    return {
      npi_number: "Error",
      name: `${npiQuery.first_name} ${npiQuery.last_name}`,
      specialty: "Error during lookup",
      practice_address: "Error during lookup",
      enumeration_date: "Error during lookup",
      last_updated: new Date().toISOString(),
      status: "Error",
      entity_type: "Individual Provider",
      sources: [],
      confidence_score: 0,
    };
  }
}

// New function for progressive NPI search with multiple results
async function searchNPIProgressive(firstName: string, lastName: string, state?: string, city?: string, specialty?: string): Promise<{ results: any[], total_count: number }> {
  log("Performing progressive NPI search...");
  
  try {
    const baseUrl = "https://npiregistry.cms.hhs.gov/api/";
    const params = new URLSearchParams({
      version: "2.1",
      enumeration_type: "NPI-1",
      first_name: firstName,
      last_name: lastName,
      limit: "50"
    });

    if (state) params.append("state", state.toUpperCase());
    if (city) params.append("city", city);
    if (specialty) params.append("taxonomy_description", specialty);

    const apiUrl = `${baseUrl}?${params.toString()}`;
    log("Progressive NPI search URL:", apiUrl);

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
    
    return {
      results: data.results || [],
      total_count: data.result_count || 0
    };

  } catch (error) {
    log("❌ Error during progressive NPI search:", error);
    return { results: [], total_count: 0 };
  }
}

// Helper function to format NPI result for display
function formatNPIResult(result: any, index: number): string {
  const basicInfo = result.basic || {};
  const addresses = result.addresses || [];
  const taxonomies = result.taxonomies || [];
  
  const practiceAddress = addresses.find(addr => addr.address_purpose === "LOCATION") || addresses[0];
  const primaryTaxonomy = taxonomies.find(tax => tax.primary === true) || taxonomies[0];
  
  const credential = basicInfo.credential || "";
  const fullName = `${basicInfo.first_name || ""} ${basicInfo.last_name || ""}`.trim();
  const nameWithCredential = credential ? `${fullName}, ${credential}` : fullName;
  
  const city = practiceAddress?.city || "Unknown";
  const state = practiceAddress?.state || "Unknown";
  const specialty = primaryTaxonomy?.desc || "Not specified";
  
  return `${index + 1}. ${nameWithCredential} - ${specialty} (${city}, ${state})`;
}


// X Profile Analysis Functions

// Helper function to normalize X username
function normalizeXUsername(username: string): string {
  // Remove @ symbol if present
  const cleanUsername = username.replace(/^@/, '');
  return cleanUsername;
}

// Helper function to construct X profile URL
function constructXProfileURL(username: string): string {
  const cleanUsername = normalizeXUsername(username);
  return `https://x.com/${cleanUsername}`;
}

// Function to scrape X profile content with multiple fallback methods
async function scrapeXProfile(username: string): Promise<any> {
  const profileUrl = constructXProfileURL(username);
  
  try {
    // Method 1: Try direct scraping with X-specific headers
    const content = await scrapeXProfileDirect(profileUrl);
    
    if (content && content.length > 100 && !content.includes("JavaScript is not available")) {
      return {
        url: profileUrl,
        content: content,
        username: normalizeXUsername(username)
      };
    }
    
    // Method 2: If direct scraping fails, try alternative approach
    const alternativeContent = await scrapeXProfileAlternative(username);
    
    if (alternativeContent) {
      return {
        url: profileUrl,
        content: alternativeContent,
        username: normalizeXUsername(username)
      };
    }
    
    return null;
    
  } catch (error) {
    log(`❌ Error scraping X profile ${username}:`, error);
    return null;
  }
}

// Direct X profile scraping with X-specific headers
async function scrapeXProfileDirect(profileUrl: string): Promise<string | null> {
  try {
    const response = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      log(`X profile fetch failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const html = await response.text();
    
    // Extract profile information from HTML using regex patterns
    const profileInfo = extractXProfileFromHTML(html);
    return profileInfo;
    
  } catch (error) {
    log(`Error in direct X profile scraping:`, error);
    return null;
  }
}

// Alternative method: Use web search to find profile information
async function scrapeXProfileAlternative(username: string): Promise<string | null> {
  try {
    // Multiple search strategies to find profile information
    const searchQueries = [
      // Direct X profile searches
      `"${username}" site:x.com OR site:twitter.com bio profile`,
      `"@${username}" site:x.com OR site:twitter.com`,
      
      // Medical professional searches
      `"@${username}" doctor physician MD DO PhD`,
      `"${username}" medical doctor physician`,
      `"${username}" "MD" "DO" "PhD" medical`,
      
      // Specific medical roles and specialties
      `"${username}" hospital clinic university medical`,
      `"${username}" "Program Coordinator" "medical physics"`,
      `"${username}" radiation oncology health`,
      `"${username}" researcher scientist medical`,
      `"${username}" nurse practitioner NP`,
      `"${username}" physician assistant PA`,
      
      // Bio and profile searches
      `"${username}" bio profile medical health`,
      `"${username}" twitter bio doctor`,
      `"${username}" x.com profile medical`
    ];
    
    let allProfileInfo = "";
    
    for (const query of searchQueries) {
      try {
        const searchResults = await googleSearch(query, 5);
        
        for (const result of searchResults) {
          // Check if this is likely the profile or mentions the user
          const isRelevant = result.link.includes(`x.com/${username}`) || 
                           result.link.includes(`twitter.com/${username}`) ||
                           result.title.toLowerCase().includes(username.toLowerCase()) ||
                           result.snippet.toLowerCase().includes(`@${username.toLowerCase()}`) ||
                           result.snippet.toLowerCase().includes(username.toLowerCase());
          
          if (isRelevant) {
            allProfileInfo += `Source: ${result.link}\n`;
            allProfileInfo += `Title: ${result.title}\n`;
            allProfileInfo += `Content: ${result.snippet}\n\n`;
          }
          
          // Also capture any medical-related mentions even if not direct profile
          const hasMedicalContent = ['doctor', 'physician', 'md', 'do', 'phd', 'medical', 'health', 
                                   'hospital', 'clinic', 'nurse', 'practitioner', 'assistant'].some(keyword => 
            result.snippet.toLowerCase().includes(keyword) && 
            result.snippet.toLowerCase().includes(username.toLowerCase())
          );
          
          if (hasMedicalContent && !isRelevant) {
            allProfileInfo += `Medical Reference: ${result.link}\n`;
            allProfileInfo += `Title: ${result.title}\n`;
            allProfileInfo += `Content: ${result.snippet}\n\n`;
          }
        }
        
        // Small delay between searches to be respectful
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        log(`Error in search query "${query}":`, error);
        continue;
      }
    }
    
    // Also try searching for the profile on other platforms that might mention it
    try {
      const additionalQueries = [
        `"${username}" linkedin profile doctor physician`,
        `"${username}" faculty directory university`,
        `"${username}" "medical physics" "radiation"`,
        `"${username}" "health program" coordinator`,
        `"${username}" podcast medical health`,
        `"${username}" purdue medical health science`,
        `"${username}" researcher medical physics`
      ];
      
      for (const additionalQuery of additionalQueries) {
        const additionalResults = await googleSearch(additionalQuery, 3);
        
        for (const result of additionalResults) {
          // Look for medical indicators in the content
          const medicalKeywords = ['doctor', 'physician', 'md', 'do', 'phd', 'medical', 'health', 
                                 'hospital', 'clinic', 'university', 'research', 'coordinator',
                                 'radiation', 'oncology', 'physics', 'program', 'professor',
                                 'scientist', 'researcher', 'faculty', 'director'];
          
          const hasmedicalContent = medicalKeywords.some(keyword => 
            result.snippet.toLowerCase().includes(keyword) ||
            result.title.toLowerCase().includes(keyword)
          );
          
          if (hasmedicalContent) {
            allProfileInfo += `Additional Source: ${result.link}\n`;
            allProfileInfo += `Title: ${result.title}\n`;
            allProfileInfo += `Content: ${result.snippet}\n\n`;
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } catch (error) {
      log(`Error in additional search:`, error);
    }
    
    if (allProfileInfo.length > 100) {
      return `Profile Information from Multiple Sources:\n${allProfileInfo}`;
    }
    
    return null;
    
  } catch (error) {
    log(`Error in alternative X profile scraping:`, error);
    return null;
  }
}

// Extract profile information from X HTML
function extractXProfileFromHTML(html: string): string | null {
  try {
    let profileInfo = "";
    
    // Try to extract display name
    const nameMatch = html.match(/<title[^>]*>([^<]+(?:\s*\(@[^)]+\))?\s*\/\s*X)<\/title>/i);
    if (nameMatch) {
      const fullTitle = nameMatch[1];
      const nameOnly = fullTitle.replace(/\s*\/\s*X$/, '').trim();
      profileInfo += `Display Name: ${nameOnly}\n`;
    }
    
    // Try to extract bio from meta description
    const bioMatch = html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    if (bioMatch) {
      profileInfo += `Bio: ${bioMatch[1]}\n`;
    }
    
    // Try to extract from JSON-LD structured data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([^<]+)<\/script>/gi);
    if (jsonLdMatch) {
      for (const jsonScript of jsonLdMatch) {
        try {
          const jsonContent = jsonScript.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(jsonContent);
          if (data.description) {
            profileInfo += `Description: ${data.description}\n`;
          }
          if (data.name) {
            profileInfo += `Name: ${data.name}\n`;
          }
        } catch (e) {
          // Ignore JSON parsing errors
        }
      }
    }
    
    // Try to extract from Open Graph tags
    const ogTitleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    if (ogTitleMatch) {
      profileInfo += `OG Title: ${ogTitleMatch[1]}\n`;
    }
    
    const ogDescMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    if (ogDescMatch) {
      profileInfo += `OG Description: ${ogDescMatch[1]}\n`;
    }
    
    return profileInfo.length > 20 ? profileInfo : null;
    
  } catch (error) {
    log(`Error extracting profile from HTML:`, error);
    return null;
  }
}

// Function to classify X profile using AI
async function classifyXProfile(profileData: any): Promise<XProfileClassification> {
  const model = getModel();
  
  // Pre-classification logic for obvious institutional accounts
  const username = profileData.url?.split('/').pop()?.toLowerCase() || '';
  const content = profileData.content?.toLowerCase() || '';
  
  // Check for obvious institutional indicators in username
  const institutionalKeywords = ['lab', 'laboratory', 'center', 'centre', 'institute', 'hospital', 'clinic', 'dept', 'department', 'research', 'group', 'team'];
  const hasInstitutionalUsername = institutionalKeywords.some(keyword => username.includes(keyword));
  
  // Check for organizational language patterns
  const organizationalPatterns = ['we are', 'our team', 'our research', 'our mission', 'our lab', 'our group', 'our center'];
  const hasOrganizationalLanguage = organizationalPatterns.some(pattern => content.includes(pattern));
  
  // If clear institutional indicators, classify as institution with high confidence
  if (hasInstitutionalUsername && (hasOrganizationalLanguage || content.includes('research') || content.includes('laboratory'))) {
    return {
      classification: 'institution',
      confidence_score: 0.95,
      reasoning: `Username "${username}" contains institutional keywords (${institutionalKeywords.filter(k => username.includes(k)).join(', ')}) and content shows organizational language patterns. This appears to be a research lab, medical center, or institutional account rather than an individual doctor.`,
      extracted_name: '',
      extracted_bio: content.substring(0, 200),
      medical_indicators: ['research', 'laboratory', 'medical', 'health'].filter(indicator => content.includes(indicator))
    };
  }
  
  const classificationPrompt = `Analyze this X (Twitter) profile and classify it as either a "doctor", "institution", or "neither".

Profile URL: ${profileData.url}
Profile Content: ${trimPrompt(profileData.content, 3000)}

Classification Guidelines:

CRITICAL: Check username and account type FIRST before content analysis.

INSTITUTION indicators (classify as "institution" if ANY of these are present):
- Username contains: Lab, Laboratory, Center, Institute, Hospital, Clinic, Dept, Department, Research, Group, Team
- Account represents a research lab, medical center, hospital, clinic, or department
- Bio describes organizational mission or services
- Multiple researchers/staff mentioned in bio
- "We are", "Our team", "Our research", "Our mission" language
- Official institutional accounts (verified or clearly organizational)
- Research group or laboratory descriptions

DOCTOR indicators (classify as "doctor" only for INDIVIDUAL medical professionals):
- Individual person's account (not representing an organization)
- Dr., MD, DO, PhD, DDS, DVM, PharmD titles for a specific person
- Medical specialties attributed to an individual
- Academic medical titles for one person (Professor, Assistant Professor, Resident, Fellow, Coordinator)
- Personal bio describing individual's work/practice
- "I am", "My research", "My practice" language
- Individual medical professional's personal account

NEITHER indicators:
- No medical credentials or affiliations
- Non-medical profession clearly stated
- Personal/lifestyle content only
- Business unrelated to healthcare

IMPORTANT CLASSIFICATION RULES:
1. USERNAME ANALYSIS IS CRITICAL: If username contains "Lab", "Laboratory", "Center", "Institute", "Research", "Group", "Team", "Dept", "Department" → likely INSTITUTION
2. LANGUAGE ANALYSIS: "We/Our" = INSTITUTION, "I/My" = DOCTOR
3. SCOPE ANALYSIS: Multiple people mentioned = INSTITUTION, Single person = DOCTOR
4. When in doubt between doctor and institution, check if it's representing an organization vs. an individual
5. Research labs and medical centers are INSTITUTIONS, not doctors
6. Individual researchers working at institutions are DOCTORS (if medical), but lab accounts are INSTITUTIONS

Provide:
1. Classification: "doctor", "institution", or "neither"
2. Confidence score (0.0 to 1.0)
3. Clear reasoning for the decision
4. Extracted name (provide empty string "" if not found)
5. Extracted bio/description (provide empty string "" if not found)
6. List of medical indicators found (provide empty array [] if none)

IMPORTANT: You MUST provide all fields. Use empty string "" for extracted_name and extracted_bio if not available, and empty array [] for medical_indicators if none found.`;

  try {
    const result = await generateObject({
      model,
      prompt: classificationPrompt,
      schema: XProfileClassificationSchema,
    });

    return result.object;
  } catch (error) {
    log(`❌ Error classifying X profile:`, error);
    return {
      classification: "neither",
      confidence: 0,
      reasoning: "Error occurred during classification",
      extracted_name: "",
      extracted_bio: "",
      medical_indicators: []
    };
  }
}

// Enhanced X profile search as final fallback
async function enhancedXProfileSearch(username: string): Promise<string | null> {
  try {
    log(`Trying enhanced search for ${username}...`);
    
    // More aggressive search queries specifically for medical professionals
    const enhancedQueries = [
      // Direct profile searches with variations
      `"${username}" x.com profile bio`,
      `"${username}" twitter.com profile bio`,
      `"@${username}" profile bio`,
      
      // Medical professional specific searches
      `"${username}" doctor physician medical`,
      `"${username}" MD DO NP PA medical`,
      `"${username}" nurse practitioner physician assistant`,
      `"${username}" hospital clinic medical center`,
      
      // Bio and description searches
      `"${username}" bio description medical health`,
      `"${username}" works at hospital clinic`,
      `"${username}" medical professional healthcare`,
      
      // Social media aggregator searches
      `"${username}" social media profile medical`,
      `"${username}" twitter bio medical doctor`,
      `"${username}" healthcare professional profile`
    ];
    
    let aggregatedContent = "";
    
    for (const query of enhancedQueries) {
      try {
        const searchResults = await googleSearch(query.trim(), 3);
        
        for (const result of searchResults) {
          // Look for any mention of the username with medical context
          const hasUsername = result.title.toLowerCase().includes(username.toLowerCase()) ||
                             result.snippet.toLowerCase().includes(username.toLowerCase()) ||
                             result.snippet.toLowerCase().includes(`@${username.toLowerCase()}`);
          
          const hasMedicalContext = ['doctor', 'physician', 'md', 'do', 'phd', 'medical', 'health', 
                                   'hospital', 'clinic', 'nurse', 'practitioner', 'assistant',
                                   'healthcare', 'medicine', 'treatment'].some(keyword => 
            result.snippet.toLowerCase().includes(keyword)
          );
          
          if (hasUsername && hasMedicalContext) {
            aggregatedContent += `Enhanced Source: ${result.link}\n`;
            aggregatedContent += `Title: ${result.title}\n`;
            aggregatedContent += `Content: ${result.snippet}\n\n`;
          }
        }
        
        // Shorter delay for enhanced search
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        log(`Error in enhanced search query "${query}":`, error);
        continue;
      }
    }
    
    if (aggregatedContent.length > 100) {
      log(`✅ Enhanced search found content for ${username}: ${aggregatedContent.length} characters`);
      return `Enhanced Profile Information for @${username}:\n${aggregatedContent}`;
    }
    
    return null;
    
  } catch (error) {
    log(`Error in enhanced X profile search:`, error);
    return null;
  }
}

// Main X profile analysis function - classification only
async function analyzeXProfile(xQuery: XProfileQuery): Promise<XProfileAnalysis> {
  const username = normalizeXUsername(xQuery.username);
  const profileUrl = constructXProfileURL(username);
  
  try {
    // Step 1: Lookup Twitter ID
    log(`🔍 Looking up Twitter ID for @${username}...`);
    const twitterId = await lookupTwitterId(username);
    
    // Step 2: Scrape the X profile with enhanced methods
    const profileData = await scrapeXProfile(username);
    
    if (!profileData || !profileData.content || profileData.content.length < 50) {
      // Enhanced fallback: Try additional search methods
      log(`Primary scraping failed for ${username}, trying enhanced search...`);
      
      const enhancedContent = await enhancedXProfileSearch(username);
      
      if (!enhancedContent) {
        return {
          username: username,
          profile_url: profileUrl,
          classification: "neither",
          confidence_score: 0,
          reasoning: "Could not access or scrape X profile content. Profile may be private, suspended, or protected.",
          twitter_id: twitterId || undefined,
          last_updated: new Date().toISOString(),
        };
      }
      
      // Use enhanced content for classification
      profileData.content = enhancedContent;
    }
    
    // Step 3: Classify the profile with enhanced content
    const classification = await classifyXProfile(profileData);
    
    // Step 4: Return classification results with Twitter ID
    const analysis: XProfileAnalysis = {
      username: username,
      profile_url: profileUrl,
      classification: classification.classification,
      confidence_score: classification.confidence,
      reasoning: classification.reasoning,
      profile_data: {
        display_name: classification.extracted_name,
        bio: classification.extracted_bio,
      },
      twitter_id: twitterId || undefined,
      last_updated: new Date().toISOString(),
    };
    
    return analysis;
    
  } catch (error) {
    log(`❌ Error during X profile analysis for ${username}:`, error);
    return {
      username: username,
      profile_url: profileUrl,
      classification: "neither",
      confidence_score: 0,
      reasoning: `Error during analysis: ${error instanceof Error ? error.message : String(error)}`,
      last_updated: new Date().toISOString(),
    };
  }
}

// Helper function to extract medical specialty from text
function extractSpecialtyFromText(text: string): string {
  const specialties = [
    "cardiology", "neurosurgery", "pediatrics", "oncology", "radiology",
    "dermatology", "psychiatry", "orthopedics", "anesthesiology", "pathology",
    "emergency medicine", "family medicine", "internal medicine", "surgery",
    "neurology", "ophthalmology", "otolaryngology", "urology", "gastroenterology",
    "endocrinology", "rheumatology", "pulmonology", "nephrology", "hematology",
    "infectious disease", "critical care", "plastic surgery", "vascular surgery",
    "thoracic surgery", "cardiac surgery", "pediatric surgery", "trauma surgery"
  ];
  
  const lowerText = text.toLowerCase();
  
  for (const specialty of specialties) {
    if (lowerText.includes(specialty)) {
      return specialty.charAt(0).toUpperCase() + specialty.slice(1);
    }
  }
  
  // Look for common patterns
  if (lowerText.includes("professor") && lowerText.includes("medicine")) {
    return "Internal Medicine";
  }
  if (lowerText.includes("surgeon")) {
    return "Surgery";
  }
  if (lowerText.includes("physician")) {
    return "Internal Medicine";
  }
  
  return "General Medicine";
}

// Social Media & Website Finder Functions

// Helper function to validate an// Enhanced verification function with stricter matching
function verifyPersonMatch(result: any, name: string, specialty?: string, institution?: string, xUsername?: string): { score: number, factors: string[] } {
  const resultText = `${result.title} ${result.snippet}`.toLowerCase();
  const nameParts = name.toLowerCase().split(' ');
  let score = 0;
  const factors: string[] = [];
  
  // Enhanced name matching - require ALL name parts for high confidence
  const nameMatches = nameParts.filter(part => part.length > 2 && resultText.includes(part));
  if (nameMatches.length === nameParts.length) {
    score += 0.4; // Higher weight for complete name match
    factors.push(`Complete name match: ${nameMatches.join(', ')}`);
  } else if (nameMatches.length >= Math.ceil(nameParts.length * 0.7)) {
    score += 0.2; // Reduced score for partial match
    factors.push(`Partial name match: ${nameMatches.join(', ')}`);
  } else {
    // If less than 70% of name parts match, this is likely wrong person
    return { score: 0, factors: ['Insufficient name match - likely different person'] };
  }
  
  // Institution matching - CRITICAL for disambiguation
  if (institution) {
    const institutionWords = institution.toLowerCase().split(' ');
    const institutionMatches = institutionWords.filter(word => 
      word.length > 2 && resultText.includes(word)
    );
    
    if (institutionMatches.length >= Math.ceil(institutionWords.length * 0.7)) {
      score += 0.25; // High weight for institution match
      factors.push(`Strong institution match: ${institution}`);
    } else if (institutionMatches.length > 0) {
      score += 0.1; // Partial institution match
      factors.push(`Partial institution match: ${institutionMatches.join(', ')}`);
    } else {
      // No institution match is a red flag
      score -= 0.2;
      factors.push('Institution mismatch - possible different person');
    }
  }
  
  // X username cross-reference
  if (xUsername) {
    const usernameInContent = resultText.includes(xUsername.toLowerCase()) || 
                             resultText.includes(`@${xUsername.toLowerCase()}`);
    if (usernameInContent) {
      score += 0.2;
      factors.push(`X username match: @${xUsername}`);
    }
  }
  
  // Medical credentials
  const medicalCredentials = ['md', 'do', 'phd', 'dr.', 'doctor', 'physician'];
  const hasCredentials = medicalCredentials.some(cred => resultText.includes(cred));
  if (hasCredentials) {
    score += 0.15;
    factors.push('Medical credentials found');
  }
  
  // Specialty matching - important for medical professionals
  if (specialty) {
    const specialtyWords = specialty.toLowerCase().split(' ');
    const specialtyMatches = specialtyWords.filter(word => 
      word.length > 3 && resultText.includes(word)
    );
    
    if (specialtyMatches.length > 0) {
      score += 0.15;
      factors.push(`Specialty match: ${specialtyMatches.join(', ')}`);
    }
  }
  
  // Medical context (lower weight)
  const medicalKeywords = ['hospital', 'clinic', 'medical', 'health', 'university', 'professor', 'research'];
  const medicalMatches = medicalKeywords.filter(keyword => resultText.includes(keyword));
  if (medicalMatches.length > 0) {
    score += 0.05;
    factors.push(`Medical context: ${medicalMatches.join(', ')}`);
  }
  
  // Apply minimum threshold - require at least 30% confidence
  if (score < 0.3) {
    return { score: 0, factors: ['Low confidence - likely different person'] };
  }
  
  return { score: Math.min(score, 1.0), factors };
}
// Helper function to determine platform type from URL
function determinePlatformType(url: string, title: string, description: string): "linkedin" | "personal_website" | "faculty_page" | "research_profile" | "practice_website" | "other" {
  const urlLower = url.toLowerCase();
  const contentLower = `${title} ${description}`.toLowerCase();
  
  if (urlLower.includes('linkedin.com')) return 'linkedin';
  if (urlLower.includes('researchgate.net') || urlLower.includes('scholar.google') || urlLower.includes('orcid.org')) return 'research_profile';
  if (contentLower.includes('faculty') || contentLower.includes('professor') || urlLower.includes('edu')) return 'faculty_page';
  if (contentLower.includes('practice') || contentLower.includes('clinic') || contentLower.includes('medical group')) return 'practice_website';
  if (urlLower.includes('www.') && !urlLower.includes('linkedin') && !urlLower.includes('facebook') && !urlLower.includes('twitter')) return 'personal_website';
  
  return 'other';
}

// Main social media finder function
async function findDoctorSocialMedia(query: SocialMediaQuery): Promise<SocialMediaFinder> {
  log(`Starting social media search for: ${query.name}`);
  
  // TARGETED MODE: When X username is provided, use focused searches only
  if (query.x_username) {
    log(`X username provided (@${query.x_username}) - using targeted search mode`);
    
    const targetedSearchQueries = [
      // Simple, practical searches that are most likely to work
      `"${query.name}" linkedin`,
      `"${query.name}" "${query.institution || 'hospital'}" faculty`,
      `"${query.name}" site:jefferson.edu`,
      `"${query.name}" site:jeffersonhealth.org`,
      `"${query.name}" "${query.specialty || 'doctor'}" profile`,
    ];
    
    return await performTargetedSearch(query, targetedSearchQueries);
  }
  
  // BROAD MODE: When no X username, use comprehensive searches
  const searchQueries = [
    // Institution-specific searches (highest priority when institution provided)
    ...(query.institution ? [
      `"${query.name}" site:${query.institution.toLowerCase().replace(/\s+/g, '')}.org`,
      `"${query.name}" site:${query.institution.toLowerCase().replace(/\s+/g, '')}.edu`,
      `"${query.name}" "${query.institution}" faculty directory`,
      `"${query.name}" "${query.institution}" staff profile`,
      `"${query.name}" "${query.institution}" ${query.specialty || 'doctor'}`,
    ] : []),
    
    // LinkedIn searches with institution context
    `"${query.name}" ${query.institution || ''} linkedin`,
    `"${query.name}" ${query.specialty || ''} linkedin profile`,
    
    // Faculty page searches with institution
    `"${query.name}" ${query.institution || ''} faculty`,
    `"${query.name}" ${query.institution || ''} professor directory`,
    
    // Personal website searches
    `"${query.name}" ${query.specialty || ''} doctor website`,
    `"${query.name}" MD ${query.specialty || ''} personal website`,
    
    // Research profile searches
    `"${query.name}" ${query.specialty || ''} researchgate scholar`,
    `"${query.name}" ${query.specialty || ''} orcid research`,
    
    // Practice website searches
    `"${query.name}" ${query.specialty || ''} practice clinic`,
    `"${query.name}" doctor ${query.specialty || ''} medical group`,
    
    // General professional searches (lower priority)
    `"${query.name}" ${query.specialty || ''} physician bio`,
    `"${query.name}" MD ${query.specialty || ''} profile`
  ];
  
  return await performBroadSearch(query, searchQueries);
}

// Targeted search function for when X username is provided
async function performTargetedSearch(query: SocialMediaQuery, searchQueries: string[]): Promise<SocialMediaFinder> {
  const results: SocialMediaResult[] = [];
  const seenUrls = new Set<string>();
  
  log(`Performing targeted search with ${searchQueries.length} focused queries`);
  
  for (const searchQuery of searchQueries) {
    try {
      // Use fewer results per query for more focused search
      const searchResults = await googleSearch(searchQuery.trim(), 3);
      
      for (const result of searchResults) {
        // Skip if we've already seen this URL
        if (seenUrls.has(result.link)) continue;
        seenUrls.add(result.link);
        
        // Apply very strict verification for targeted searches
        const validation = verifyPersonMatch(result, query.name, query.specialty, query.institution, query.x_username);
        
        // More balanced threshold for targeted searches - allow good matches without requiring X username
        const hasXUsernameMatch = validation.factors.some(factor => factor.toLowerCase().includes('x username match'));
        const hasStrongInstitutionMatch = validation.factors.some(factor => factor.toLowerCase().includes('strong institution'));
        const hasGoodNameMatch = validation.factors.some(factor => factor.toLowerCase().includes('complete name match'));
        
        // Lower threshold (50%) and more flexible matching for targeted searches
        if (validation.score >= 0.5 && (hasXUsernameMatch || hasStrongInstitutionMatch || hasGoodNameMatch)) {
          const platformType = determinePlatformType(result.link, result.title, result.snippet);
          
          // Only include LinkedIn and faculty pages in targeted mode
          if (platformType === 'linkedin' || platformType === 'faculty_page') {
            // Filter out LinkedIn directory pages - only include individual profiles
            if (platformType === 'linkedin') {
              // Skip LinkedIn directory pages (/pub/dir/, /directory/, etc.)
              if (result.link.includes('/pub/dir/') || 
                  result.link.includes('/directory/') ||
                  result.link.includes('profiles | LinkedIn') ||
                  result.title.includes('profiles | LinkedIn') ||
                  result.title.includes('"') && result.title.includes('profiles')) {
                continue; // Skip this directory result
              }
              
              // Only include individual LinkedIn profiles (/in/)
              if (!result.link.includes('/in/')) {
                continue; // Skip non-individual LinkedIn pages
              }
            }
            
            results.push({
              platform: platformType,
              url: result.link,
              title: result.title,
              description: result.snippet,
              verification_score: validation.score,
              verification_factors: validation.factors,
            });
          }
        }
      }
      
      // Shorter delay for targeted searches
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      log(`Error in targeted search query "${searchQuery}":`, error);
      continue;
    }
  }
  
  // Sort by verification score
  results.sort((a, b) => b.verification_score - a.verification_score);
  
  // Calculate confidence based on targeted results
  const avgScore = results.length > 0 ? results.reduce((sum, r) => sum + r.verification_score, 0) / results.length : 0;
  const confidenceScore = Math.min(avgScore, 1.0);
  
  log(`✅ Targeted search complete for ${query.name}: ${results.length} focused results found`);
  
  return {
    doctor_name: query.name,
    specialty: query.specialty || "Not specified",
    results: results,
    total_found: results.length,
    confidence_score: confidenceScore,
    search_queries_used: searchQueries,
    last_updated: new Date().toISOString(),
  };
}

// Broad search function for when no X username is provided
async function performBroadSearch(query: SocialMediaQuery, searchQueries: string[]): Promise<SocialMediaFinder> {
  const results: SocialMediaResult[] = [];
  const seenUrls = new Set<string>();
  
  for (const searchQuery of searchQueries) {
    try {
      const searchResults = await googleSearch(searchQuery.trim(), 5);
      
      for (const result of searchResults) {
        // Skip if we've already seen this URL
        if (seenUrls.has(result.link)) continue;
        seenUrls.add(result.link);
        
        // Validate and score the result with enhanced verification
        const validation = verifyPersonMatch(result, query.name, query.specialty, query.institution, query.x_username);
        
        // Apply stricter threshold - only include high-confidence results
        if (validation.score >= 0.5) {
          const platformType = determinePlatformType(result.link, result.title, result.snippet);
          
          results.push({
            platform: platformType,
            url: result.link,
            title: result.title,
            description: result.snippet,
            verification_score: validation.score,
            verification_factors: validation.factors,
          });
        }
      }
      
      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 300));
      
    } catch (error) {
      log(`Error in social media search query "${searchQuery}":`, error);
      continue;
    }
  }
  
  // Sort results by verification score (highest first)
  results.sort((a, b) => b.verification_score - a.verification_score);
  
  // Apply additional filtering for institution-specific results
  let filteredResults = results;
  
  if (query.institution && results.length > 5) {
    // If we have institution info and many results, prioritize institution matches
    const institutionResults = results.filter(r => 
      r.verification_factors.some(factor => 
        factor.toLowerCase().includes('institution match') || 
        factor.toLowerCase().includes('strong institution')
      )
    );
    
    const nonInstitutionResults = results.filter(r => 
      !r.verification_factors.some(factor => 
        factor.toLowerCase().includes('institution match') || 
        factor.toLowerCase().includes('strong institution')
      )
    );
    
    // Keep top institution matches + top few non-institution matches
    filteredResults = [
      ...institutionResults.slice(0, 8),
      ...nonInstitutionResults.slice(0, 2)
    ].sort((a, b) => b.verification_score - a.verification_score);
  }
  
  // Final confidence calculation based on filtered results
  const avgScore = filteredResults.length > 0 ? 
    filteredResults.reduce((sum, r) => sum + r.verification_score, 0) / filteredResults.length : 0;
  const confidenceScore = Math.min(avgScore * (filteredResults.length > 0 ? 1 : 0), 1.0);
  
  log(`✅ Social media search complete for ${query.name}: ${filteredResults.length} results found (${results.length} before filtering)`);
  
  return {
    doctor_name: query.name,
    specialty: query.specialty || "Not specified",
    results: filteredResults,
    total_found: filteredResults.length,
    confidence_score: confidenceScore,
    search_queries_used: searchQueries,
    last_updated: new Date().toISOString(),
  };
}

export { researchDoctor, researchInstitution, lookupNPI, analyzeXProfile, searchNPIProgressive, formatNPIResult, findDoctorSocialMedia };

