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

// This file should now only contain the researchDoctor function and its direct dependencies.
// All other functions (googleSearch, enhancedWebScrape, generateMedicalSearchQueries, 
// extractMedicalInfo, extractWorkplaceFromUrl, extractLocationFromUrl) have been moved to medical-core.ts

// The researchDoctor function will be imported from medical-core.ts
// This file is now essentially a placeholder or can be removed if not needed.


