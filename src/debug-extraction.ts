import { researchDoctor } from './medical-research';
import { DoctorQuery } from './medical-schemas';
import { getModel } from './ai/providers';
import { generateObject } from 'ai';
import { MedicalExtractionSchema } from './medical-schemas';

async function debugExtraction() {
  console.log('🔍 Debug: Testing AI Extraction Directly');
  console.log('==========================================\n');

  // Test with sample content that should definitely work
  const testContent = `
Professor Thomas Powles
Barts Cancer Institute, Queen Mary University of London
Centre for Experimental Cancer Medicine
Charterhouse Square, London EC1M 6BQ, UK

Professor Thomas Powles is a Professor of Genitourinary Oncology at Barts Cancer Institute, 
Queen Mary University of London and Honorary Consultant Medical Oncologist at Barts Health NHS Trust.

His research focuses on bladder cancer and renal cell carcinoma. He leads several international 
clinical trials and has published extensively in high-impact journals.

Contact: t.powles@qmul.ac.uk
Location: London, United Kingdom
Institution: Queen Mary University of London, Barts Cancer Institute
  `;

  const prompt = `Extract medical professional information from this content:

Target Doctor: Tom Powles
Target Specialty: Urology

Content:
${testContent}

Extract the doctor's name, specialty, workplace, and location from this content.`;

  try {
    console.log('Testing AI extraction with sample content...\n');
    
    const result = await generateObject({
      model: getModel(),
      schema: MedicalExtractionSchema,
      prompt: prompt,
      system: `You are a medical research assistant. Extract information about medical professionals from content. Be flexible with name matching and extract any available information.`,
    });

    console.log('✅ AI Extraction Result:');
    console.log(JSON.stringify(result.object, null, 2));

    if (result.object.doctor_name) {
      console.log('\n✅ AI extraction is working!');
      console.log('The issue must be in the content retrieval or validation logic.');
    } else {
      console.log('\n❌ AI extraction failed even with clear content');
      console.log('The AI model or schema might have issues.');
    }

  } catch (error) {
    console.log('\n❌ AI extraction error:', error);
  }

  // Now test the full research function
  console.log('\n' + '='.repeat(50));
  console.log('🔍 Testing Full Research Function');
  console.log('='.repeat(50));

  const testQuery: DoctorQuery = {
    name: "Tom Powles",
    specialty: "Urology"
  };

  try {
    const result = await researchDoctor(testQuery);
    console.log('\nFull research result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.log('\nFull research error:', error);
  }
}

// Run debug if this file is executed directly
if (require.main === module) {
  debugExtraction().catch(console.error);
}

export { debugExtraction };

