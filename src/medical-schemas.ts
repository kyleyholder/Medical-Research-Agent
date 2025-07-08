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

