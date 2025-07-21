import { z } from 'zod';

// Schema for doctor information input
export const DoctorQuerySchema = z.object({
  name: z.string().min(1, "Doctor name is required"),
  specialty: z.string().min(1, "Medical specialty is required"),
  location_hint: z.string().optional(),
  institution_hint: z.string().optional(),
});

// Schema for doctor information output
export const DoctorInfoSchema = z.object({
  name: z.string().describe("Full name of the doctor with appropriate titles"),
  specialty: z.string().describe("Primary medical specialty or specialties"),
  location: z.string().describe("Primary practice location (city, state/province, country)"),
  workplace: z.string().describe("Primary institutional affiliation or practice setting"),
  additional_workplaces: z.array(z.string()).optional().describe("Additional institutional affiliations"),
  additional_locations: z.array(z.string()).optional().describe("Additional practice locations"),
  confidence_score: z.number().min(0).max(1).describe("Confidence score for the information accuracy"),
  sources: z.array(z.string()).describe("URLs of sources used for verification"),
  last_updated: z.string().describe("Timestamp when information was last verified"),
});

// Schema for search queries specific to medical professionals
export const MedicalSearchQueriesSchema = z.object({
  queries: z.array(z.string()).describe("List of targeted search queries for finding doctor information"),
});

// Schema for extracted medical information from search results
export const MedicalExtractionSchema = z.object({
  doctor_name: z.string().describe("Extracted doctor name"),
  specialty: z.string().describe("Extracted medical specialty"),
  location: z.string().describe("Extracted practice location"),
  workplace: z.string().describe("Extracted workplace or institution"),
  confidence: z.number().min(0).max(1).describe("Confidence in the extracted information"),
  source_type: z.enum(["medical_directory", "hospital_website", "academic_profile", "news_article", "other"]).describe("Type of source"),
});

export type DoctorQuery = z.infer<typeof DoctorQuerySchema>;
export type DoctorInfo = z.infer<typeof DoctorInfoSchema>;
export type MedicalSearchQueries = z.infer<typeof MedicalSearchQueriesSchema>;
export type MedicalExtraction = z.infer<typeof MedicalExtractionSchema>;



// Schema for institution information input
export const InstitutionQuerySchema = z.object({
  name: z.string().min(1, "Institution name is required"),
});

// Schema for institution information output
export const InstitutionInfoSchema = z.object({
  name: z.string().describe("Full name of the institution"),
  location: z.string().describe("Primary location of the institution (city, state/province, country)"),
  websites: z.array(z.string()).optional().describe("Official websites associated with the institution"),
  social_media: z.array(z.string()).optional().describe("Social media profiles associated with the institution"),
  confidence_score: z.number().min(0).max(1).describe("Confidence score for the information accuracy"),
  sources: z.array(z.string()).describe("URLs of sources used for verification"),
  last_updated: z.string().describe("Timestamp when information was last verified"),
});

// Schema for extracted institution information from search results
export const InstitutionExtractionSchema = z.object({
  institution_name: z.string().describe("Extracted institution name"),
  location: z.string().describe("Extracted institution location"),
  websites: z.array(z.string()).describe("Extracted websites (empty array if none found)"),
  social_media: z.array(z.string()).describe("Extracted social media links (empty array if none found)"),
  confidence: z.number().min(0).max(1).describe("Confidence in the extracted information"),
  source_type: z.enum(["official_website", "news_article", "social_media_profile", "directory", "other"]).describe("Type of source"),
});

export type InstitutionQuery = z.infer<typeof InstitutionQuerySchema>;
export type InstitutionInfo = z.infer<typeof InstitutionInfoSchema>;
export type InstitutionExtraction = z.infer<typeof InstitutionExtractionSchema>;




// Schema for NPI lookup input
export const NPIQuerySchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  state: z.string().optional().describe("State abbreviation (e.g., 'CA', 'NY')"),
  city: z.string().optional().describe("City name"),
  specialty: z.string().optional().describe("Medical specialty or taxonomy description"),
});

// Schema for NPI information output
export const NPIInfoSchema = z.object({
  npi_number: z.string().describe("10-digit National Provider Identifier"),
  name: z.string().describe("Full name of the healthcare provider"),
  credential: z.string().optional().describe("Professional credentials (e.g., MD, DO, NP)"),
  specialty: z.string().describe("Primary specialty or taxonomy description"),
  practice_address: z.string().describe("Primary practice location address"),
  mailing_address: z.string().optional().describe("Mailing address if different from practice"),
  phone: z.string().optional().describe("Practice phone number"),
  enumeration_date: z.string().describe("Date when NPI was assigned"),
  last_updated: z.string().describe("Date when NPI record was last updated"),
  status: z.string().describe("NPI status (Active, Deactivated, etc.)"),
  entity_type: z.string().describe("Individual Provider (Type 1) or Organizational Provider (Type 2)"),
  sources: z.array(z.string()).describe("URLs of sources used for verification"),
  confidence_score: z.number().min(0).max(1).describe("Confidence score for the information accuracy"),
});

