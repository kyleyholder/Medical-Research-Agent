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