// Schema for extracted NPI information from API response
export const NPIExtractionSchema = z.object({
  npi_number: z.string().describe("10-digit National Provider Identifier"),
  first_name: z.string().describe("Provider's first name"),
  last_name: z.string().describe("Provider's last name"),
  credential: z.string().optional().describe("Professional credentials"),
  taxonomy_description: z.string().describe("Primary taxonomy/specialty description"),
  practice_address: z.string().describe("Primary practice location address"),
  mailing_address: z.string().optional().describe("Mailing address"),
  phone: z.string().optional().describe("Phone number"),
  enumeration_date: z.string().describe("NPI enumeration date"),
  last_updated: z.string().describe("Last update date"),
  status: z.string().describe("NPI status"),
  entity_type: z.string().describe("Provider entity type"),
});

export type NPIQuery = z.infer<typeof NPIQuerySchema>;
export type NPIInfo = z.infer<typeof NPIInfoSchema>;
export type NPIExtraction = z.infer<typeof NPIExtractionSchema>;


// Schema for X (Twitter) profile analysis input
export const XProfileQuerySchema = z.object({
  username: z.string().min(1, "X username is required").describe("X (Twitter) username with or without @ symbol"),
});

// Schema for X profile classification result
export const XProfileClassificationSchema = z.object({
  classification: z.enum(["doctor", "institution", "neither"]).describe("Classification of the X profile"),
  confidence: z.number().min(0).max(1).describe("Confidence in the classification"),
  reasoning: z.string().describe("Explanation for the classification decision"),
  extracted_name: z.string().describe("Extracted name from the profile (empty string if not found)"),
  extracted_bio: z.string().describe("Extracted bio/description from the profile (empty string if not found)"),
  medical_indicators: z.array(z.string()).describe("Medical-related keywords or indicators found"),
});

// Schema for X profile analysis output
export const XProfileAnalysisSchema = z.object({
  username: z.string().describe("The analyzed X username"),
  profile_url: z.string().describe("URL to the X profile"),
  classification: z.enum(["doctor", "institution", "neither"]).describe("Profile classification"),
  confidence_score: z.number().min(0).max(1).describe("Overall confidence in the analysis"),
  reasoning: z.string().describe("Explanation for the classification"),
  
  // If classified as doctor, include doctor research results
  doctor_info: z.object({
    name: z.string(),
    specialty: z.string(),
    location: z.string(),
    workplace: z.string(),
    additional_workplaces: z.array(z.string()).optional(),
    additional_locations: z.array(z.string()).optional(),
    confidence_score: z.number(),
    sources: z.array(z.string()),
    last_updated: z.string(),
  }).optional().describe("Doctor information if classified as doctor"),
  
  // If classified as institution, include institution research results
  institution_info: z.object({
    name: z.string(),
    location: z.string(),
    websites: z.array(z.string()),
    social_media: z.array(z.string()),
    confidence_score: z.number(),
    sources: z.array(z.string()),
    last_updated: z.string(),
  }).optional().describe("Institution information if classified as institution"),
  
  // Raw profile data for reference
  profile_data: z.object({
    display_name: z.string().optional(),
    bio: z.string().optional(),
    location: z.string().optional(),
    website: z.string().optional(),
    follower_count: z.number().optional(),
    following_count: z.number().optional(),
    verified: z.boolean().optional(),
  }).optional().describe("Raw profile data extracted from X"),
  
  // Twitter/X ID lookup
  twitter_id: z.string().optional().describe("Numeric Twitter/X ID for the account"),
  
  last_updated: z.string().describe("Timestamp when analysis was performed"),
});

export type XProfileQuery = z.infer<typeof XProfileQuerySchema>;
export type XProfileClassification = z.infer<typeof XProfileClassificationSchema>;
export type XProfileAnalysis = z.infer<typeof XProfileAnalysisSchema>;



// Social Media & Website Finder Schemas

// Schema for social media finder input
export const SocialMediaQuerySchema = z.object({
  name: z.string().min(1, "Doctor name is required"),
  specialty: z.string().optional().describe("Medical specialty to help verify identity"),
  institution: z.string().optional().describe("Institution affiliation to help verify identity"),
  x_username: z.string().optional().describe("X/Twitter username if known"),
  location_hint: z.string().optional().describe("Location hint to help verify identity"),
});

// Schema for individual social media/website result
export const SocialMediaResultSchema = z.object({
  platform: z.enum(["linkedin", "personal_website", "faculty_page", "research_profile", "practice_website", "other"]).describe("Type of platform or website"),
  url: z.string().describe("URL of the profile or website"),
  title: z.string().describe("Title or name found on the profile/website"),
  description: z.string().describe("Brief description or bio from the profile/website"),
  verification_score: z.number().min(0).max(1).describe("Confidence that this belongs to the correct person"),
  verification_factors: z.array(z.string()).describe("Factors that support this being the correct person"),
});

// Schema for social media finder output
export const SocialMediaFinderSchema = z.object({
  doctor_name: z.string().describe("Name of the doctor searched"),
  specialty: z.string().describe("Medical specialty if provided"),
  results: z.array(SocialMediaResultSchema).describe("List of found social media profiles and websites"),
  total_found: z.number().describe("Total number of profiles/websites found"),
  confidence_score: z.number().min(0).max(1).describe("Overall confidence in the results"),
  search_queries_used: z.array(z.string()).describe("Search queries that were used"),
  last_updated: z.string().describe("Timestamp when search was performed"),
});

export type SocialMediaQuery = z.infer<typeof SocialMediaQuerySchema>;
export type SocialMediaResult = z.infer<typeof SocialMediaResultSchema>;
export type SocialMediaFinder = z.infer<typeof SocialMediaFinderSchema>;

